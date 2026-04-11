/**
 * S01 scenario regression tests.
 *
 * These tests lock in the evaluation and feedback behaviour for S01 (CM Build-Out
 * Support) so that future changes to the evaluator or feedback generator do not
 * silently regress the player-facing output.
 *
 * Evaluation notes (diagnostic, April 2026):
 *  - The support angle formula for `outside_in` pressure ({x:1,y:0}) rewards
 *    positions where the player's y-coordinate is BELOW the ball (y < ball.y = 50).
 *    Positions above the ball (y > 50) produce an angle > 90° from the
 *    perpendicular to pressure, which scores near zero and fails the support
 *    constraint (threshold 0.4). This affects the left ideal pocket (28,62) and
 *    the left acceptable-zone position (25,55) — both fall inside their ideal
 *    circles but currently receive INVALID because of that angle calculation.
 *  - The right-side positions (32,38) and (35,42) score well because their y < 50
 *    gives an acute support angle.
 *
 * Feedback assertions reflect the behaviour AFTER the outcome-gating rewrite:
 *  - INVALID → positives = 0, improvements from authored error_points
 *  - VALID   → positives from authored success_points, improvements ≤ 2
 *  - teaching_emphasis always passes through for S01 (hint always present)
 */

import { describe, it, expect } from 'vitest';
import { evaluate } from '../evaluation/evaluator';
import { generateFeedback } from '../feedback/feedbackGenerator';
import type { Scenario, WeightProfile, EvaluationResult } from '../types';

import S01Json from '../../public/scenarios/build-out/S01.json';
import buildOutJson from '../../public/weights/build_out_v1.json';

const s01 = S01Json as unknown as Scenario;
const buildOutProfile = buildOutJson as unknown as WeightProfile;

// ---------------------------------------------------------------------------
// S01 evaluation regression
// ---------------------------------------------------------------------------

describe('S01 scenario regression — evaluation', () => {
  it('Case A — flat central (30,50): INVALID, support constraint fails', () => {
    const r = evaluate(s01, { x: 30, y: 50 }, buildOutProfile);
    expect(r.result_type).toBe('INVALID');
    expect(r.score).toBeLessThan(65);
    // Position is geometrically inside an acceptable circle but support angle
    // fails the constraint threshold.
    expect(r.region_fit_score).toBeGreaterThan(0);
    expect(r.failed_constraints).toContain('support');
  });

  it('Case B — far away (80,80): INVALID, region_fit=0', () => {
    const r = evaluate(s01, { x: 80, y: 80 }, buildOutProfile);
    expect(r.result_type).toBe('INVALID');
    expect(r.region_fit_score).toBe(0);
    expect(r.failed_constraints).toContain('support');
  });

  it('Case C — left ideal pocket (28,62): region_fit=1.0, support constraint fails due to angle', () => {
    // The ideal circle is centered at (28,62). The player is at the exact
    // centre, so region_fit = 1.0. However, y=62 > ball.y=50 means the
    // support-angle formula gives a near-zero angle score → INVALID.
    const r = evaluate(s01, { x: 28, y: 62 }, buildOutProfile);
    expect(r.region_fit_score).toBe(1.0);
    expect(r.result_type).toBe('INVALID');
    expect(r.failed_constraints).toContain('support');
  });

  it('Case D — right ideal pocket (32,38): VALID or IDEAL, region_fit=1.0, constraints pass', () => {
    const r = evaluate(s01, { x: 32, y: 38 }, buildOutProfile);
    expect(['VALID', 'IDEAL']).toContain(r.result_type);
    expect(r.region_fit_score).toBe(1.0);
    expect(r.constraints_passed).toBe(true);
  });

  it('Case E — left zone position (25,55): inside ideal circle (rf=1.0), support constraint fails', () => {
    // (25,55) is within the left ideal circle (28,62)r=8 — distance ≈ 7.6.
    // Same angle-scoring issue as Case C.
    const r = evaluate(s01, { x: 25, y: 55 }, buildOutProfile);
    expect(r.region_fit_score).toBe(1.0);
    expect(r.failed_constraints).toContain('support');
  });

  it('Case F — right zone position (35,42): VALID or IDEAL, region_fit=1.0, constraints pass', () => {
    // (35,42) is within the right ideal circle (32,38)r=8 — distance = 5.
    const r = evaluate(s01, { x: 35, y: 42 }, buildOutProfile);
    expect(['VALID', 'IDEAL']).toContain(r.result_type);
    expect(r.region_fit_score).toBe(1.0);
    expect(r.constraints_passed).toBe(true);
  });

  it('Case G — too high/forward (45,50): INVALID, region_fit=0', () => {
    const r = evaluate(s01, { x: 45, y: 50 }, buildOutProfile);
    expect(r.result_type).toBe('INVALID');
    expect(r.region_fit_score).toBe(0);
    expect(r.score).toBeLessThan(50);
  });

  it('Case H — too close to ball carrier (12,52): INVALID, support constraint fails', () => {
    const r = evaluate(s01, { x: 12, y: 52 }, buildOutProfile);
    expect(r.result_type).toBe('INVALID');
    expect(r.failed_constraints).toContain('support');
  });
});

// ---------------------------------------------------------------------------
// S01 feedback quality regression
// ---------------------------------------------------------------------------

describe('S01 scenario regression — feedback quality', () => {
  it('Case A — INVALID: common_error summary, no positives, authored error improvements, teaching_emphasis present', () => {
    const evalResult = evaluate(s01, { x: 30, y: 50 }, buildOutProfile);
    const fb = generateFeedback(evalResult, s01, undefined, buildOutProfile);
    expect(fb.result_type).toBe('INVALID');
    expect(fb.summary).toBe(s01.feedback_hints!.common_error);
    expect(fb.positives).toHaveLength(0);
    expect(fb.improvements.length).toBeGreaterThan(0);
    expect(fb.teaching_emphasis).toBe(s01.feedback_hints!.teaching_emphasis);
  });

  it('Case B — INVALID far away: no positives, improvements present, teaching_emphasis present', () => {
    const evalResult = evaluate(s01, { x: 80, y: 80 }, buildOutProfile);
    const fb = generateFeedback(evalResult, s01, undefined, buildOutProfile);
    expect(fb.result_type).toBe('INVALID');
    expect(fb.positives).toHaveLength(0);
    expect(fb.improvements.length).toBeGreaterThan(0);
    expect(fb.teaching_emphasis).toBe(s01.feedback_hints!.teaching_emphasis);
  });

  it('Case C — left ideal pocket INVALID: no positives, authored error feedback, teaching_emphasis present', () => {
    const evalResult = evaluate(s01, { x: 28, y: 62 }, buildOutProfile);
    const fb = generateFeedback(evalResult, s01, undefined, buildOutProfile);
    expect(fb.result_type).toBe('INVALID');
    expect(fb.positives).toHaveLength(0);
    expect(fb.summary).toBe(s01.feedback_hints!.common_error);
    // Authored error_points should supply the improvement bullets
    const errorPoints = s01.feedback_hints!.error_points!;
    expect(fb.improvements[0]).toBe(errorPoints[0]);
    expect(fb.teaching_emphasis).toBe(s01.feedback_hints!.teaching_emphasis);
  });

  it('Case D — right ideal pocket VALID: success summary, authored success positives, improvements ≤ 2', () => {
    const evalResult = evaluate(s01, { x: 32, y: 38 }, buildOutProfile);
    const fb = generateFeedback(evalResult, s01, undefined, buildOutProfile);
    expect(['VALID', 'IDEAL']).toContain(fb.result_type);
    expect(fb.summary).toBe(s01.feedback_hints!.success);
    expect(fb.positives.length).toBeGreaterThan(0);
    expect(fb.positives.length).toBeLessThanOrEqual(3);
    expect(fb.improvements.length).toBeLessThanOrEqual(2);
    expect(fb.teaching_emphasis).toBe(s01.feedback_hints!.teaching_emphasis);
    // Authored success_points should supply the positive bullets
    const successPoints = s01.feedback_hints!.success_points!;
    expect(fb.positives[0]).toBe(successPoints[0]);
  });

  it('Case E — left zone INVALID: common_error summary, no positives', () => {
    const evalResult = evaluate(s01, { x: 25, y: 55 }, buildOutProfile);
    const fb = generateFeedback(evalResult, s01, undefined, buildOutProfile);
    expect(fb.result_type).toBe('INVALID');
    expect(fb.positives).toHaveLength(0);
    expect(fb.summary).toBe(s01.feedback_hints!.common_error);
  });

  it('Case F — right zone VALID: success summary, authored positives, no contradictory improvements', () => {
    const evalResult = evaluate(s01, { x: 35, y: 42 }, buildOutProfile);
    const fb = generateFeedback(evalResult, s01, undefined, buildOutProfile);
    expect(['VALID', 'IDEAL']).toContain(fb.result_type);
    expect(fb.summary).toBe(s01.feedback_hints!.success);
    expect(fb.positives.length).toBeGreaterThan(0);
    expect(fb.improvements.length).toBeLessThanOrEqual(2);
    expect(fb.summary).not.toContain('does not meet');
    expect(fb.summary).not.toContain('too flat');
  });

  it('Case G — too forward INVALID: failure-oriented summary, no positives, improvements present', () => {
    const evalResult = evaluate(s01, { x: 45, y: 50 }, buildOutProfile);
    const fb = generateFeedback(evalResult, s01, undefined, buildOutProfile);
    expect(fb.result_type).toBe('INVALID');
    expect(fb.positives).toHaveLength(0);
    expect(fb.improvements.length).toBeGreaterThan(0);
    expect(fb.summary).toBe(s01.feedback_hints!.common_error);
  });

  it('Case H — too close to ball carrier INVALID: no positives, improvements present', () => {
    const evalResult = evaluate(s01, { x: 12, y: 52 }, buildOutProfile);
    const fb = generateFeedback(evalResult, s01, undefined, buildOutProfile);
    expect(fb.result_type).toBe('INVALID');
    expect(fb.positives).toHaveLength(0);
    expect(fb.improvements.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Feedback contradiction guards (synthetic results)
// ---------------------------------------------------------------------------

describe('Feedback contradiction guards', () => {
  /** Minimal scenario with S01-style authored hints but no authored bullet arrays. */
  const guardScenario: Scenario = {
    scenario_id: 'TEST_GUARD',
    version: 1,
    title: 'Guard Test',
    description: 'Contradiction guard test scenario',
    phase: 'attack',
    team_orientation: 'home_attacks_positive_x',
    target_player: 'cm1',
    ball: { x: 5, y: 50 },
    teammates: [{ id: 'cm1', role: 'CM', team: 'home', x: 30, y: 50 }],
    opponents: [],
    pressure: { direction: 'outside_in', intensity: 'medium' },
    ideal_regions: [],
    acceptable_regions: [],
    weight_profile: 'build_out_v1',
    constraint_thresholds: {},
    difficulty: 1,
    tags: ['support'],
    feedback_hints: {
      success: 'Authored success summary.',
      common_error: 'Authored common error: the lane is screened.',
      alternate_valid: 'Authored alternate valid summary.',
      teaching_emphasis: 'Authored teaching emphasis.',
    },
  };

  it('INVALID outcome: 0 positives regardless of high component scores', () => {
    const invalidResult: EvaluationResult = {
      score: 20,
      result_type: 'INVALID',
      component_scores: {
        // 2 high-scoring components that would normally produce positives
        support: 0.9,
        passing_lane: 0.2,
        spacing: 0.85,
        pressure_relief: 0.2,
        width_depth: 0.1,
        cover: 0.7,
        region_fit: 0,
        reasoning_bonus: 0,
      },
      constraints_passed: false,
      region_fit_score: 0,
      failed_constraints: ['support'],
    };
    const fb = generateFeedback(invalidResult, guardScenario);
    expect(fb.positives).toHaveLength(0);
    // Specifically: no success-implying generic phrases
    expect(fb.positives).not.toContain('You preserved team structure');
    expect(fb.positives).not.toContain('You made yourself available for a pass');
  });

  it('IDEAL outcome: max 1 improvement, borderline scores (>0.5) filtered out', () => {
    const idealResult: EvaluationResult = {
      score: 85,
      result_type: 'IDEAL',
      component_scores: {
        support: 0.9,
        passing_lane: 0.88,
        spacing: 0.85,
        pressure_relief: 0.82,
        // borderline score — above 0.5, below 0.6 → would be an improvement
        // candidate but should be filtered by the IDEAL cleanup pass
        width_depth: 0.55,
        cover: 0.7,
        region_fit: 1.0,
        reasoning_bonus: 1.0,
      },
      constraints_passed: true,
      region_fit_score: 1.0,
      failed_constraints: [],
    };
    const fb = generateFeedback(idealResult, guardScenario);
    expect(fb.improvements.length).toBeLessThanOrEqual(1);
    // width_depth = 0.55 > 0.5, so it is filtered out; expect 0 improvements
    expect(fb.improvements).toHaveLength(0);
  });

  it('Scenario hint precedence: common_error replaces generic INVALID summary, success replaces generic IDEAL summary, teaching_emphasis always passes through', () => {
    const invalidResult: EvaluationResult = {
      score: 10,
      result_type: 'INVALID',
      component_scores: {
        support: 0.1, passing_lane: 0.1, spacing: 0.1,
        pressure_relief: 0.1, width_depth: 0.1, cover: 0.1,
        region_fit: 0, reasoning_bonus: 0,
      },
      constraints_passed: false,
      region_fit_score: 0,
      failed_constraints: ['support'],
    };
    const idealResult: EvaluationResult = {
      score: 90,
      result_type: 'IDEAL',
      component_scores: {
        support: 0.95, passing_lane: 0.92, spacing: 0.9,
        pressure_relief: 0.9, width_depth: 0.9, cover: 0.9,
        region_fit: 1.0, reasoning_bonus: 1.0,
      },
      constraints_passed: true,
      region_fit_score: 1.0,
      failed_constraints: [],
    };

    const fbInvalid = generateFeedback(invalidResult, guardScenario);
    expect(fbInvalid.summary).toBe('Authored common error: the lane is screened.');
    expect(fbInvalid.summary).not.toBe('Positioning does not meet tactical requirements.');
    expect(fbInvalid.teaching_emphasis).toBe('Authored teaching emphasis.');

    const fbIdeal = generateFeedback(idealResult, guardScenario);
    expect(fbIdeal.summary).toBe('Authored success summary.');
    expect(fbIdeal.summary).not.toBe('Excellent positioning.');
    expect(fbIdeal.teaching_emphasis).toBe('Authored teaching emphasis.');
  });
});
