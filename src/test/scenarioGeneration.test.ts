/**
 * Tests for the LLM scenario generation pipeline.
 *
 * Covers:
 *   - ScenarioGenerationBrief type usage
 *   - Pass A / Pass B / repair prompt builders
 *   - Generated-content lint (lintGeneratedScenario)
 *   - repairScenario helpers (parseAndValidateScenario, parseAndValidateConsequenceFrame)
 *   - mergeConsequenceFrame / stripConsequenceFrame
 *   - Pipeline orchestration (runGenerationPipeline) with mock model calls
 *   - Fixture files from tests/generated-scenarios/
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

import type { ScenarioGenerationBrief } from '../llm/promptTypes';
import { buildPassAPrompt } from '../llm/buildPassAPrompt';
import { buildPassBPrompt } from '../llm/buildPassBPrompt';
import { buildRepairPrompt } from '../llm/buildRepairPrompt';
import {
  lintGeneratedScenario,
} from '../llm/validateGeneratedScenario';
import {
  parseAndValidateScenario,
  parseAndValidateConsequenceFrame,
  extractJson,
} from '../llm/repairScenario';
import { mergeConsequenceFrame, stripConsequenceFrame } from '../llm/mergeConsequenceFrame';
import { runGenerationPipeline, createPipelineState } from '../llm/generateScenario';
import { ScenarioSchema } from '../scenarios/scenarioSchema';
import type { Scenario, ConsequenceFrame } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadFixture(filename: string): unknown {
  const fullPath = resolve(__dirname, '../../tests/generated-scenarios', filename);
  return JSON.parse(readFileSync(fullPath, 'utf-8'));
}

const PASS_A_SYSTEM = '# Pass A system prompt (test stub)';
const PASS_A_USER = 'Generate scenario: {{scenario_archetype}} {{phase}} {{difficulty}} {{field_zone}} {{line_group}} {{target_role_family}} {{primary_concept}} {{secondary_concepts_json_array}} {{learning_stage}} {{curriculum_group}} {{title_seed}}';
const PASS_B_SYSTEM = '# Pass B system prompt (test stub)';
const PASS_B_USER = 'Generate consequence_frame for: {{scenario_json}}';
const REPAIR_SYSTEM = '# Repair system prompt (test stub)';
const REPAIR_USER = 'Mode: {{repair_mode}}\nIssues:\n{{issues_list}}\nJSON:\n{{current_json}}';

const TEST_TEMPLATES = {
  passASystem: PASS_A_SYSTEM,
  passAUser: PASS_A_USER,
  passBSystem: PASS_B_SYSTEM,
  passBUser: PASS_B_USER,
  repairSystem: REPAIR_SYSTEM,
  repairUser: REPAIR_USER,
};

/** Minimal valid scenario that passes schema + lint for use in tests. */
const validScenario: Scenario = {
  scenario_id: 'TEST_GEN_01',
  version: 1,
  title: 'Test Midfield Support',
  description: 'A test scenario for midfield support.',
  phase: 'attack',
  team_orientation: 'home_attacks_positive_x',
  target_player: 'cm1',
  ball: { x: 48, y: 50 },
  teammates: [
    { id: 'cm1', role: 'CM', team: 'home', x: 48, y: 50 },
    { id: 'dm1', role: 'DM', team: 'home', x: 35, y: 50 },
  ],
  opponents: [
    { id: 'opp1', role: 'MF', team: 'away', x: 52, y: 50 },
  ],
  pressure: { direction: 'central', intensity: 'medium', primary_presser_id: 'opp1' },
  ideal_regions: [
    {
      label: 'support_pocket',
      purpose: 'primary_support_option',
      geometry: { type: 'circle', x: 44, y: 42, r: 8 },
    },
  ],
  acceptable_regions: [
    {
      label: 'wider_option',
      purpose: 'secondary_support_option',
      geometry: { type: 'circle', x: 46, y: 46, r: 12 },
    },
  ],
  weight_profile: 'attack_v1',
  constraint_thresholds: {},
  difficulty: 2,
  tags: ['support', 'attack'],
  line_group: 'midfield',
  primary_concept: 'support',
  secondary_concepts: ['spacing'],
  teaching_point: 'Step into the gap.',
  target_role_family: 'midfield',
  situation: 'build_out_under_press',
  field_zone: 'middle_third_central',
  game_state: 'open_play',
  scenario_archetype: 'midfield_triangle_restore',
  feedback_hints: { success: 'Good angle.', common_error: 'Too deep.' },
  correct_reasoning: ['create_passing_angle'],
};

const validConsequenceFrame: ConsequenceFrame = {
  on_success: {
    consequence_type: 'triangle_formed',
    explanation: 'Triangle restored — ball carrier has a clean pass option.',
    pressure_result: 'broken',
    shape_result: 'triangle_formed',
  },
  on_failure: {
    consequence_type: 'pressure_maintained',
    explanation: 'Press continues — ball carrier forced backward.',
    pressure_result: 'maintained',
  },
};

// ── ScenarioGenerationBrief ───────────────────────────────────────────────────

describe('ScenarioGenerationBrief', () => {
  it('accepts a well-formed brief', () => {
    const brief: ScenarioGenerationBrief = {
      scenario_archetype: 'midfield_triangle_restore',
      phase: 'attack',
      difficulty: 3,
      field_zone: 'middle_third_central',
      line_group: 'midfield',
      target_role_family: 'midfield',
      primary_concept: 'support',
      secondary_concepts: ['pressure_response', 'spacing'],
      learning_stage: 2,
      curriculum_group: 'build_out',
      title_seed: 'Restore the midfield triangle',
    };
    expect(brief.scenario_archetype).toBe('midfield_triangle_restore');
    expect(brief.difficulty).toBe(3);
  });
});

// ── buildPassAPrompt ──────────────────────────────────────────────────────────

describe('buildPassAPrompt', () => {
  const brief: ScenarioGenerationBrief = {
    scenario_archetype: 'midfield_triangle_restore',
    phase: 'attack',
    difficulty: 3,
    field_zone: 'middle_third_central',
    line_group: 'midfield',
    target_role_family: 'midfield',
    primary_concept: 'support',
    secondary_concepts: ['spacing'],
    learning_stage: 2,
    curriculum_group: 'build_out',
    title_seed: 'Restore the midfield triangle',
  };

  it('returns system and user prompts', () => {
    const { systemPrompt, userPrompt } = buildPassAPrompt(brief, PASS_A_SYSTEM, PASS_A_USER);
    expect(systemPrompt).toBe(PASS_A_SYSTEM);
    expect(userPrompt).toContain('midfield_triangle_restore');
    expect(userPrompt).toContain('attack');
    expect(userPrompt).toContain('3');
    expect(userPrompt).toContain('middle_third_central');
    expect(userPrompt).toContain('support');
  });

  it('injects secondary_concepts as JSON array', () => {
    const { userPrompt } = buildPassAPrompt(brief, PASS_A_SYSTEM, PASS_A_USER);
    expect(userPrompt).toContain('["spacing"]');
  });

  it('fills optional fields with "not specified" when absent', () => {
    const minimalBrief: ScenarioGenerationBrief = {
      scenario_archetype: 'forward_width_hold',
      phase: 'attack',
      difficulty: 1,
      field_zone: 'attacking_third_central',
      line_group: 'forward',
      target_role_family: 'forward',
      primary_concept: 'width_depth',
    };
    const { userPrompt } = buildPassAPrompt(minimalBrief, PASS_A_SYSTEM, PASS_A_USER);
    expect(userPrompt).toContain('not specified');
  });

  it('does not leave unfilled {{placeholder}} tokens', () => {
    const { userPrompt } = buildPassAPrompt(brief, PASS_A_SYSTEM, PASS_A_USER);
    expect(userPrompt).not.toMatch(/\{\{[^}]+\}\}/);
  });
});

// ── buildPassBPrompt ──────────────────────────────────────────────────────────

describe('buildPassBPrompt', () => {
  it('injects the scenario JSON into the user prompt', () => {
    const { systemPrompt, userPrompt } = buildPassBPrompt(validScenario, PASS_B_SYSTEM, PASS_B_USER);
    expect(systemPrompt).toBe(PASS_B_SYSTEM);
    expect(userPrompt).toContain('TEST_GEN_01');
    expect(userPrompt).toContain('midfield_triangle_restore');
  });

  it('strips consequence_frame before injecting (so Pass B sees a clean scenario)', () => {
    const withFrame: Scenario = { ...validScenario, consequence_frame: validConsequenceFrame };
    const { userPrompt } = buildPassBPrompt(withFrame, PASS_B_SYSTEM, PASS_B_USER);
    // The template text itself says "Generate consequence_frame for:" but the injected
    // scenario JSON should not contain the "consequence_frame" key.
    expect(userPrompt).not.toContain('"consequence_frame"');
  });
});

// ── buildRepairPrompt ─────────────────────────────────────────────────────────

describe('buildRepairPrompt', () => {
  it('injects mode, issues, and JSON into the repair prompt', () => {
    const { systemPrompt, userPrompt } = buildRepairPrompt(
      '{ "bad": "json" }',
      ['Schema error — scenario_id: Required', 'Missing scenario_archetype'],
      'scenario',
      REPAIR_SYSTEM,
      REPAIR_USER,
    );
    expect(systemPrompt).toBe(REPAIR_SYSTEM);
    expect(userPrompt).toContain('scenario');
    expect(userPrompt).toContain('Schema error');
    expect(userPrompt).toContain('Missing scenario_archetype');
    expect(userPrompt).toContain('{ "bad": "json" }');
  });

  it('uses a numbered list for issues', () => {
    const { userPrompt } = buildRepairPrompt(
      '{}',
      ['Issue one', 'Issue two'],
      'consequence_frame',
      REPAIR_SYSTEM,
      REPAIR_USER,
    );
    expect(userPrompt).toContain('1. Issue one');
    expect(userPrompt).toContain('2. Issue two');
  });

  it('handles empty issues list gracefully', () => {
    const { userPrompt } = buildRepairPrompt('{}', [], 'scenario', REPAIR_SYSTEM, REPAIR_USER);
    expect(userPrompt).toContain('no specific issues');
  });
});

// ── extractJson ──────────────────────────────────────────────────────────────

describe('extractJson', () => {
  it('parses a plain JSON string', () => {
    const result = extractJson('{"x": 1}');
    expect(result).toEqual({ x: 1 });
  });

  it('strips markdown json code fence', () => {
    const result = extractJson('```json\n{"x": 2}\n```');
    expect(result).toEqual({ x: 2 });
  });

  it('strips plain code fence', () => {
    const result = extractJson('```\n{"x": 3}\n```');
    expect(result).toEqual({ x: 3 });
  });

  it('throws on invalid JSON', () => {
    expect(() => extractJson('not json')).toThrow();
  });
});

// ── lintGeneratedScenario ─────────────────────────────────────────────────────

describe('lintGeneratedScenario', () => {
  it('passes a complete generated scenario with no errors', () => {
    const scenarioWithFrame: Scenario = { ...validScenario, consequence_frame: validConsequenceFrame };
    const { errors } = lintGeneratedScenario(scenarioWithFrame);
    expect(errors).toHaveLength(0);
  });

  it('errors on missing scenario_archetype', () => {
    const { scenario_archetype: _, ...noArchetype } = validScenario;
    const { errors } = lintGeneratedScenario(noArchetype as Scenario);
    expect(errors.some(e => e.includes('scenario_archetype'))).toBe(true);
  });

  it('errors on missing field_zone', () => {
    const { field_zone: _, ...noZone } = validScenario;
    const { errors } = lintGeneratedScenario(noZone as Scenario);
    expect(errors.some(e => e.includes('field_zone'))).toBe(true);
  });

  it('errors on missing target_role_family', () => {
    const { target_role_family: _, ...noFamily } = validScenario;
    const { errors } = lintGeneratedScenario(noFamily as Scenario);
    expect(errors.some(e => e.includes('target_role_family'))).toBe(true);
  });

  it('errors on missing consequence_frame', () => {
    const { errors } = lintGeneratedScenario(validScenario);
    expect(errors.some(e => e.includes('consequence_frame'))).toBe(true);
  });

  it('warns on missing correct_reasoning', () => {
    const { correct_reasoning: _, ...noReasoning } = validScenario;
    const withFrame: Scenario = {
      ...(noReasoning as Scenario),
      consequence_frame: validConsequenceFrame,
    };
    const { warnings } = lintGeneratedScenario(withFrame);
    expect(warnings.some(w => w.includes('correct_reasoning'))).toBe(true);
  });

  it('warns on missing secondary_concepts', () => {
    const withFrame: Scenario = {
      ...validScenario,
      secondary_concepts: undefined,
      consequence_frame: validConsequenceFrame,
    };
    const { warnings } = lintGeneratedScenario(withFrame);
    expect(warnings.some(w => w.includes('secondary_concepts'))).toBe(true);
  });

  it('errors when on_success has no board primitive', () => {
    const bareFrame: ConsequenceFrame = {
      on_success: {
        consequence_type: 'triangle_formed',
        explanation: 'Triangle formed.',
        // no arrows, shifts, pass_option_states, lane_highlight, pressure_result, shape_result
      },
    };
    const { errors } = lintGeneratedScenario({ ...validScenario, consequence_frame: bareFrame });
    expect(errors.some(e => e.includes('on_success') && e.includes('visual primitive'))).toBe(true);
  });

  it('errors when on_failure has no board primitive', () => {
    const bareFrame: ConsequenceFrame = {
      on_failure: {
        consequence_type: 'pressure_maintained',
        explanation: 'Pressure continues.',
      },
    };
    const { errors } = lintGeneratedScenario({ ...validScenario, consequence_frame: bareFrame });
    expect(errors.some(e => e.includes('on_failure') && e.includes('visual primitive'))).toBe(true);
  });

  it('warns when on_success uses a negative consequence type', () => {
    const badFrame: ConsequenceFrame = {
      on_success: {
        consequence_type: 'pass_blocked',
        explanation: 'Pass is blocked.',
        pressure_result: 'maintained',
      },
    };
    const { warnings } = lintGeneratedScenario({ ...validScenario, consequence_frame: badFrame });
    expect(warnings.some(w => w.includes('on_success') && w.includes('pass_blocked'))).toBe(true);
  });

  it('warns when on_failure uses a positive consequence type', () => {
    const badFrame: ConsequenceFrame = {
      on_failure: {
        consequence_type: 'triangle_formed',
        explanation: 'Triangle formed (on failure — suspicious).',
        pressure_result: 'broken',
      },
    };
    const { warnings } = lintGeneratedScenario({ ...validScenario, consequence_frame: badFrame });
    expect(warnings.some(w => w.includes('on_failure') && w.includes('triangle_formed'))).toBe(true);
  });

  it('warns on generic on_success explanation', () => {
    const genericFrame: ConsequenceFrame = {
      on_success: {
        consequence_type: 'triangle_formed',
        explanation: 'You are in a good position.',
        pressure_result: 'broken',
      },
    };
    const { warnings } = lintGeneratedScenario({ ...validScenario, consequence_frame: genericFrame });
    expect(warnings.some(w => w.includes('on_success') && w.includes('generic'))).toBe(true);
  });
});

// ── mergeConsequenceFrame / stripConsequenceFrame ─────────────────────────────

describe('mergeConsequenceFrame', () => {
  it('merges the consequence frame into the scenario', () => {
    const merged = mergeConsequenceFrame(validScenario, validConsequenceFrame);
    expect(merged.consequence_frame).toBe(validConsequenceFrame);
    expect(merged.scenario_id).toBe(validScenario.scenario_id);
  });

  it('does not mutate the original scenario', () => {
    mergeConsequenceFrame(validScenario, validConsequenceFrame);
    expect(validScenario.consequence_frame).toBeUndefined();
  });
});

describe('stripConsequenceFrame', () => {
  it('removes consequence_frame from a scenario that has one', () => {
    const withFrame: Scenario = { ...validScenario, consequence_frame: validConsequenceFrame };
    const stripped = stripConsequenceFrame(withFrame);
    expect('consequence_frame' in stripped).toBe(false);
  });

  it('preserves all other fields', () => {
    const withFrame: Scenario = { ...validScenario, consequence_frame: validConsequenceFrame };
    const stripped = stripConsequenceFrame(withFrame);
    expect(stripped.scenario_id).toBe(validScenario.scenario_id);
  });
});

// ── parseAndValidateScenario ──────────────────────────────────────────────────

describe('parseAndValidateScenario', () => {
  it('accepts valid generated scenario JSON', () => {
    const scenarioWithFrame: Scenario = { ...validScenario, consequence_frame: validConsequenceFrame };
    const raw = JSON.stringify(scenarioWithFrame);
    const result = parseAndValidateScenario(raw);
    expect(result.ok).toBe(true);
  });

  it('rejects non-JSON output', () => {
    const result = parseAndValidateScenario('This is not JSON at all.');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0]).toMatch(/not valid JSON/);
  });

  it('rejects output wrapped in markdown code fence', () => {
    const result = parseAndValidateScenario('```json\n{"not": "a scenario"}\n```');
    expect(result.ok).toBe(false);
  });

  it('accepts JSON wrapped in markdown code fence if content is valid', () => {
    const scenarioWithFrame: Scenario = { ...validScenario, consequence_frame: validConsequenceFrame };
    const raw = '```json\n' + JSON.stringify(scenarioWithFrame) + '\n```';
    const result = parseAndValidateScenario(raw);
    expect(result.ok).toBe(true);
  });

  it('returns issues for a scenario missing scenario_archetype (generated-content error)', () => {
    const noArchetype = { ...validScenario, consequence_frame: validConsequenceFrame };
    delete (noArchetype as Partial<Scenario>).scenario_archetype;
    const raw = JSON.stringify(noArchetype);
    const result = parseAndValidateScenario(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some(i => i.includes('scenario_archetype'))).toBe(true);
    }
  });
});

// ── parseAndValidateConsequenceFrame ─────────────────────────────────────────

describe('parseAndValidateConsequenceFrame', () => {
  it('accepts a valid consequence frame JSON', () => {
    const raw = JSON.stringify(validConsequenceFrame);
    const result = parseAndValidateConsequenceFrame(raw, validScenario);
    expect(result.ok).toBe(true);
  });

  it('rejects non-JSON output', () => {
    const result = parseAndValidateConsequenceFrame('not JSON', validScenario);
    expect(result.ok).toBe(false);
  });

  it('rejects an entity ID not in the scenario', () => {
    const badFrame: ConsequenceFrame = {
      on_success: {
        consequence_type: 'pass_opened',
        explanation: 'Pass opens.',
        arrows: [{ style: 'pass', from_entity_id: 'unknown_id', to_entity_id: 'cm1' }],
      },
    };
    const result = parseAndValidateConsequenceFrame(JSON.stringify(badFrame), validScenario);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some(i => i.includes('unknown_id'))).toBe(true);
    }
  });

  it('accepts "ball" as a valid entity reference', () => {
    const frameWithBall: ConsequenceFrame = {
      on_success: {
        consequence_type: 'pass_opened',
        explanation: 'Pass opens to ball carrier.',
        arrows: [{ style: 'pass', from_entity_id: 'ball', to_entity_id: 'cm1' }],
      },
    };
    const result = parseAndValidateConsequenceFrame(JSON.stringify(frameWithBall), validScenario);
    expect(result.ok).toBe(true);
  });

  it('errors when on_success has no board primitive', () => {
    const bareFrame: ConsequenceFrame = {
      on_success: {
        consequence_type: 'triangle_formed',
        explanation: 'Triangle restored.',
      },
    };
    const result = parseAndValidateConsequenceFrame(JSON.stringify(bareFrame), validScenario);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some(i => i.includes('visual primitive'))).toBe(true);
    }
  });
});

// ── createPipelineState ───────────────────────────────────────────────────────

describe('createPipelineState', () => {
  it('initialises all state fields to null/empty', () => {
    const brief: ScenarioGenerationBrief = {
      scenario_archetype: 'midfield_triangle_restore',
      phase: 'attack',
      difficulty: 2,
      field_zone: 'middle_third_central',
      line_group: 'midfield',
      target_role_family: 'midfield',
      primary_concept: 'support',
    };
    const state = createPipelineState(brief);
    expect(state.passARawOutput).toBeNull();
    expect(state.acceptedScenario).toBeNull();
    expect(state.finalScenario).toBeNull();
    expect(state.errors).toHaveLength(0);
    expect(state.repairAttempts).toBe(0);
  });
});

// ── runGenerationPipeline ─────────────────────────────────────────────────────

describe('runGenerationPipeline', () => {
  const brief: ScenarioGenerationBrief = {
    scenario_archetype: 'midfield_triangle_restore',
    phase: 'attack',
    difficulty: 3,
    field_zone: 'middle_third_central',
    line_group: 'midfield',
    target_role_family: 'midfield',
    primary_concept: 'support',
    secondary_concepts: ['spacing'],
  };

  it('succeeds when model returns valid scenario and valid consequence frame', async () => {
    const scenarioWithoutFrame = { ...validScenario };
    delete (scenarioWithoutFrame as Partial<Scenario>).consequence_frame;

    const mockModel = vi
      .fn()
      .mockResolvedValueOnce(JSON.stringify(scenarioWithoutFrame))
      .mockResolvedValueOnce(JSON.stringify(validConsequenceFrame));

    const result = await runGenerationPipeline(brief, mockModel, TEST_TEMPLATES);
    expect(result.scenario_id).toBe(validScenario.scenario_id);
    expect(result.consequence_frame).toBeDefined();
    expect(mockModel).toHaveBeenCalledTimes(2);
  });

  it('invokes repair for Pass A and succeeds on the repaired output', async () => {
    const badOutput = '{"not": "a scenario"}';
    const scenarioWithoutFrame = { ...validScenario };
    delete (scenarioWithoutFrame as Partial<Scenario>).consequence_frame;

    const mockModel = vi
      .fn()
      .mockResolvedValueOnce(badOutput)          // Pass A — bad
      .mockResolvedValueOnce(JSON.stringify(scenarioWithoutFrame))  // Repair — good
      .mockResolvedValueOnce(JSON.stringify(validConsequenceFrame));  // Pass B

    const result = await runGenerationPipeline(brief, mockModel, TEST_TEMPLATES, { maxRepairAttempts: 2 });
    expect(result.consequence_frame).toBeDefined();
    expect(mockModel).toHaveBeenCalledTimes(3);
  });

  it('throws after exhausting repair attempts for Pass A', async () => {
    const badOutput = '{"not": "a scenario"}';
    const mockModel = vi.fn().mockResolvedValue(badOutput);

    await expect(
      runGenerationPipeline(brief, mockModel, TEST_TEMPLATES, { maxRepairAttempts: 1 }),
    ).rejects.toThrow(/Pass A failed/);
  });

  it('throws after exhausting repair attempts for Pass B', async () => {
    const scenarioWithoutFrame = { ...validScenario };
    delete (scenarioWithoutFrame as Partial<Scenario>).consequence_frame;

    const badFrame = '{"not": "a consequence_frame"}';
    const mockModel = vi
      .fn()
      .mockResolvedValueOnce(JSON.stringify(scenarioWithoutFrame))  // Pass A — good
      .mockResolvedValue(badFrame);                                  // Pass B — always bad

    await expect(
      runGenerationPipeline(brief, mockModel, TEST_TEMPLATES, { maxRepairAttempts: 1 }),
    ).rejects.toThrow(/Pass B failed/);
  });
});

// ── Fixture files ─────────────────────────────────────────────────────────────

describe('Fixture: valid_midfield_triangle.json', () => {
  const raw = loadFixture('valid_midfield_triangle.json');

  it('passes Zod schema validation', () => {
    const result = ScenarioSchema.safeParse(raw);
    if (!result.success) {
      console.error('Schema errors:', result.error.issues);
    }
    expect(result.success).toBe(true);
  });

  it('passes generated-content lint with no errors', () => {
    const parseResult = ScenarioSchema.safeParse(raw);
    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      const { errors } = lintGeneratedScenario(parseResult.data as Scenario);
      expect(errors).toHaveLength(0);
    }
  });

  it('has a consequence_frame with at least one board primitive per branch', () => {
    const parseResult = ScenarioSchema.safeParse(raw);
    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      const scenario = parseResult.data as Scenario;
      expect(scenario.consequence_frame).toBeDefined();
      expect(scenario.consequence_frame?.on_success?.pressure_result).toBeDefined();
      expect(scenario.consequence_frame?.on_failure?.pressure_result).toBeDefined();
    }
  });
});

describe('Fixture: invalid_missing_archetype.json', () => {
  const raw = loadFixture('invalid_missing_archetype.json');

  it('passes Zod schema validation (archetype is optional in schema)', () => {
    const result = ScenarioSchema.safeParse(raw);
    expect(result.success).toBe(true);
  });

  it('fails generated-content lint due to missing scenario_archetype', () => {
    const parseResult = ScenarioSchema.safeParse(raw);
    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      const { errors } = lintGeneratedScenario(parseResult.data as Scenario);
      expect(errors.some(e => e.includes('scenario_archetype'))).toBe(true);
    }
  });

  it('fails generated-content lint due to missing consequence_frame', () => {
    const parseResult = ScenarioSchema.safeParse(raw);
    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      const { errors } = lintGeneratedScenario(parseResult.data as Scenario);
      expect(errors.some(e => e.includes('consequence_frame'))).toBe(true);
    }
  });
});
