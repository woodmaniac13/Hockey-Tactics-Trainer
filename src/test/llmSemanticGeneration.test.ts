import { describe, it, expect } from 'vitest';
import { EntitySchema, SemanticRegionSchema, ScenarioSchema } from '../scenarios/scenarioSchema';
import { ScenarioIntentSchema, intentToScenario } from '../scenarios/scenarioIntent';
import { isSemanticRegion, resolveRegionGeometry } from '../utils/regions';
import { lintScenario } from '../scenarios/scenarioLint';
import type { Scenario, SemanticRegion, TacticalRegion } from '../types';

// ── Shared test fixture ───────────────────────────────────────────────────────

const baseScenario: Scenario = {
  scenario_id: 'TEST',
  version: 1,
  title: 'Test',
  description: '',
  phase: 'attack',
  team_orientation: 'home_attacks_positive_x',
  target_player: 'p1',
  ball: { x: 40, y: 60 },
  teammates: [
    { id: 'p1', role: 'CM', team: 'home', x: 55, y: 45 },
    { id: 'p2', role: 'CB', team: 'home', x: 20, y: 30 },
  ],
  opponents: [{ id: 'opp1', role: 'FW', team: 'away', x: 50, y: 50 }],
  pressure: { direction: 'none', intensity: 'low' },
  ideal_regions: [],
  acceptable_regions: [],
  weight_profile: 'test_v1',
  constraint_thresholds: {},
  difficulty: 1,
  tags: [],
};

// ── Phase C: position_hint on Entity ─────────────────────────────────────────

describe('EntitySchema — position_hint', () => {
  it('accepts an entity without position_hint', () => {
    const entity = { id: 'p1', role: 'CM', team: 'home', x: 38, y: 50 };
    expect(EntitySchema.safeParse(entity).success).toBe(true);
  });

  it('accepts an entity with a valid position_hint string', () => {
    const entity = { id: 'p1', role: 'CM', team: 'home', x: 38, y: 50, position_hint: 'cm_own_half_central' };
    expect(EntitySchema.safeParse(entity).success).toBe(true);
  });

  it('rejects position_hint: null (must be string or absent)', () => {
    const entity = { id: 'p1', role: 'CM', team: 'home', x: 38, y: 50, position_hint: null };
    expect(EntitySchema.safeParse(entity).success).toBe(false);
  });

  it('rejects unknown extra fields even with position_hint', () => {
    const entity = { id: 'p1', role: 'CM', team: 'home', x: 38, y: 50, position_hint: 'cm_own_half_central', unknown: true };
    expect(EntitySchema.safeParse(entity).success).toBe(false);
  });
});

// ── Phase C: position_hint lint deviation check ───────────────────────────────

describe('scenarioLint — position_hint deviation', () => {
  const scenarioWithHint = (x: number, y: number, hint: string): Scenario => ({
    ...baseScenario,
    line_group: 'midfield',
    primary_concept: 'support',
    situation: 'settled_attack',
    teaching_point: 'Test',
    scenario_archetype: 'midfield_triangle_restore',
    feedback_hints: { success: 'Good', common_error: 'Bad' },
    teammates: [
      { id: 'p1', role: 'CM', team: 'home', x, y, position_hint: hint },
      { id: 'p2', role: 'CB', team: 'home', x: 20, y: 30 },
    ],
    ideal_regions: [
      { label: 'test', purpose: 'primary_support_option', geometry: { type: 'circle', x: 40, y: 40, r: 10 } },
    ],
  });

  it('no warning when position_hint is close to anchor', () => {
    // cm_own_half_central anchor is {x:38, y:50}; entity at {x:38, y:50} → deviation=0
    const { warnings } = lintScenario(scenarioWithHint(38, 50, 'cm_own_half_central'));
    const hintWarnings = warnings.filter(w => w.includes('position_hint'));
    expect(hintWarnings).toHaveLength(0);
  });

  it('warns when position_hint deviates > 15 units from anchor', () => {
    // cm_own_half_central anchor is {x:38, y:50}; entity at {x:15, y:22} → deviation ≈ 34
    const { warnings } = lintScenario(scenarioWithHint(15, 22, 'cm_own_half_central'));
    const hintWarnings = warnings.filter(w => w.includes('position_hint'));
    expect(hintWarnings.length).toBeGreaterThan(0);
    expect(hintWarnings[0]).toContain('p1');
    expect(hintWarnings[0]).toContain('cm_own_half_central');
  });

  it('warns when position_hint key is not in CANONICAL_POSITION_ANCHORS', () => {
    const { warnings } = lintScenario(scenarioWithHint(38, 50, 'not_a_real_hint'));
    const hintWarnings = warnings.filter(w => w.includes('position_hint'));
    expect(hintWarnings.length).toBeGreaterThan(0);
    expect(hintWarnings[0]).toContain('not_a_real_hint');
  });
});

// ── Phase D: named_zone on SemanticRegion ─────────────────────────────────────

describe('SemanticRegionSchema — named_zone', () => {
  it('accepts a region with only named_zone (no geometry)', () => {
    const region = {
      label: 'central_cover',
      purpose: 'defensive_cover',
      named_zone: 'central_cover_shadow',
    };
    expect(SemanticRegionSchema.safeParse(region).success).toBe(true);
  });

  it('accepts a region with both named_zone and geometry', () => {
    const region = {
      label: 'test',
      purpose: 'primary_support_option',
      named_zone: 'left_midfield_triangle_slot',
      geometry: { type: 'circle', x: 42, y: 28, r: 8 },
    };
    expect(SemanticRegionSchema.safeParse(region).success).toBe(true);
  });

  it('rejects a region with neither geometry nor named_zone', () => {
    const region = {
      label: 'missing_both',
      purpose: 'primary_support_option',
      reference_frame: 'pitch',
    };
    const result = SemanticRegionSchema.safeParse(region);
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues[0]?.message;
      expect(msg).toMatch(/geometry.*named_zone|named_zone.*geometry/);
    }
  });

  it('preserves named_zone in parsed output', () => {
    const region = { named_zone: 'gk_distribution_area' };
    const result = SemanticRegionSchema.safeParse(region);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.named_zone).toBe('gk_distribution_area');
      expect(result.data.geometry).toBeUndefined();
    }
  });
});

// ── Phase D: isSemanticRegion with named_zone ─────────────────────────────────

describe('isSemanticRegion — named_zone support', () => {
  it('returns true for a region with only named_zone', () => {
    const region: TacticalRegion = { named_zone: 'central_cover_shadow' } as SemanticRegion;
    expect(isSemanticRegion(region)).toBe(true);
  });

  it('returns true for a region with named_zone and no geometry', () => {
    const region: TacticalRegion = {
      label: 'test',
      purpose: 'defensive_cover',
      named_zone: 'central_cover_shadow',
    } as SemanticRegion;
    expect(isSemanticRegion(region)).toBe(true);
  });
});

// ── Phase D: resolveRegionGeometry with named_zone ────────────────────────────

describe('resolveRegionGeometry — named_zone', () => {
  it('resolves a named_zone to its NAMED_PITCH_ZONES geometry', () => {
    const region: TacticalRegion = {
      label: 'cover',
      purpose: 'defensive_cover',
      named_zone: 'central_cover_shadow',
    } as SemanticRegion;
    const result = resolveRegionGeometry(region, baseScenario);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('circle');
    if (result!.type === 'circle') {
      expect(result!.x).toBe(42);
      expect(result!.y).toBe(50);
    }
  });

  it('returns null for a semantic region with neither geometry nor named_zone', () => {
    // A region with named_zone key present (even as undefined) is semantic;
    // when both geometry and named_zone resolve to undefined, result is null.
    const region = { label: 'no_geo', named_zone: undefined } as SemanticRegion;
    const result = resolveRegionGeometry(region, baseScenario);
    expect(result).toBeNull();
  });

  it('prefers explicit geometry over named_zone when both are present', () => {
    const region: TacticalRegion = {
      label: 'override',
      named_zone: 'gk_distribution_area',
      geometry: { type: 'circle', x: 10, y: 20, r: 5 },
    } as SemanticRegion;
    const result = resolveRegionGeometry(region, baseScenario);
    expect(result).toEqual({ type: 'circle', x: 10, y: 20, r: 5 });
  });

  it('resolves named_zone through ball-relative reference_frame', () => {
    // named_zone central_midfield_triangle_slot is a circle at (45, 50)
    // With reference_frame: ball (ball is at x=40, y=60), the result should be translated:
    // (45+40, 50+60) = (85, 110) — note: no clamping, offset arithmetic only
    const region: TacticalRegion = {
      label: 'ball_relative',
      purpose: 'primary_support_option',
      reference_frame: 'ball',
      named_zone: 'central_midfield_triangle_slot',
    } as SemanticRegion;
    const result = resolveRegionGeometry(region, baseScenario);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('circle');
  });

  it('returns null for unknown named_zone', () => {
    const region = {
      label: 'test',
      named_zone: 'nonexistent_zone_key',
    } as SemanticRegion;
    const result = resolveRegionGeometry(region, baseScenario);
    expect(result).toBeNull();
  });
});

// ── Phase B: field_zone vs. ball x-axis lint check ────────────────────────────

describe('scenarioLint — field_zone vs ball x-axis check', () => {
  const scenarioWithFieldZone = (ballX: number, fieldZone: string): Scenario => ({
    ...baseScenario,
    ball: { x: ballX, y: 50 },
    field_zone: fieldZone as Scenario['field_zone'],
    line_group: 'midfield',
    primary_concept: 'support',
    situation: 'settled_attack',
    teaching_point: 'Test',
    feedback_hints: { success: 'Good', common_error: 'Bad' },
    ideal_regions: [
      { label: 'test', purpose: 'primary_support_option', geometry: { type: 'circle', x: 40, y: 40, r: 10 } },
    ],
  });

  it('no error when ball x matches field_zone third', () => {
    const { errors } = lintScenario(scenarioWithFieldZone(5, 'defensive_third_central'));
    const zoneErrors = errors.filter(e => e.includes('field_zone'));
    expect(zoneErrors).toHaveLength(0);
  });

  it('errors when ball is in attacking third but field_zone is defensive', () => {
    const { errors } = lintScenario(scenarioWithFieldZone(75, 'defensive_third_central'));
    const zoneErrors = errors.filter(e => e.includes('field_zone'));
    expect(zoneErrors.length).toBeGreaterThan(0);
    expect(zoneErrors[0]).toContain('x=75');
  });

  it('no error for ball at x=50 with middle_third_central', () => {
    const { errors } = lintScenario(scenarioWithFieldZone(50, 'middle_third_central'));
    const zoneErrors = errors.filter(e => e.includes('field_zone'));
    expect(zoneErrors).toHaveLength(0);
  });
});

// ── Phase B: entity spread check ─────────────────────────────────────────────

describe('scenarioLint — entity spread check', () => {
  it('warns when all teammates are clustered within 15 units', () => {
    const clustered: Scenario = {
      ...baseScenario,
      line_group: 'midfield',
      primary_concept: 'support',
      situation: 'settled_attack',
      teaching_point: 'Test',
      feedback_hints: { success: 'Good', common_error: 'Bad' },
      teammates: [
        { id: 'p1', role: 'CM', team: 'home', x: 40, y: 40 },
        { id: 'p2', role: 'CM', team: 'home', x: 42, y: 42 },
        { id: 'p3', role: 'CM', team: 'home', x: 43, y: 43 },
      ],
      ideal_regions: [
        { label: 'test', purpose: 'primary_support_option', geometry: { type: 'circle', x: 40, y: 40, r: 10 } },
      ],
    };
    const { warnings } = lintScenario(clustered);
    const spreadWarnings = warnings.filter(w => w.includes('within') && w.includes('units'));
    expect(spreadWarnings.length).toBeGreaterThan(0);
  });

  it('no spread warning when teammates are spread out', () => {
    const spread: Scenario = {
      ...baseScenario,
      line_group: 'midfield',
      primary_concept: 'support',
      situation: 'settled_attack',
      teaching_point: 'Test',
      feedback_hints: { success: 'Good', common_error: 'Bad' },
      teammates: [
        { id: 'p1', role: 'GK', team: 'home', x: 3, y: 50 },
        { id: 'p2', role: 'CB', team: 'home', x: 18, y: 50 },
        { id: 'p3', role: 'FW', team: 'home', x: 72, y: 50 },
      ],
      ideal_regions: [
        { label: 'test', purpose: 'primary_support_option', geometry: { type: 'circle', x: 40, y: 40, r: 10 } },
      ],
    };
    const { warnings } = lintScenario(spread);
    const spreadWarnings = warnings.filter(w => w.includes('within') && w.includes('units'));
    expect(spreadWarnings).toHaveLength(0);
  });
});

// ── Phase H: entity_relationships in Scenario schema ─────────────────────────

describe('ScenarioSchema — entity_relationships', () => {
  it('accepts a scenario without entity_relationships', () => {
    const result = ScenarioSchema.safeParse(baseScenario);
    expect(result.success).toBe(true);
  });

  it('accepts a scenario with valid entity_relationships', () => {
    const scenario = {
      ...baseScenario,
      entity_relationships: [
        { entity_id: 'p2', relationship: 'goal_side_of', relative_to: 'opp1', notes: 'Covering the striker' },
      ],
    };
    const result = ScenarioSchema.safeParse(scenario);
    expect(result.success).toBe(true);
  });

  it('rejects an invalid relationship type', () => {
    const scenario = {
      ...baseScenario,
      entity_relationships: [
        { entity_id: 'p2', relationship: 'invalid_relationship', relative_to: 'opp1' },
      ],
    };
    const result = ScenarioSchema.safeParse(scenario);
    expect(result.success).toBe(false);
  });
});

// ── Phase H: entity_relationship lint checks ──────────────────────────────────

describe('scenarioLint — entity_relationship checks', () => {
  const makeScenario = (relationships: Scenario['entity_relationships']): Scenario => ({
    ...baseScenario,
    line_group: 'back',
    primary_concept: 'cover',
    situation: 'defensive_shape',
    teaching_point: 'Test',
    feedback_hints: { success: 'Good', common_error: 'Bad' },
    ideal_regions: [
      { label: 'test', purpose: 'defensive_cover', geometry: { type: 'circle', x: 40, y: 40, r: 10 } },
    ],
    entity_relationships: relationships,
  });

  it('no warning when goal_side_of entity has lower x than reference', () => {
    // p2 is at x=20, opp1 is at x=50 — p2 has lower x → goal_side_of is correct
    const { warnings } = lintScenario(makeScenario([
      { entity_id: 'p2', relationship: 'goal_side_of', relative_to: 'opp1' },
    ]));
    const relWarnings = warnings.filter(w => w.includes('goal_side_of'));
    expect(relWarnings).toHaveLength(0);
  });

  it('warns when goal_side_of entity has higher x than reference', () => {
    // p1 is at x=55, opp1 is at x=50 — p1 has HIGHER x, so goal_side_of is wrong
    const { warnings } = lintScenario(makeScenario([
      { entity_id: 'p1', relationship: 'goal_side_of', relative_to: 'opp1' },
    ]));
    const relWarnings = warnings.filter(w => w.includes('goal_side_of'));
    expect(relWarnings.length).toBeGreaterThan(0);
    expect(relWarnings[0]).toContain('p1');
  });

  it('warns when entity_relationship references unknown entity_id', () => {
    const { warnings } = lintScenario(makeScenario([
      { entity_id: 'nonexistent_id', relationship: 'pressing', relative_to: 'opp1' },
    ]));
    const refWarnings = warnings.filter(w => w.includes('nonexistent_id'));
    expect(refWarnings.length).toBeGreaterThan(0);
  });

  it('warns when entity_relationship references unknown relative_to', () => {
    const { warnings } = lintScenario(makeScenario([
      { entity_id: 'p2', relationship: 'pressing', relative_to: 'no_such_entity' },
    ]));
    const refWarnings = warnings.filter(w => w.includes('no_such_entity'));
    expect(refWarnings.length).toBeGreaterThan(0);
  });
});

// ── Phase G: ScenarioIntent schema ───────────────────────────────────────────

describe('ScenarioIntentSchema', () => {
  const minimalIntent = {
    title: 'Test Intent',
    description: 'Test description',
    scenario_archetype: 'back_outlet_support',
    phase: 'attack',
    line_group: 'midfield',
    primary_concept: 'pressure_response',
    situation: 'build_out_under_press',
    field_zone: 'defensive_third_right',
    game_state: 'set_press',
    difficulty: 2,
    teaching_point: 'Position beside the press.',
    feedback_hints: {
      success: 'You created a clear outlet.',
      common_error: 'You stayed behind the press line.',
    },
    entities: [
      { id: 'cb', role: 'CB', team: 'home', position_hint: 'cb_defensive_right', is_ball_carrier: true },
      { id: 'cm', role: 'CM', team: 'home', position_hint: 'cm_own_half_right', is_target: true },
      { id: 'opp', role: 'FW', team: 'away', position_hint: 'opp_fw_pressing_right' },
    ],
    ideal_zones: [
      { label: 'outlet_lane', purpose: 'primary_support_option', named_zone: 'midfield_right_outlet' },
    ],
    pressure: { direction: 'outside_in', intensity: 'high' },
  };

  it('accepts a minimal valid ScenarioIntent', () => {
    expect(ScenarioIntentSchema.safeParse(minimalIntent).success).toBe(true);
  });

  it('rejects intent with missing title', () => {
    const { title: _, ...noTitle } = minimalIntent;
    expect(ScenarioIntentSchema.safeParse(noTitle).success).toBe(false);
  });

  it('rejects intent with no entities', () => {
    expect(ScenarioIntentSchema.safeParse({ ...minimalIntent, entities: [] }).success).toBe(false);
  });

  it('rejects intent with no ideal_zones', () => {
    expect(ScenarioIntentSchema.safeParse({ ...minimalIntent, ideal_zones: [] }).success).toBe(false);
  });

  it('rejects an IntentRegion with neither named_zone nor offset_hint', () => {
    const badIntent = {
      ...minimalIntent,
      ideal_zones: [{ label: 'test', purpose: 'primary_support_option' }],
    };
    expect(ScenarioIntentSchema.safeParse(badIntent).success).toBe(false);
  });
});

// ── Phase G: intentToScenario ─────────────────────────────────────────────────

describe('intentToScenario', () => {
  const validIntent = ScenarioIntentSchema.parse({
    title: 'CM Outlet Test',
    description: 'Test scenario generated from intent.',
    scenario_archetype: 'back_outlet_support',
    phase: 'attack',
    line_group: 'midfield',
    primary_concept: 'pressure_response',
    situation: 'build_out_under_press',
    field_zone: 'defensive_third_right',
    game_state: 'set_press',
    difficulty: 2,
    teaching_point: 'Stay beside the press.',
    feedback_hints: {
      success: 'Good outlet position.',
      common_error: 'Too close to the press.',
    },
    entities: [
      { id: 'gk',   role: 'GK', team: 'home', position_hint: 'gk_own_goal' },
      { id: 'cb',   role: 'CB', team: 'home', position_hint: 'cb_defensive_right', is_ball_carrier: true },
      { id: 'cm',   role: 'CM', team: 'home', position_hint: 'cm_own_half_right', is_target: true },
      { id: 'opp',  role: 'FW', team: 'away', position_hint: 'opp_fw_pressing_right' },
    ],
    ideal_zones: [
      { label: 'outlet', purpose: 'primary_support_option', named_zone: 'midfield_right_outlet' },
    ],
    pressure: { direction: 'outside_in', intensity: 'high' },
    correct_reasoning: ['create_passing_angle', 'support_under_pressure'],
  });

  it('resolves entity coordinates from position_hint anchors', () => {
    const scenario = intentToScenario(validIntent);
    const cm = scenario.teammates.find(e => e.id === 'cm');
    expect(cm).toBeDefined();
    // cm_own_half_right anchor is {x:38, y:28}
    expect(cm!.x).toBe(38);
    expect(cm!.y).toBe(28);
  });

  it('sets target_player to the entity with is_target=true', () => {
    const scenario = intentToScenario(validIntent);
    expect(scenario.target_player).toBe('cm');
  });

  it('sets ball position to the ball_carrier entity', () => {
    const scenario = intentToScenario(validIntent);
    // cb_defensive_right anchor is {x:15, y:22}
    expect(scenario.ball.x).toBe(15);
    expect(scenario.ball.y).toBe(22);
  });

  it('separates entities into teammates and opponents correctly', () => {
    const scenario = intentToScenario(validIntent);
    expect(scenario.teammates.length).toBe(3);
    expect(scenario.opponents.length).toBe(1);
    expect(scenario.opponents[0]!.id).toBe('opp');
  });

  it('resolves named_zone regions into SemanticRegion with named_zone field', () => {
    const scenario = intentToScenario(validIntent);
    expect(scenario.ideal_regions.length).toBe(1);
    const region = scenario.ideal_regions[0]! as SemanticRegion;
    expect(region.named_zone).toBe('midfield_right_outlet');
    // geometry should not be set since named_zone resolves the geometry at display time
    expect(region.geometry).toBeUndefined();
  });

  it('carries through semantic metadata fields', () => {
    const scenario = intentToScenario(validIntent);
    expect(scenario.scenario_archetype).toBe('back_outlet_support');
    expect(scenario.line_group).toBe('midfield');
    expect(scenario.primary_concept).toBe('pressure_response');
    expect(scenario.situation).toBe('build_out_under_press');
    expect(scenario.correct_reasoning).toEqual(['create_passing_angle', 'support_under_pressure']);
  });

  it('uses a custom scenario_id when provided', () => {
    const scenario = intentToScenario(validIntent, { scenario_id: 'CUSTOM_001' });
    expect(scenario.scenario_id).toBe('CUSTOM_001');
  });

  it('generates a slug-based scenario_id when not specified', () => {
    const scenario = intentToScenario(validIntent);
    expect(scenario.scenario_id).toContain('DRAFT_');
  });

  it('throws when no entity has is_target=true', () => {
    const badIntent = ScenarioIntentSchema.parse({
      ...validIntent,
      entities: validIntent.entities.map(e => ({ ...e, is_target: undefined })),
    });
    expect(() => intentToScenario(badIntent)).toThrow(/is_target/);
  });
});
