import { describe, it, expect } from 'vitest';
import { generateFeedback } from '../feedback/feedbackGenerator';
import type { EvaluationResult, Scenario, WeightProfile, ResultType } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseScenario: Scenario = {
  scenario_id: 'FB_TEST',
  version: 1,
  title: 'Feedback Test',
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
  weight_profile: 'test_v1',
  constraint_thresholds: {},
  difficulty: 1,
  tags: ['support'],
};

const allHighScores = {
  support: 0.9,
  passing_lane: 0.9,
  spacing: 0.9,
  pressure_relief: 0.9,
  width_depth: 0.9,
  cover: 0.9,
  region_fit: 1.0,
  reasoning_bonus: 0.0,
};

const allLowScores = {
  support: 0.2,
  passing_lane: 0.2,
  spacing: 0.2,
  pressure_relief: 0.2,
  width_depth: 0.2,
  cover: 0.2,
  region_fit: 0.0,
  reasoning_bonus: 0.0,
};

function makeEval(
  resultType: ResultType,
  overrides: Partial<typeof allHighScores> = {},
  score = 50,
): EvaluationResult {
  const base = resultType === 'INVALID' || resultType === 'PARTIAL' ? allLowScores : allHighScores;
  return {
    score,
    result_type: resultType,
    component_scores: { ...base, ...overrides },
    constraints_passed: resultType !== 'INVALID',
    region_fit_score: resultType === 'IDEAL' ? 1.0 : 0.5,
    failed_constraints: [],
  };
}

/** Weight profile where every tactical component has non-zero weight. */
const uniformProfile: WeightProfile = {
  profile_id: 'uniform_test',
  version: 1,
  weights: {
    support: 0.2,
    passing_lane: 0.2,
    spacing: 0.15,
    pressure_relief: 0.15,
    width_depth: 0.15,
    cover: 0.15,
    region_fit: 0.0,
  },
};

// ---------------------------------------------------------------------------
// 1. OUTCOME_GATE enforcement
// ---------------------------------------------------------------------------

describe('OUTCOME_GATE enforcement', () => {
  it('INVALID: always 0 positives even with high-scoring components', () => {
    const result = makeEval('INVALID', allHighScores);
    const fb = generateFeedback(result, baseScenario, undefined, uniformProfile);
    expect(fb.positives).toHaveLength(0);
  });

  it('IDEAL: max 3 positives, max 1 improvement', () => {
    const result = makeEval('IDEAL', { ...allHighScores, cover: 0.3 });
    const fb = generateFeedback(result, baseScenario, undefined, uniformProfile);
    expect(fb.positives.length).toBeLessThanOrEqual(3);
    expect(fb.improvements.length).toBeLessThanOrEqual(1);
  });

  it('VALID: max 3 positives, max 2 improvements', () => {
    const result = makeEval('VALID', {
      support: 0.9,
      passing_lane: 0.9,
      spacing: 0.9,
      pressure_relief: 0.9,
      width_depth: 0.3,
      cover: 0.3,
    });
    const fb = generateFeedback(result, baseScenario, undefined, uniformProfile);
    expect(fb.positives.length).toBeLessThanOrEqual(3);
    expect(fb.improvements.length).toBeLessThanOrEqual(2);
  });

  it('ALTERNATE_VALID: max 2 positives, max 2 improvements', () => {
    const result = makeEval('ALTERNATE_VALID', {
      support: 0.9,
      passing_lane: 0.9,
      spacing: 0.9,
      pressure_relief: 0.9,
      width_depth: 0.3,
      cover: 0.3,
    });
    const fb = generateFeedback(result, baseScenario, undefined, uniformProfile);
    expect(fb.positives.length).toBeLessThanOrEqual(2);
    expect(fb.improvements.length).toBeLessThanOrEqual(2);
  });

  it('PARTIAL: max 1 positive, max 3 improvements', () => {
    const result = makeEval('PARTIAL', { support: 0.9 });
    const fb = generateFeedback(result, baseScenario, undefined, uniformProfile);
    expect(fb.positives.length).toBeLessThanOrEqual(1);
    expect(fb.improvements.length).toBeLessThanOrEqual(3);
  });

  it('ERROR: 0 positives, 0 improvements', () => {
    const result = makeEval('ERROR');
    const fb = generateFeedback(result, baseScenario, undefined, uniformProfile);
    expect(fb.positives).toHaveLength(0);
    expect(fb.improvements).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 2. IDEAL contradiction cleanup
// ---------------------------------------------------------------------------

describe('IDEAL contradiction cleanup', () => {
  it('IDEAL with width_depth=0.55: no improvement generated (>0.5 filtered)', () => {
    // 0.55 is below 0.6 so it enters improvementCandidates, but >0.5 so
    // the IDEAL cleanup pass filters it out.
    const result = makeEval('IDEAL', { ...allHighScores, width_depth: 0.55 });
    const fb = generateFeedback(result, baseScenario, undefined, uniformProfile);
    expect(fb.improvements).not.toContain('You did not maintain team shape');
    // width_depth was the only borderline component; all others scored > 0.8,
    // so no improvements should survive at all.
    expect(fb.improvements).toHaveLength(0);
  });

  it('IDEAL with width_depth=0.3: improvement survives (genuinely weak ≤0.5)', () => {
    const result = makeEval('IDEAL', { ...allHighScores, width_depth: 0.3 });
    const fb = generateFeedback(result, baseScenario, undefined, uniformProfile);
    expect(fb.improvements).toContain('You did not maintain team shape');
  });

  it('IDEAL with all scores > 0.8: 0 improvements', () => {
    const result = makeEval('IDEAL', allHighScores);
    const fb = generateFeedback(result, baseScenario, undefined, uniformProfile);
    expect(fb.improvements).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Failure summary contradiction cleanup
// ---------------------------------------------------------------------------

describe('Failure summary contradiction cleanup', () => {
  it("summary containing 'too flat': success-implying positives stripped", () => {
    const scenario: Scenario = {
      ...baseScenario,
      feedback_hints: { common_error: 'Position is too flat to be effective' },
    };
    // PARTIAL uses common_error as summary
    const result = makeEval('PARTIAL', { width_depth: 0.9, passing_lane: 0.9 });
    const fb = generateFeedback(result, scenario, undefined, uniformProfile);
    expect(fb.positives).not.toContain('You preserved team structure');
    expect(fb.positives).not.toContain('You made yourself available for a pass');
  });

  it("summary containing 'does not meet': success-implying positives stripped", () => {
    const scenario: Scenario = {
      ...baseScenario,
      feedback_hints: { common_error: 'Positioning does not meet tactical needs' },
    };
    const result = makeEval('PARTIAL', { width_depth: 0.9, passing_lane: 0.9 });
    const fb = generateFeedback(result, scenario, undefined, uniformProfile);
    expect(fb.positives).not.toContain('You preserved team structure');
    expect(fb.positives).not.toContain('You made yourself available for a pass');
  });

  it('summary without failure fragments: positives preserved', () => {
    const scenario: Scenario = {
      ...baseScenario,
      feedback_hints: { success: 'Great positioning overall' },
    };
    const result = makeEval('IDEAL', allHighScores);
    const fb = generateFeedback(result, scenario, undefined, uniformProfile);
    // 'Great positioning overall' has no failure fragments, positives should remain
    expect(fb.positives.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Zero-weight component exclusion
// ---------------------------------------------------------------------------

describe('Zero-weight component exclusion', () => {
  const zeroWeightProfile: WeightProfile = {
    profile_id: 'selective_test',
    version: 1,
    weights: {
      support: 0.3,
      passing_lane: 0.3,
      spacing: 0.4,
      pressure_relief: 0.0,
      width_depth: 0.0,
      cover: 0.0,
      region_fit: 0.0,
    },
  };

  it('components with weight=0 never generate positives', () => {
    const result = makeEval('IDEAL', allHighScores);
    const fb = generateFeedback(result, baseScenario, undefined, zeroWeightProfile);
    expect(fb.positives).not.toContain('You helped relieve pressure');
    expect(fb.positives).not.toContain('You preserved team structure');
    expect(fb.positives).not.toContain('You provided defensive cover');
  });

  it('components with weight=0 never generate improvements', () => {
    const result = makeEval('INVALID', allLowScores);
    const fb = generateFeedback(result, baseScenario, undefined, zeroWeightProfile);
    expect(fb.improvements).not.toContain('Your position did not relieve pressure effectively');
    expect(fb.improvements).not.toContain('You did not maintain team shape');
    expect(fb.improvements).not.toContain('You were not in a strong covering position');
  });

  it('only weighted components appear in feedback', () => {
    const result = makeEval('VALID', {
      support: 0.9,
      passing_lane: 0.9,
      spacing: 0.9,
      pressure_relief: 0.9,
      width_depth: 0.3,
      cover: 0.3,
    });
    const fb = generateFeedback(result, baseScenario, undefined, zeroWeightProfile);
    const allFeedback = [...fb.positives, ...fb.improvements];
    expect(allFeedback).not.toContain('You helped relieve pressure');
    expect(allFeedback).not.toContain('Your position did not relieve pressure effectively');
    expect(allFeedback).not.toContain('You preserved team structure');
    expect(allFeedback).not.toContain('You did not maintain team shape');
    expect(allFeedback).not.toContain('You provided defensive cover');
    expect(allFeedback).not.toContain('You were not in a strong covering position');
  });
});

// ---------------------------------------------------------------------------
// 5. Authored hint precedence
// ---------------------------------------------------------------------------

describe('Authored hint precedence', () => {
  it('IDEAL + hints.success → uses authored success summary', () => {
    const scenario: Scenario = {
      ...baseScenario,
      feedback_hints: { success: 'Perfect pocket run!' },
    };
    const result = makeEval('IDEAL');
    const fb = generateFeedback(result, scenario, undefined, uniformProfile);
    expect(fb.summary).toBe('Perfect pocket run!');
  });

  it('VALID + hints.success → uses authored success summary', () => {
    const scenario: Scenario = {
      ...baseScenario,
      feedback_hints: { success: 'Good pocket run!' },
    };
    const result = makeEval('VALID', {
      support: 0.9,
      passing_lane: 0.9,
      spacing: 0.9,
      pressure_relief: 0.9,
      width_depth: 0.5,
      cover: 0.5,
    });
    const fb = generateFeedback(result, scenario, undefined, uniformProfile);
    expect(fb.summary).toBe('Good pocket run!');
  });

  it('PARTIAL + hints.common_error → uses authored error summary', () => {
    const scenario: Scenario = {
      ...baseScenario,
      feedback_hints: { common_error: 'You dropped too deep.' },
    };
    const result = makeEval('PARTIAL');
    const fb = generateFeedback(result, scenario, undefined, uniformProfile);
    expect(fb.summary).toBe('You dropped too deep.');
  });

  it('INVALID + hints.common_error → uses authored error summary', () => {
    const scenario: Scenario = {
      ...baseScenario,
      feedback_hints: { common_error: 'Position was too central.' },
    };
    const result = makeEval('INVALID');
    const fb = generateFeedback(result, scenario, undefined, uniformProfile);
    expect(fb.summary).toBe('Position was too central.');
  });

  it('ALTERNATE_VALID + hints.alternate_valid → uses authored alt summary', () => {
    const scenario: Scenario = {
      ...baseScenario,
      feedback_hints: { alternate_valid: 'Wide run is also valid here.' },
    };
    const result = makeEval('ALTERNATE_VALID');
    const fb = generateFeedback(result, scenario, undefined, uniformProfile);
    expect(fb.summary).toBe('Wide run is also valid here.');
  });

  it('authored success_points take precedence for positives', () => {
    const scenario: Scenario = {
      ...baseScenario,
      feedback_hints: {
        success: 'Nice work!',
        success_points: ['Found the pocket', 'Opened the passing lane'],
      },
    };
    const result = makeEval('IDEAL');
    const fb = generateFeedback(result, scenario, undefined, uniformProfile);
    expect(fb.positives).toContain('Found the pocket');
    expect(fb.positives).toContain('Opened the passing lane');
    // Generic component text should not appear when authored bullets exist
    expect(fb.positives).not.toContain('You created a strong support angle');
  });

  it('authored error_points take precedence for improvements', () => {
    const scenario: Scenario = {
      ...baseScenario,
      feedback_hints: {
        common_error: 'Not quite right.',
        error_points: ['Too narrow', 'Lost the passing angle'],
      },
    };
    const result = makeEval('INVALID');
    const fb = generateFeedback(result, scenario, undefined, uniformProfile);
    expect(fb.improvements).toContain('Too narrow');
    expect(fb.improvements).toContain('Lost the passing angle');
    expect(fb.improvements).not.toContain('Your support angle could be improved');
  });

  it('authored alternate_points take precedence for ALTERNATE_VALID positives', () => {
    const scenario: Scenario = {
      ...baseScenario,
      feedback_hints: {
        alternate_valid: 'Wide option works too.',
        alternate_points: ['Good width', 'Stretched the defence'],
      },
    };
    const result = makeEval('ALTERNATE_VALID');
    const fb = generateFeedback(result, scenario, undefined, uniformProfile);
    expect(fb.positives).toContain('Good width');
    expect(fb.positives).toContain('Stretched the defence');
    expect(fb.positives).not.toContain('You created a strong support angle');
  });

  it('teaching_emphasis always passes through', () => {
    const scenario: Scenario = {
      ...baseScenario,
      feedback_hints: { teaching_emphasis: 'Always check your shoulder before receiving.' },
    };
    for (const rt of ['IDEAL', 'VALID', 'PARTIAL', 'INVALID', 'ALTERNATE_VALID'] as ResultType[]) {
      const result = makeEval(rt);
      const fb = generateFeedback(result, scenario, undefined, uniformProfile);
      expect(fb.teaching_emphasis).toBe('Always check your shoulder before receiving.');
    }
  });
});

// ---------------------------------------------------------------------------
// 6. PARTIAL result feedback
// ---------------------------------------------------------------------------

describe('PARTIAL result feedback', () => {
  it('PARTIAL: max 1 positive, max 3 improvements', () => {
    // Give one component a high score so it can produce a positive
    const result = makeEval('PARTIAL', { support: 0.9 });
    const fb = generateFeedback(result, baseScenario, undefined, uniformProfile);
    expect(fb.positives.length).toBeLessThanOrEqual(1);
    expect(fb.improvements.length).toBeLessThanOrEqual(3);
    expect(fb.improvements.length).toBeGreaterThan(0);
  });

  it('PARTIAL with hints.common_error → uses error summary', () => {
    const scenario: Scenario = {
      ...baseScenario,
      feedback_hints: { common_error: 'Almost — you needed more width.' },
    };
    const result = makeEval('PARTIAL');
    const fb = generateFeedback(result, scenario, undefined, uniformProfile);
    expect(fb.summary).toBe('Almost — you needed more width.');
  });

  it("PARTIAL without hints → uses generic 'Partially correct positioning.'", () => {
    const result = makeEval('PARTIAL');
    const fb = generateFeedback(result, baseScenario, undefined, uniformProfile);
    expect(fb.summary).toBe('Partially correct positioning.');
  });
});
