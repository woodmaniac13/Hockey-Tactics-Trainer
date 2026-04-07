import { describe, it, expect } from 'vitest';
import { generateFeedback } from '../feedback/feedbackGenerator';
import type { EvaluationResult, Scenario } from '../types';

const baseEvalResult: EvaluationResult = {
  score: 85,
  result_type: 'IDEAL',
  component_scores: {
    support: 0.9,
    passing_lane: 0.85,
    spacing: 0.8,
    pressure_relief: 0.75,
    width_depth: 0.7,
    cover: 0.6,
    region_fit: 1.0,
    reasoning_bonus: 1.0,
  },
  constraints_passed: true,
  region_fit_score: 1.0,
  failed_constraints: [],
};

const baseScenario: Scenario = {
  scenario_id: 'TEST01',
  version: 1,
  title: 'Test',
  description: 'Test',
  phase: 'attack',
  team_orientation: 'home_attacks_positive_x',
  target_player: 'cm1',
  ball: { x: 30, y: 50 },
  teammates: [{ id: 'cm1', role: 'CM', team: 'home', x: 45, y: 62 }],
  opponents: [],
  pressure: { direction: 'outside_in', intensity: 'medium' },
  ideal_regions: [],
  acceptable_regions: [],
  weight_profile: 'build_out_v1',
  constraint_thresholds: {},
  difficulty: 1,
  tags: ['support'],
};

describe('generateFeedback', () => {
  it('returns IDEAL summary for IDEAL result', () => {
    const fb = generateFeedback(baseEvalResult, baseScenario);
    expect(fb.summary).toBe('Excellent positioning.');
    expect(fb.result_type).toBe('IDEAL');
  });

  it('includes positives for high scoring components', () => {
    const fb = generateFeedback(baseEvalResult, baseScenario);
    expect(fb.positives.length).toBeGreaterThan(0);
    expect(fb.positives).toContain('You created a strong support angle');
  });

  it('includes improvements for low scoring components', () => {
    const lowResult: EvaluationResult = {
      ...baseEvalResult,
      result_type: 'INVALID',
      component_scores: {
        ...baseEvalResult.component_scores,
        support: 0.2,
        passing_lane: 0.3,
        spacing: 0.1,
      },
    };
    const fb = generateFeedback(lowResult, baseScenario);
    expect(fb.improvements.length).toBeGreaterThan(0);
    expect(fb.improvements).toContain('Your support angle could be improved');
  });

  it('handles ERROR result type', () => {
    const errorResult: EvaluationResult = { ...baseEvalResult, result_type: 'ERROR', score: 0 };
    const fb = generateFeedback(errorResult, baseScenario);
    expect(fb.summary).toBe('Unable to generate feedback.');
    expect(fb.positives).toHaveLength(0);
  });

  it('includes tactical explanation for attack+support', () => {
    const fb = generateFeedback(baseEvalResult, baseScenario);
    expect(fb.tactical_explanation).toContain('support the ball carrier');
  });

  it('includes reasoning feedback when reasoning provided', () => {
    const fb = generateFeedback(baseEvalResult, baseScenario, 'create_passing_angle');
    expect(fb.reasoning_feedback).toBeTruthy();
  });
});
