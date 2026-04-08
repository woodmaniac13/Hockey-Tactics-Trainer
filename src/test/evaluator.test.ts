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
  ideal_regions: [{ x: 45, y: 62, r: 8 }],
  acceptable_regions: [{ x: 45, y: 60, r: 14 }],
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

  it('legacy circle regions still work without type field', () => {
    const scenario = {
      ...baseScenario,
      ideal_regions: [{ x: 50, y: 50, r: 10 }],
      acceptable_regions: [],
    };
    const result = evaluate(scenario, { x: 50, y: 50 }, baseProfile);
    expect(result.region_fit_score).toBe(1.0);
  });
});
