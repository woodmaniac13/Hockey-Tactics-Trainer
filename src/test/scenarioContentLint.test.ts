// @vitest-environment node
/**
 * Content lint test for authored scenario files.
 *
 * This test runs against the actual JSON files in public/scenarios/ and enforces
 * both schema validation and content-level authoring quality rules.
 *
 * - Schema failures and content lint **errors** fail the test suite.
 * - Content lint **warnings** are advisory — they are logged for human review
 *   but do not block test passage.
 *
 * The test environment is set to 'node' (via the @vitest-environment comment
 * above) so that Node's `fs` module can be used to read scenario files directly
 * without any jsdom interference.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ScenarioSchema } from '../scenarios/scenarioSchema';
import { lintScenario } from '../scenarios/scenarioLint';
import type { Scenario } from '../types';

const SCENARIOS_DIR = path.resolve(process.cwd(), 'public/scenarios');

/** Recursively collect all .json file paths under a directory. */
function walkDir(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      results.push(fullPath);
    }
  }
  return results;
}

// ── File discovery ────────────────────────────────────────────────────────────

const scenarioFiles = walkDir(SCENARIOS_DIR);

// ── All-files checks ──────────────────────────────────────────────────────────

describe('scenario content lint — all authored scenarios', () => {
  it('finds at least one scenario file to validate', () => {
    expect(scenarioFiles.length).toBeGreaterThan(0);
  });

  it('all scenario files pass schema validation', () => {
    const failures: string[] = [];

    for (const filePath of scenarioFiles) {
      const relPath = path.relative(SCENARIOS_DIR, filePath);
      const raw: unknown = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const result = ScenarioSchema.safeParse(raw);
      if (!result.success) {
        const messages = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
        failures.push(`${relPath}:\n  ${messages.join('\n  ')}`);
      }
    }

    expect(
      failures,
      `Schema validation failures:\n${failures.join('\n')}`,
    ).toHaveLength(0);
  });

  it('all scenario files pass content lint (no errors)', () => {
    const allErrors: string[] = [];

    for (const filePath of scenarioFiles) {
      const raw: unknown = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const parseResult = ScenarioSchema.safeParse(raw);
      if (!parseResult.success) continue; // schema failures reported separately

      const { errors } = lintScenario(parseResult.data);
      allErrors.push(...errors);
    }

    expect(
      allErrors,
      `Content lint errors:\n${allErrors.join('\n')}`,
    ).toHaveLength(0);
  });

  it('reports content lint warnings for human review (non-blocking)', () => {
    const allWarnings: string[] = [];

    for (const filePath of scenarioFiles) {
      const raw: unknown = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const parseResult = ScenarioSchema.safeParse(raw);
      if (!parseResult.success) continue;

      const { warnings } = lintScenario(parseResult.data);
      allWarnings.push(...warnings);
    }

    // Warnings do not fail the test — they are logged for human review.
    if (allWarnings.length > 0) {
      console.warn(
        `\n⚠  Content lint warnings (advisory only — not blocking):\n${allWarnings.join('\n')}\n`,
      );
    }

    // This test always passes — it exists to surface warnings in CI output.
    expect(true).toBe(true);
  });
});

// ── Unit checks for lintScenario ─────────────────────────────────────────────

describe('lintScenario — unit checks using S01 as base', () => {
  /** Load and parse S01 as a well-formed base scenario for mutation tests. */
  function loadS01(): Scenario {
    const raw: unknown = JSON.parse(
      fs.readFileSync(path.join(SCENARIOS_DIR, 'build-out/S01.json'), 'utf-8'),
    );
    return ScenarioSchema.parse(raw);
  }

  it('returns no errors for a fully-authored scenario (S01)', () => {
    const { errors } = lintScenario(loadS01());
    expect(errors).toHaveLength(0);
  });

  it('errors when line_group is missing', () => {
    const scenario = { ...loadS01(), line_group: undefined } as Scenario;
    const { errors } = lintScenario(scenario);
    expect(errors.some(e => e.includes('line_group'))).toBe(true);
  });

  it('errors when primary_concept is missing', () => {
    const scenario = { ...loadS01(), primary_concept: undefined } as Scenario;
    const { errors } = lintScenario(scenario);
    expect(errors.some(e => e.includes('primary_concept'))).toBe(true);
  });

  it('errors when situation is missing', () => {
    const scenario = { ...loadS01(), situation: undefined } as Scenario;
    const { errors } = lintScenario(scenario);
    expect(errors.some(e => e.includes('situation'))).toBe(true);
  });

  it('errors when teaching_point is missing', () => {
    const scenario = { ...loadS01(), teaching_point: undefined } as Scenario;
    const { errors } = lintScenario(scenario);
    expect(errors.some(e => e.includes('teaching_point'))).toBe(true);
  });

  it('errors when feedback_hints.success is missing', () => {
    const scenario = {
      ...loadS01(),
      feedback_hints: { common_error: 'Some error tip.' },
    } as Scenario;
    const { errors } = lintScenario(scenario);
    expect(errors.some(e => e.includes('feedback_hints.success'))).toBe(true);
  });

  it('errors when feedback_hints.common_error is missing', () => {
    const scenario = {
      ...loadS01(),
      feedback_hints: { success: 'Well done.' },
    } as Scenario;
    const { errors } = lintScenario(scenario);
    expect(errors.some(e => e.includes('feedback_hints.common_error'))).toBe(true);
  });

  it('errors when any region uses raw geometry instead of a semantic wrapper', () => {
    const scenario = {
      ...loadS01(),
      ideal_regions: [{ type: 'circle' as const, x: 50, y: 50, r: 10 }],
    } as Scenario;
    const { errors } = lintScenario(scenario);
    expect(errors.some(e => e.includes('raw geometry'))).toBe(true);
  });

  it('errors when target_player is not in teammates', () => {
    const scenario = { ...loadS01(), target_player: 'nonexistent_player' } as Scenario;
    const { errors } = lintScenario(scenario);
    expect(errors.some(e => e.includes('target_player'))).toBe(true);
  });

  it('errors when teammate IDs contain a duplicate', () => {
    const base = loadS01();
    const scenario = {
      ...base,
      teammates: [
        ...base.teammates,
        { ...base.teammates[0]! }, // duplicate first teammate
      ],
    } as Scenario;
    const { errors } = lintScenario(scenario);
    expect(errors.some(e => e.includes('Duplicate entity IDs'))).toBe(true);
  });

  it('errors when scenario_archetype is inconsistent with phase', () => {
    // S01 is phase: attack — help_side_cover requires phase: defence
    const scenario = {
      ...loadS01(),
      scenario_archetype: 'help_side_cover' as const,
    } as Scenario;
    const { errors } = lintScenario(scenario);
    expect(errors.some(e => e.includes('scenario_archetype'))).toBe(true);
  });

  it('errors when scenario_archetype is inconsistent with primary_concept', () => {
    // forward_width_hold requires primary_concept in [width_depth, support]
    // S01 has primary_concept: support — change to cover to trigger conflict with forward_width_hold
    const scenario = {
      ...loadS01(),
      scenario_archetype: 'forward_width_hold' as const,
      line_group: 'forward' as const,
      primary_concept: 'cover' as const,
    } as Scenario;
    const { errors } = lintScenario(scenario);
    expect(errors.some(e => e.includes('scenario_archetype'))).toBe(true);
  });

  it('errors when scenario_archetype is inconsistent with line_group', () => {
    // fullback_escape_option requires line_group: back
    // S01 has line_group: midfield — this should conflict
    const scenario = {
      ...loadS01(),
      scenario_archetype: 'fullback_escape_option' as const,
    } as Scenario;
    const { errors } = lintScenario(scenario);
    expect(errors.some(e => e.includes('scenario_archetype'))).toBe(true);
  });

  it('warns when scenario_archetype is missing', () => {
    const scenario = { ...loadS01(), scenario_archetype: undefined } as Scenario;
    const { warnings } = lintScenario(scenario);
    expect(warnings.some(w => w.includes('scenario_archetype'))).toBe(true);
  });

  it('warns when an entity role is outside the canonical vocabulary', () => {
    const base = loadS01();
    const scenario = {
      ...base,
      opponents: [
        ...base.opponents,
        { id: 'extra1', role: 'striker', team: 'away' as const, x: 70, y: 40 },
      ],
    } as Scenario;
    const { warnings } = lintScenario(scenario);
    expect(warnings.some(w => w.includes('canonical vocabulary'))).toBe(true);
  });

  it('warns when forced_side is missing with high-intensity directional pressure', () => {
    const scenario = {
      ...loadS01(),
      pressure: { direction: 'outside_in' as const, intensity: 'high' as const },
    } as Scenario;
    const { warnings } = lintScenario(scenario);
    expect(warnings.some(w => w.includes('forced_side'))).toBe(true);
  });

  it('does NOT warn about forced_side when pressure direction is none', () => {
    const scenario = {
      ...loadS01(),
      pressure: { direction: 'none' as const, intensity: 'high' as const },
    } as Scenario;
    const { warnings } = lintScenario(scenario);
    expect(warnings.every(w => !w.includes('forced_side'))).toBe(true);
  });

  it('warns when recommended_after is missing for learning_stage > 1', () => {
    const scenario = {
      ...loadS01(),
      learning_stage: 3,
      recommended_after: undefined,
    } as Scenario;
    const { warnings } = lintScenario(scenario);
    expect(warnings.some(w => w.includes('recommended_after'))).toBe(true);
  });

  it('does NOT warn about recommended_after when learning_stage is 1', () => {
    const scenario = {
      ...loadS01(),
      learning_stage: 1,
      recommended_after: undefined,
    } as Scenario;
    const { warnings } = lintScenario(scenario);
    expect(warnings.every(w => !w.includes('recommended_after'))).toBe(true);
  });
});

// ── Consequence frame lint checks ─────────────────────────────────────────────

describe('lintScenario — consequence_frame checks', () => {
  function loadS01(): Scenario {
    const raw: unknown = JSON.parse(
      fs.readFileSync(path.join(SCENARIOS_DIR, 'build-out/S01.json'), 'utf-8'),
    );
    return ScenarioSchema.parse(raw);
  }

  it('returns no errors for S01 with its authored consequence_frame', () => {
    const { errors } = lintScenario(loadS01());
    expect(errors).toHaveLength(0);
  });

  it('errors when on_success.arrows references an unknown entity in from_entity_id', () => {
    const base = loadS01();
    const scenario: Scenario = {
      ...base,
      consequence_frame: {
        on_success: {
          consequence_type: 'pass_opened',
          explanation: 'Test consequence.',
          arrows: [{ style: 'pass', from_entity_id: 'nonexistent', to_entity_id: 'cm1' }],
        },
      },
    };
    const { errors } = lintScenario(scenario);
    expect(errors.some(e => e.includes('nonexistent') && e.includes('from_entity_id'))).toBe(true);
  });

  it('errors when on_success.arrows references an unknown entity in to_entity_id', () => {
    const base = loadS01();
    const scenario: Scenario = {
      ...base,
      consequence_frame: {
        on_success: {
          consequence_type: 'pass_opened',
          explanation: 'Test consequence.',
          arrows: [{ style: 'pass', from_entity_id: 'gk', to_entity_id: 'ghost_player' }],
        },
      },
    };
    const { errors } = lintScenario(scenario);
    expect(errors.some(e => e.includes('ghost_player') && e.includes('to_entity_id'))).toBe(true);
  });

  it('accepts "ball" as a valid entity ID in arrow endpoints', () => {
    const base = loadS01();
    const scenario: Scenario = {
      ...base,
      consequence_frame: {
        on_success: {
          consequence_type: 'pass_opened',
          explanation: 'Test consequence.',
          arrows: [{ style: 'pass', from_entity_id: 'ball', to_entity_id: 'cm1' }],
        },
      },
    };
    const { errors } = lintScenario(scenario);
    expect(errors.every(e => !e.includes('ball'))).toBe(true);
  });

  it('errors when on_failure.entity_shifts references an unknown entity', () => {
    const base = loadS01();
    const scenario: Scenario = {
      ...base,
      consequence_frame: {
        on_failure: {
          consequence_type: 'pressure_maintained',
          explanation: 'Press held.',
          entity_shifts: [{ entity_id: 'unknown_id', to_x: 30, to_y: 50 }],
        },
      },
    };
    const { errors } = lintScenario(scenario);
    expect(errors.some(e => e.includes('unknown_id'))).toBe(true);
  });

  it('errors when pass_option_states references an unknown entity in from_entity_id', () => {
    const base = loadS01();
    const scenario: Scenario = {
      ...base,
      consequence_frame: {
        on_success: {
          consequence_type: 'pass_opened',
          explanation: 'Test.',
          pass_option_states: [{ from_entity_id: 'ghost', to_entity_id: 'cm1', state: 'open' }],
        },
      },
    };
    const { errors } = lintScenario(scenario);
    expect(errors.some(e => e.includes('ghost') && e.includes('from_entity_id'))).toBe(true);
  });

  it('warns when on_success.explanation exceeds 200 characters', () => {
    const base = loadS01();
    const longExplanation = 'A'.repeat(201);
    const scenario: Scenario = {
      ...base,
      consequence_frame: {
        on_success: {
          consequence_type: 'pass_opened',
          explanation: longExplanation,
        },
      },
    };
    const { warnings } = lintScenario(scenario);
    expect(warnings.some(w => w.includes('200 characters'))).toBe(true);
  });

  it('does NOT warn when explanation is exactly 200 characters', () => {
    const base = loadS01();
    const scenario: Scenario = {
      ...base,
      consequence_frame: {
        on_success: {
          consequence_type: 'pass_opened',
          explanation: 'A'.repeat(200),
        },
      },
    };
    const { warnings } = lintScenario(scenario);
    expect(warnings.every(w => !w.includes('200 characters'))).toBe(true);
  });

  it('warns when on_success has more than 3 arrows', () => {
    const base = loadS01();
    const scenario: Scenario = {
      ...base,
      consequence_frame: {
        on_success: {
          consequence_type: 'pass_opened',
          explanation: 'Test.',
          arrows: [
            { style: 'pass', from_entity_id: 'gk', to_entity_id: 'cm1' },
            { style: 'run', from_entity_id: 'cm1', to_point: { x: 40, y: 50 } },
            { style: 'run', from_entity_id: 'cb1', to_point: { x: 25, y: 40 } },
            { style: 'cover_shift', from_entity_id: 'fw1', to_point: { x: 65, y: 45 } },
          ],
        },
      },
    };
    const { warnings } = lintScenario(scenario);
    expect(warnings.some(w => w.includes('arrows') && w.includes('3'))).toBe(true);
  });

  it('warns when entity_shifts has more than 2 entries', () => {
    const base = loadS01();
    const scenario: Scenario = {
      ...base,
      consequence_frame: {
        on_success: {
          consequence_type: 'triangle_formed',
          explanation: 'Test.',
          entity_shifts: [
            { entity_id: 'cm1', to_x: 30, to_y: 55 },
            { entity_id: 'cb1', to_x: 20, to_y: 40 },
            { entity_id: 'fw1', to_x: 70, to_y: 50 },
          ],
        },
      },
    };
    const { warnings } = lintScenario(scenario);
    expect(warnings.some(w => w.includes('entity_shifts') && w.includes('2'))).toBe(true);
  });

  it('warns when on_success uses a negative consequence_type', () => {
    const base = loadS01();
    const scenario: Scenario = {
      ...base,
      consequence_frame: {
        on_success: {
          consequence_type: 'pressure_maintained',
          explanation: 'Press was maintained despite correct positioning.',
        },
      },
    };
    const { warnings } = lintScenario(scenario);
    expect(warnings.some(w => w.includes('negative outcome type'))).toBe(true);
  });

  it('does NOT warn for on_failure using a negative consequence_type', () => {
    const base = loadS01();
    const scenario: Scenario = {
      ...base,
      consequence_frame: {
        on_failure: {
          consequence_type: 'pressure_maintained',
          explanation: 'Press held.',
        },
      },
    };
    const { warnings } = lintScenario(scenario);
    expect(warnings.every(w => !w.includes('negative outcome type'))).toBe(true);
  });

  it('warns when on_success pressure_result is "maintained"', () => {
    const base = loadS01();
    const scenario: Scenario = {
      ...base,
      consequence_frame: {
        on_success: {
          consequence_type: 'pass_opened',
          explanation: 'Pass opens despite pressure remaining.',
          pressure_result: 'maintained',
        },
      },
    };
    const { warnings } = lintScenario(scenario);
    expect(warnings.some(w => w.includes('pressure_result') && w.includes('maintained'))).toBe(true);
  });

  it('no errors or warnings for a minimal valid consequence_frame', () => {
    const base = loadS01();
    const scenario: Scenario = {
      ...base,
      consequence_frame: {
        on_success: {
          consequence_type: 'pass_opened',
          explanation: 'Short valid explanation.',
        },
      },
    };
    const { errors, warnings } = lintScenario(scenario);
    // No consequence-specific errors
    expect(errors.filter(e => e.includes('consequence_frame'))).toHaveLength(0);
    // No consequence-specific warnings
    expect(warnings.filter(w => w.includes('consequence_frame'))).toHaveLength(0);
  });
});
