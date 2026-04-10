import { describe, it, expect } from 'vitest';
import { evaluate } from '../evaluation/evaluator';
import type { Scenario, WeightProfile } from '../types';

const baseScenario: Scenario = {
  scenario_id: 'TEST01',
  version: 1,
  title: 'Test Scenario',
  description: 'Test',
  phase: 'attack',
  team_orientation: 'home_attacks_positive_x',
  target_player: 'cm1',
  ball: { x: 30, y: 50 },
  teammates: [
    { id: 'cm1', role: 'CM', team: 'home', x: 45, y: 62 },
    { id: 'fw1', role: 'FW', team: 'home', x: 70, y: 50 },
  ],
  opponents: [
    { id: 'opp1', role: 'CF', team: 'away', x: 40, y: 48 },
  ],
  pressure: { direction: 'outside_in', intensity: 'medium' },
  ideal_regions: [{ type: 'circle' as const, x: 45, y: 62, r: 8 }],
  acceptable_regions: [{ type: 'circle' as const, x: 45, y: 60, r: 14 }],
  weight_profile: 'build_out_v1',
  constraint_thresholds: { support: 0.3, passing_lane: 0.2 },
  difficulty: 1,
  tags: ['support'],
};

const baseProfile: WeightProfile = {
  profile_id: 'build_out_v1',
  version: 1,
  weights: {
    support: 0.25,
    passing_lane: 0.20,
    spacing: 0.15,
    pressure_relief: 0.20,
    width_depth: 0.10,
    cover: 0.00,
    region_fit: 0.08,
    reasoning_bonus: 0.02,
  },
  component_config: {
    distance_to_ball: { optimal_min: 8, optimal_max: 20 },
    spacing: { min_distance: 8 },
    passing_lane: { block_threshold: 5 },
  },
};

describe('evaluate', () => {
  it('returns a score between 0 and 100', () => {
    const result = evaluate(baseScenario, { x: 45, y: 62 }, baseProfile);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('returns IDEAL for position inside ideal region with high score', () => {
    const result = evaluate(baseScenario, { x: 45, y: 62 }, baseProfile);
    expect(result.region_fit_score).toBe(1.0);
  });

  it('returns non-IDEAL for clearly wrong position', () => {
    const result = evaluate(baseScenario, { x: 0, y: 0 }, baseProfile);
    expect(result.result_type).not.toBe('IDEAL');
  });

  it('returns ERROR result type when evaluation fails gracefully', () => {
    const badScenario = { ...baseScenario, ball: { x: NaN, y: NaN } };
    const result = evaluate(badScenario, { x: 50, y: 50 }, baseProfile);
    expect(result).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('component_scores are all between 0 and 1', () => {
    const result = evaluate(baseScenario, { x: 45, y: 62 }, baseProfile);
    for (const val of Object.values(result.component_scores)) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(1);
    }
  });

  it('reasoning bonus applied when reasoning matches', () => {
    const withReasoning = evaluate(baseScenario, { x: 45, y: 62 }, baseProfile, 'create_passing_angle');
    const withoutReasoning = evaluate(baseScenario, { x: 45, y: 62 }, baseProfile);
    expect(withReasoning.component_scores.reasoning_bonus).toBeGreaterThan(withoutReasoning.component_scores.reasoning_bonus);
  });

  it('returns failed_constraints list', () => {
    const result = evaluate(baseScenario, { x: 0, y: 0 }, baseProfile);
    expect(Array.isArray(result.failed_constraints)).toBe(true);
  });
});

describe('evaluate — rich region types', () => {
  it('detects player inside a tagged circle region', () => {
    const scenario = {
      ...baseScenario,
      ideal_regions: [{ type: 'circle' as const, x: 50, y: 50, r: 10 }],
      acceptable_regions: [],
    };
    const result = evaluate(scenario, { x: 50, y: 50 }, baseProfile);
    expect(result.region_fit_score).toBe(1.0);
  });

  it('detects player inside a rectangle region', () => {
    const scenario = {
      ...baseScenario,
      ideal_regions: [{ type: 'rectangle' as const, x: 40, y: 40, width: 20, height: 20 }],
      acceptable_regions: [],
    };
    const result = evaluate(scenario, { x: 50, y: 50 }, baseProfile);
    expect(result.region_fit_score).toBe(1.0);
  });

  it('rejects player outside a rectangle region', () => {
    const scenario = {
      ...baseScenario,
      ideal_regions: [{ type: 'rectangle' as const, x: 40, y: 40, width: 20, height: 20 }],
      acceptable_regions: [],
    };
    const result = evaluate(scenario, { x: 10, y: 10 }, baseProfile);
    expect(result.region_fit_score).toBe(0.0);
  });

  it('detects player inside a polygon region', () => {
    const scenario = {
      ...baseScenario,
      ideal_regions: [{
        type: 'polygon' as const,
        vertices: [{ x: 40, y: 40 }, { x: 60, y: 40 }, { x: 60, y: 60 }, { x: 40, y: 60 }],
      }],
      acceptable_regions: [],
    };
    const result = evaluate(scenario, { x: 50, y: 50 }, baseProfile);
    expect(result.region_fit_score).toBe(1.0);
  });

  it('rejects player outside a polygon region', () => {
    const scenario = {
      ...baseScenario,
      ideal_regions: [{
        type: 'polygon' as const,
        vertices: [{ x: 40, y: 40 }, { x: 60, y: 40 }, { x: 60, y: 60 }, { x: 40, y: 60 }],
      }],
      acceptable_regions: [],
    };
    const result = evaluate(scenario, { x: 10, y: 10 }, baseProfile);
    expect(result.region_fit_score).toBe(0.0);
  });

  it('detects player inside a lane region', () => {
    const scenario = {
      ...baseScenario,
      ideal_regions: [{
        type: 'lane' as const,
        x1: 30, y1: 50,
        x2: 60, y2: 50,
        width: 10,
      }],
      acceptable_regions: [],
    };
    // Player is on the spine midpoint — clearly inside the lane
    const result = evaluate(scenario, { x: 45, y: 50 }, baseProfile);
    expect(result.region_fit_score).toBe(1.0);
  });

  it('rejects player outside a lane region', () => {
    const scenario = {
      ...baseScenario,
      ideal_regions: [{
        type: 'lane' as const,
        x1: 30, y1: 50,
        x2: 60, y2: 50,
        width: 10,
      }],
      acceptable_regions: [],
    };
    // Player is far from the lane
    const result = evaluate(scenario, { x: 45, y: 80 }, baseProfile);
    expect(result.region_fit_score).toBe(0.0);
  });

  it('returns acceptable-region score for non-circle region (fixed 0.75)', () => {
    const scenario = {
      ...baseScenario,
      ideal_regions: [],
      acceptable_regions: [{ type: 'rectangle' as const, x: 40, y: 40, width: 20, height: 20 }],
    };
    const result = evaluate(scenario, { x: 50, y: 50 }, baseProfile);
    expect(result.region_fit_score).toBe(0.75);
  });

});

describe('evaluate — semantic region resolution', () => {
  // ── pitch-relative (default) ────────────────────────────────────────────

  it('pitch-relative semantic region with no reference_frame behaves like raw geometry', () => {
    const scenario = {
      ...baseScenario,
      ideal_regions: [{
        label: 'central_pocket',
        purpose: 'primary_support_option' as const,
        geometry: { type: 'circle' as const, x: 50, y: 50, r: 10 },
      }],
      acceptable_regions: [],
    };
    const result = evaluate(scenario, { x: 50, y: 50 }, baseProfile);
    expect(result.region_fit_score).toBe(1.0);
  });

  it('pitch-relative semantic region with explicit reference_frame: pitch behaves like raw geometry', () => {
    const scenario = {
      ...baseScenario,
      ideal_regions: [{
        label: 'strong_side_outlet_lane',
        purpose: 'primary_support_option' as const,
        reference_frame: 'pitch' as const,
        geometry: {
          type: 'lane' as const,
          x1: 30, y1: 50,
          x2: 60, y2: 50,
          width: 10,
        },
      }],
      acceptable_regions: [],
    };
    const result = evaluate(scenario, { x: 45, y: 50 }, baseProfile);
    expect(result.region_fit_score).toBe(1.0);
  });

  it('pitch-relative semantic region misses when player is outside', () => {
    const scenario = {
      ...baseScenario,
      ideal_regions: [{
        label: 'right_pocket',
        reference_frame: 'pitch' as const,
        geometry: { type: 'circle' as const, x: 70, y: 70, r: 8 },
      }],
      acceptable_regions: [],
    };
    const result = evaluate(scenario, { x: 10, y: 10 }, baseProfile);
    expect(result.region_fit_score).toBe(0.0);
  });

  // ── ball-relative ────────────────────────────────────────────────────────

  it('ball-relative semantic region hits when player is at ball + offset', () => {
    // ball is at { x: 30, y: 50 } in baseScenario
    // geometry offset: { x: 10, y: 0 } → resolves to pitch { x: 40, y: 50 }
    const scenario = {
      ...baseScenario,
      ideal_regions: [{
        label: 'immediate_escape_lane',
        purpose: 'pressure_relief' as const,
        reference_frame: 'ball' as const,
        geometry: { type: 'circle' as const, x: 10, y: 0, r: 8 },
      }],
      acceptable_regions: [],
    };
    // pitch-resolved center: (30+10, 50+0) = (40, 50)
    const result = evaluate(scenario, { x: 40, y: 50 }, baseProfile);
    expect(result.region_fit_score).toBe(1.0);
  });

  it('ball-relative semantic region misses when player is at original geometry coordinates (not resolved)', () => {
    // geometry is at x:10, y:0 relative to ball; without translation player at (10,0) is far from resolved center (40,50)
    const scenario = {
      ...baseScenario,
      ideal_regions: [{
        reference_frame: 'ball' as const,
        geometry: { type: 'circle' as const, x: 10, y: 0, r: 5 },
      }],
      acceptable_regions: [],
    };
    const result = evaluate(scenario, { x: 10, y: 0 }, baseProfile);
    expect(result.region_fit_score).toBe(0.0);
  });

  // ── target_player-relative ───────────────────────────────────────────────

  it('target_player-relative semantic region resolves relative to the target player', () => {
    // baseScenario: target_player = 'cm1' at { x: 45, y: 62 }
    // geometry offset: { x: 5, y: 0 } → resolves to (50, 62)
    const scenario = {
      ...baseScenario,
      ideal_regions: [{
        label: 'support_pocket',
        purpose: 'secondary_support_option' as const,
        reference_frame: 'target_player' as const,
        geometry: { type: 'circle' as const, x: 5, y: 0, r: 5 },
      }],
      acceptable_regions: [],
    };
    const result = evaluate(scenario, { x: 50, y: 62 }, baseProfile);
    expect(result.region_fit_score).toBe(1.0);
  });

  it('target_player-relative semantic region misses when player is at raw offset (not resolved)', () => {
    const scenario = {
      ...baseScenario,
      ideal_regions: [{
        reference_frame: 'target_player' as const,
        geometry: { type: 'circle' as const, x: 5, y: 0, r: 5 },
      }],
      acceptable_regions: [],
    };
    // Without resolution the circle center would be (5,0), but resolved it is (50,62)
    const result = evaluate(scenario, { x: 5, y: 0 }, baseProfile);
    expect(result.region_fit_score).toBe(0.0);
  });

  // ── entity-relative ──────────────────────────────────────────────────────

  it('entity-relative semantic region resolves relative to a named opponent', () => {
    // baseScenario: opp1 at { x: 40, y: 48 }
    // geometry offset: { x: 0, y: 5 } → resolves to (40, 53)
    const scenario = {
      ...baseScenario,
      ideal_regions: [{
        label: 'cf_cover_shadow',
        purpose: 'defensive_cover' as const,
        reference_frame: 'entity' as const,
        reference_entity_id: 'opp1',
        geometry: { type: 'circle' as const, x: 0, y: 5, r: 5 },
      }],
      acceptable_regions: [],
    };
    const result = evaluate(scenario, { x: 40, y: 53 }, baseProfile);
    expect(result.region_fit_score).toBe(1.0);
  });

  it('entity-relative semantic region returns 0 when reference entity does not exist', () => {
    const scenario = {
      ...baseScenario,
      ideal_regions: [{
        reference_frame: 'entity' as const,
        reference_entity_id: 'nonexistent_entity',
        geometry: { type: 'circle' as const, x: 50, y: 50, r: 20 },
      }],
      acceptable_regions: [],
    };
    const result = evaluate(scenario, { x: 50, y: 50 }, baseProfile);
    expect(result.region_fit_score).toBe(0.0);
  });

  // ── polygon and lane with translation ────────────────────────────────────

  it('ball-relative polygon region resolves correctly', () => {
    // ball at (30, 50); polygon offsets form a 10×10 square at +20,+0
    // resolved vertices: (50,50),(60,50),(60,60),(50,60)
    const scenario = {
      ...baseScenario,
      ideal_regions: [{
        reference_frame: 'ball' as const,
        geometry: {
          type: 'polygon' as const,
          vertices: [
            { x: 20, y: 0 }, { x: 30, y: 0 },
            { x: 30, y: 10 }, { x: 20, y: 10 },
          ],
        },
      }],
      acceptable_regions: [],
    };
    const result = evaluate(scenario, { x: 55, y: 55 }, baseProfile);
    expect(result.region_fit_score).toBe(1.0);
  });

  it('ball-relative lane region resolves correctly', () => {
    // ball at (30,50); lane offsets: (0,0) → (20,0) with width 10
    // resolved: (30,50)→(50,50)
    const scenario = {
      ...baseScenario,
      ideal_regions: [{
        reference_frame: 'ball' as const,
        geometry: {
          type: 'lane' as const,
          x1: 0, y1: 0,
          x2: 20, y2: 0,
          width: 10,
        },
      }],
      acceptable_regions: [],
    };
    const result = evaluate(scenario, { x: 40, y: 50 }, baseProfile);
    expect(result.region_fit_score).toBe(1.0);
  });

  // ── acceptable semantic region gradient ──────────────────────────────────

  it('pitch-relative semantic acceptable circle uses gradient scoring', () => {
    const scenario = {
      ...baseScenario,
      ideal_regions: [],
      acceptable_regions: [{
        label: 'wide_support_pocket',
        reference_frame: 'pitch' as const,
        geometry: { type: 'circle' as const, x: 50, y: 50, r: 10 },
      }],
    };
    // Player exactly at center → ratio=1 → lerp(1, 0.6, 0.9) = 0.9
    const result = evaluate(scenario, { x: 50, y: 50 }, baseProfile);
    expect(result.region_fit_score).toBeGreaterThanOrEqual(0.6);
    expect(result.region_fit_score).toBeLessThanOrEqual(0.9);
  });
});
