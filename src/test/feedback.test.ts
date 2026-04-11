import { describe, it, expect } from 'vitest';
import { generateFeedback } from '../feedback/feedbackGenerator';
import type { EvaluationResult, Scenario, WeightProfile } from '../types';

const baseEvalResult: EvaluationResult = {
  score: 85,
  result_type: 'IDEAL',
  component_scores: {
    support: 0.9,
    passing_lane: 0.85,
    spacing: 0.8,
    pressure_relief: 0.85,
    width_depth: 0.8,
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

  it('includes tactical explanation for attack+support (fallback path)', () => {
    const fb = generateFeedback(baseEvalResult, baseScenario);
    expect(fb.tactical_explanation).toContain('support the ball carrier');
  });

  it('uses authored teaching_point as tactical explanation when present', () => {
    const scenarioWithTeachingPoint: Scenario = {
      ...baseScenario,
      teaching_point: 'Drop into the pocket between the press lines to give the CB a clean outlet.',
    };
    const fb = generateFeedback(baseEvalResult, scenarioWithTeachingPoint);
    expect(fb.tactical_explanation).toBe(
      'Drop into the pocket between the press lines to give the CB a clean outlet.',
    );
  });

  it('teaching_point takes precedence over phase/tag fallback', () => {
    // Even an attack+support scenario should use the teaching_point if authored
    const scenarioWithTeachingPoint: Scenario = {
      ...baseScenario,
      tags: ['support'],
      phase: 'attack',
      teaching_point: 'Custom authored coaching point.',
    };
    const fb = generateFeedback(baseEvalResult, scenarioWithTeachingPoint);
    expect(fb.tactical_explanation).toBe('Custom authored coaching point.');
    // Confirm the generic fallback text is not present
    expect(fb.tactical_explanation).not.toContain('support the ball carrier');
  });

  it('includes reasoning feedback when reasoning provided', () => {
    const fb = generateFeedback(baseEvalResult, baseScenario, 'create_passing_angle');
    expect(fb.reasoning_feedback).toBeTruthy();
  });

  it('excludes positives for zero-weight components when weightProfile is provided', () => {
    const profile: WeightProfile = {
      profile_id: 'test_v1',
      version: 1,
      weights: {
        support: 0.3,
        passing_lane: 0.3,
        spacing: 0.2,
        pressure_relief: 0.2,
        width_depth: 0.0,
        cover: 0.0,
        region_fit: 0.0,
      },
    };
    const highScores: EvaluationResult = {
      ...baseEvalResult,
      component_scores: {
        support: 0.9,
        passing_lane: 0.9,
        spacing: 0.9,
        pressure_relief: 0.9,
        width_depth: 0.9,
        cover: 0.9,
        region_fit: 1.0,
        reasoning_bonus: 0,
      },
    };
    const fb = generateFeedback(highScores, baseScenario, undefined, profile);
    expect(fb.positives).toContain('You created a strong support angle');
    expect(fb.positives).not.toContain('You preserved team structure');
    expect(fb.positives).not.toContain('You provided defensive cover');
  });

  it('shows top-weighted positives (up to 3) when no weightProfile is provided', () => {
    const highScores: EvaluationResult = {
      ...baseEvalResult,
      component_scores: {
        support: 0.9,
        passing_lane: 0.9,
        spacing: 0.9,
        pressure_relief: 0.9,
        width_depth: 0.9,
        cover: 0.9,
        region_fit: 1.0,
        reasoning_bonus: 0,
      },
    };
    const fb = generateFeedback(highScores, baseScenario);
    // Without a profile all weights default to 1; after IDEAL gating (max 3)
    // only the first three components in sort order are surfaced.
    expect(fb.positives).toContain('You created a strong support angle');
    expect(fb.positives.length).toBeLessThanOrEqual(3);
  });

  it('uses higher threshold (0.8) for positives', () => {
    const borderlineResult: EvaluationResult = {
      ...baseEvalResult,
      component_scores: {
        ...baseEvalResult.component_scores,
        support: 0.75, // below 0.8 — should not appear as positive
      },
    };
    const fb = generateFeedback(borderlineResult, baseScenario);
    expect(fb.positives).not.toContain('You created a strong support angle');
  });
});
