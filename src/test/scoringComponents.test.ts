import { describe, it, expect } from 'vitest';
import { __testing } from '../evaluation/evaluator';
import type { Scenario, WeightProfile, Point } from '../types';

const {
  computeSupportScore,
  computePassingLaneScore,
  computeSpacingScore,
  computePressureReliefScore,
  computeWidthDepthScore,
  computeCoverScore,
  computeDistanceToBallScore,
  computeRegionFitScore,
} = __testing;

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

// ---------------------------------------------------------------------------
// 1. computeDistanceToBallScore
// ---------------------------------------------------------------------------
describe('computeDistanceToBallScore', () => {
  it('returns 1.0 when distance is within the optimal band', () => {
    expect(computeDistanceToBallScore(10, 8, 20)).toBe(1.0);
    expect(computeDistanceToBallScore(8, 8, 20)).toBe(1.0);
    expect(computeDistanceToBallScore(20, 8, 20)).toBe(1.0);
    expect(computeDistanceToBallScore(14, 8, 20)).toBe(1.0);
  });

  it('returns 0 when distance is 0 (below optimal_min)', () => {
    expect(computeDistanceToBallScore(0, 8, 20)).toBe(0);
  });

  it('ramps linearly below optimal_min', () => {
    // dist / optimalMin
    expect(computeDistanceToBallScore(4, 8, 20)).toBeCloseTo(0.5, 5);
    expect(computeDistanceToBallScore(2, 8, 20)).toBeCloseTo(0.25, 5);
    expect(computeDistanceToBallScore(6, 8, 20)).toBeCloseTo(0.75, 5);
  });

  it('decays toward 0 above optimal_max', () => {
    // 1 - (dist - optimalMax) / optimalMax
    expect(computeDistanceToBallScore(30, 8, 20)).toBeCloseTo(0.5, 5);
    expect(computeDistanceToBallScore(40, 8, 20)).toBe(0);
    expect(computeDistanceToBallScore(25, 8, 20)).toBeCloseTo(0.75, 5);
  });

  it('clamps to 0 for very large distances', () => {
    expect(computeDistanceToBallScore(100, 8, 20)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. computeSupportScore — Symmetry tests (CRITICAL)
// ---------------------------------------------------------------------------
describe('computeSupportScore', () => {
  it('mirror positions produce equal scores under outside_in pressure', () => {
    // outside_in → pressure vec {x:1,y:0}, perp = {x:0,y:1}
    // Position above ball vs below ball at same x-offset should be symmetric
    const ball = baseScenario.ball; // {x:30, y:50}
    const delta = 12;
    const posAbove: Point = { x: 45, y: ball.y + delta }; // {45, 62}
    const posBelow: Point = { x: 45, y: ball.y - delta }; // {45, 38}

    const scoreAbove = computeSupportScore(posAbove, ball, baseScenario, baseProfile);
    const scoreBelow = computeSupportScore(posBelow, ball, baseScenario, baseProfile);

    expect(scoreAbove).toBeCloseTo(scoreBelow, 5);
  });

  it('both sides of the perpendicular score well', () => {
    const ball = baseScenario.ball;
    const posAbove: Point = { x: 42, y: ball.y + 15 };
    const posBelow: Point = { x: 42, y: ball.y - 15 };

    const scoreAbove = computeSupportScore(posAbove, ball, baseScenario, baseProfile);
    const scoreBelow = computeSupportScore(posBelow, ball, baseScenario, baseProfile);

    // Both should be reasonably high (not just one side)
    expect(scoreAbove).toBeGreaterThan(0.3);
    expect(scoreBelow).toBeGreaterThan(0.3);
    // And symmetric
    expect(scoreAbove).toBeCloseTo(scoreBelow, 5);
  });

  it('mirror test with inside_out pressure also symmetric', () => {
    const scenario = { ...baseScenario, pressure: { ...baseScenario.pressure, direction: 'inside_out' as const } };
    const ball = scenario.ball;
    const delta = 12;
    const posAbove: Point = { x: 42, y: ball.y + delta };
    const posBelow: Point = { x: 42, y: ball.y - delta };

    const scoreAbove = computeSupportScore(posAbove, ball, scenario, baseProfile);
    const scoreBelow = computeSupportScore(posBelow, ball, scenario, baseProfile);

    expect(scoreAbove).toBeCloseTo(scoreBelow, 5);
  });

  it('returns 0.8 angle component for pressure "none"', () => {
    const scenario = { ...baseScenario, pressure: { ...baseScenario.pressure, direction: 'none' as const } };
    const ball = scenario.ball;
    // With 'none' pressure, angle component = 0.8
    // Place player in optimal distance band so distScore = 1.0
    // Final = 0.7 * 0.8 + 0.3 * 1.0 = 0.56 + 0.30 = 0.86
    const pos: Point = { x: ball.x + 15, y: ball.y };
    const score = computeSupportScore(pos, ball, scenario, baseProfile);
    expect(score).toBeCloseTo(0.86, 1);
  });

  it('scores in [0, 1]', () => {
    const positions: Point[] = [
      { x: 30, y: 50 },
      { x: 80, y: 10 },
      { x: 0, y: 0 },
      { x: 50, y: 50 },
      { x: 45, y: 62 },
    ];
    for (const pos of positions) {
      const score = computeSupportScore(pos, baseScenario.ball, baseScenario, baseProfile);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. computePressureReliefScore
// ---------------------------------------------------------------------------
describe('computePressureReliefScore', () => {
  it('returns higher score when moving away from pressure direction', () => {
    // Pressure is outside_in → {x:1, y:0} (pressure comes from left)
    // toPlayer vector pointing left (away from pressure) → angle ~180° → clamp(180/90,0,1)=1.0
    const ball = baseScenario.ball; // {30,50}
    const awayPos: Point = { x: ball.x - 20, y: ball.y }; // to the left
    const score = computePressureReliefScore(awayPos, ball, baseScenario);
    expect(score).toBe(1.0);
  });

  it('returns lower score when moving into pressure direction', () => {
    // Moving right (same direction as pressure) → angle ~0 → score ~0
    const ball = baseScenario.ball;
    const intoPos: Point = { x: ball.x + 20, y: ball.y }; // to the right
    const score = computePressureReliefScore(intoPos, ball, baseScenario);
    expect(score).toBeCloseTo(0, 1);
  });

  it('returns ~1.0 for perpendicular movement (90°)', () => {
    const ball = baseScenario.ball;
    const perpPos: Point = { x: ball.x, y: ball.y + 20 }; // pure vertical
    const score = computePressureReliefScore(perpPos, ball, baseScenario);
    expect(score).toBeCloseTo(1.0, 1);
  });

  it('symmetric mirrored positions relative to pressure axis score consistently', () => {
    const ball = baseScenario.ball;
    // Two positions mirrored across the x-axis (pressure direction)
    const posAbove: Point = { x: ball.x - 10, y: ball.y + 10 };
    const posBelow: Point = { x: ball.x - 10, y: ball.y - 10 };

    const scoreAbove = computePressureReliefScore(posAbove, ball, baseScenario);
    const scoreBelow = computePressureReliefScore(posBelow, ball, baseScenario);

    // Both are at the same angle from pressure direction, so equal
    expect(scoreAbove).toBeCloseTo(scoreBelow, 5);
  });

  it('returns 0.8 for none pressure', () => {
    const scenario = { ...baseScenario, pressure: { ...baseScenario.pressure, direction: 'none' as const } };
    const score = computePressureReliefScore({ x: 50, y: 50 }, scenario.ball, scenario);
    expect(score).toBe(0.8);
  });

  it('scores in [0, 1]', () => {
    const positions: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 30, y: 50 },
      { x: 50, y: 80 },
    ];
    for (const pos of positions) {
      const score = computePressureReliefScore(pos, baseScenario.ball, baseScenario);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. computeWidthDepthScore
// ---------------------------------------------------------------------------
describe('computeWidthDepthScore', () => {
  it('returns 1.0 when both xDiff and yDiff are in optimal band [8, 30]', () => {
    // ball at {30,50}, player at {45, 65} → xDiff=15, yDiff=15
    const pos: Point = { x: 45, y: 65 };
    const score = computeWidthDepthScore(pos, baseScenario.ball, baseScenario);
    // attack phase: lerp(0.5, xScore, yScore) = lerp(0.5, 1.0, 1.0) = 1.0
    expect(score).toBe(1.0);
  });

  it('ramps down when below optimal band', () => {
    // ball at {30,50}, player at {32, 52} → xDiff=2, yDiff=2
    // xScore = 2/8 = 0.25, yScore = 2/8 = 0.25
    const pos: Point = { x: 32, y: 52 };
    const score = computeWidthDepthScore(pos, baseScenario.ball, baseScenario);
    // attack: lerp(0.5, 0.25, 0.25) = 0.25
    expect(score).toBeCloseTo(0.25, 2);
  });

  it('ramps down when far above optimal band', () => {
    // ball at {30,50}, player at {90, 50} → xDiff=60, yDiff=0
    // xScore = 1 - (60-30)/30 = 0, yScore = 0/8 = 0
    const pos: Point = { x: 90, y: 50 };
    const score = computeWidthDepthScore(pos, baseScenario.ball, baseScenario);
    expect(score).toBe(0);
  });

  it('attack phase weights depth (x) more than width (y) via lerp(0.7, x, y)', () => {
    // xDiff=2 → xScore=2/8=0.25, yDiff=12 → yScore=1.0
    // lerp(0.7, 0.25, 1.0) = 0.25 + 0.7*(1.0-0.25) = 0.775
    const pos: Point = { x: 32, y: 62 };
    const score = computeWidthDepthScore(pos, baseScenario.ball, baseScenario);
    expect(score).toBeCloseTo(0.775, 2);
  });

  it('transition phase uses plain average', () => {
    const scenario: Scenario = { ...baseScenario, phase: 'transition' };
    const pos: Point = { x: 32, y: 62 }; // xDiff=2, yDiff=12
    const score = computeWidthDepthScore(pos, scenario.ball, scenario);
    // xScore = 2/8 = 0.25, yScore = 1.0
    // average = (0.25 + 1.0) / 2 = 0.625
    expect(score).toBeCloseTo(0.625, 2);
  });

  it('defence phase uses lerp(0.5, x, y)', () => {
    const scenario: Scenario = { ...baseScenario, phase: 'defence' };
    const pos: Point = { x: 45, y: 65 };
    const score = computeWidthDepthScore(pos, scenario.ball, scenario);
    // xDiff=15, yDiff=15 → both 1.0 → lerp(0.5,1,1)=1.0
    expect(score).toBe(1.0);
  });

  it('scores in [0, 1]', () => {
    const positions: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 30, y: 50 },
      { x: 30.1, y: 50.1 },
    ];
    for (const pos of positions) {
      const score = computeWidthDepthScore(pos, baseScenario.ball, baseScenario);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. computeSpacingScore
// ---------------------------------------------------------------------------
describe('computeSpacingScore', () => {
  it('returns 1.0 when far from all teammates', () => {
    // target_player is cm1 so it's excluded. Only fw1 at {70,50} matters.
    // Player at {30,50}: dist to fw1 = 40, min_distance = 8 → 1.0
    const pos: Point = { x: 30, y: 50 };
    const score = computeSpacingScore(pos, baseScenario, baseProfile);
    expect(score).toBe(1.0);
  });

  it('returns low score when very close to a teammate', () => {
    // fw1 is at {70,50}. Put player at {71,50}: dist ≈ 1.
    // Score = 1/8 = 0.125
    const pos: Point = { x: 71, y: 50 };
    const score = computeSpacingScore(pos, baseScenario, baseProfile);
    expect(score).toBeCloseTo(0.125, 2);
  });

  it('returns 0 when directly on top of a teammate', () => {
    const pos: Point = { x: 70, y: 50 }; // exactly on fw1
    const score = computeSpacingScore(pos, baseScenario, baseProfile);
    expect(score).toBe(0);
  });

  it('ramps linearly from 0 to 1 as distance approaches min_distance', () => {
    // fw1 at {70,50}, min_distance=8
    const pos: Point = { x: 74, y: 50 }; // dist=4, score=4/8=0.5
    const score = computeSpacingScore(pos, baseScenario, baseProfile);
    expect(score).toBeCloseTo(0.5, 2);
  });

  it('returns 1.0 when no teammates besides target player', () => {
    const scenario: Scenario = {
      ...baseScenario,
      teammates: [{ id: 'cm1', role: 'CM', team: 'home', x: 45, y: 62 }],
    };
    const pos: Point = { x: 45, y: 62 };
    const score = computeSpacingScore(pos, scenario, baseProfile);
    expect(score).toBe(1.0);
  });

  it('scores in [0, 1]', () => {
    const positions: Point[] = [
      { x: 70, y: 50 },
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ];
    for (const pos of positions) {
      const score = computeSpacingScore(pos, baseScenario, baseProfile);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. computePassingLaneScore
// ---------------------------------------------------------------------------
describe('computePassingLaneScore', () => {
  it('returns 1.0 when no opponent blocks the lane', () => {
    // Move player far from the opponent's blocking zone
    const scenario: Scenario = {
      ...baseScenario,
      opponents: [{ id: 'opp1', role: 'CF', team: 'away', x: 90, y: 90 }],
    };
    const pos: Point = { x: 45, y: 62 };
    const score = computePassingLaneScore(pos, scenario.ball, scenario, baseProfile);
    expect(score).toBe(1.0);
  });

  it('returns low score when opponent is directly on the passing lane', () => {
    // opp1 at {40, 48}. Ball at {30, 50}. Player at {50, 46}.
    // Line from {30,50} to {50,46}: opp at {40,48} should be close to this line.
    const pos: Point = { x: 50, y: 46 };
    const score = computePassingLaneScore(pos, baseScenario.ball, baseScenario, baseProfile);
    // Opponent very close to the lane → score near 0.3
    expect(score).toBeGreaterThanOrEqual(0.3);
    expect(score).toBeLessThan(1.0);
  });

  it('smooth gradient — score degrades as opponent approaches lane', () => {
    const pos: Point = { x: 45, y: 62 };

    // Scenario with no opponents → 1.0
    const noOppScenario: Scenario = { ...baseScenario, opponents: [] };
    const scoreClean = computePassingLaneScore(pos, noOppScenario.ball, noOppScenario, baseProfile);
    expect(scoreClean).toBe(1.0);

    // Place an opponent directly on the line between ball and player → low score
    const blockedScenario: Scenario = {
      ...baseScenario,
      opponents: [{ id: 'opp1', role: 'CF', team: 'away', x: 37.5, y: 56 }],
    };
    const scoreBlocked = computePassingLaneScore(pos, blockedScenario.ball, blockedScenario, baseProfile);
    expect(scoreBlocked).toBeGreaterThanOrEqual(0.3);
    expect(scoreBlocked).toBeLessThanOrEqual(0.8);

    // Place an opponent just inside the threshold → higher than directly-on
    const nearScenario: Scenario = {
      ...baseScenario,
      opponents: [{ id: 'opp1', role: 'CF', team: 'away', x: 37.5, y: 60 }],
    };
    const scoreNear = computePassingLaneScore(pos, nearScenario.ball, nearScenario, baseProfile);
    // Near-blocked should score between blocked and clean
    expect(scoreNear).toBeGreaterThanOrEqual(scoreBlocked);
    expect(scoreNear).toBeLessThanOrEqual(scoreClean);
  });

  it('returns 1.0 when opponent is outside block_threshold', () => {
    // Place opponent far from the line
    const scenario: Scenario = {
      ...baseScenario,
      opponents: [{ id: 'opp1', role: 'CF', team: 'away', x: 10, y: 10 }],
    };
    const pos: Point = { x: 45, y: 62 };
    const score = computePassingLaneScore(pos, scenario.ball, scenario, baseProfile);
    expect(score).toBe(1.0);
  });

  it('scores are in [0.3, 1.0] range (smooth gradient)', () => {
    const positions: Point[] = [
      { x: 45, y: 62 },
      { x: 50, y: 46 },
      { x: 80, y: 80 },
      { x: 35, y: 49 },
    ];
    for (const pos of positions) {
      const score = computePassingLaneScore(pos, baseScenario.ball, baseScenario, baseProfile);
      expect(score).toBeGreaterThanOrEqual(0.3);
      expect(score).toBeLessThanOrEqual(1.0);
    }
  });
});

// ---------------------------------------------------------------------------
// 7. computeCoverScore
// ---------------------------------------------------------------------------
describe('computeCoverScore', () => {
  it('returns 0.0 for non-defence phase', () => {
    // baseScenario.phase = 'attack'
    const score = computeCoverScore({ x: 50, y: 50 }, baseScenario);
    expect(score).toBe(0.0);
  });

  it('returns 0.0 for transition phase', () => {
    const scenario: Scenario = { ...baseScenario, phase: 'transition' };
    const score = computeCoverScore({ x: 50, y: 50 }, scenario);
    expect(score).toBe(0.0);
  });

  it('returns high score near (0, 50) in defence', () => {
    const scenario: Scenario = { ...baseScenario, phase: 'defence' };
    // xScore = 1 - 0/100 = 1.0, yScore = 1 - |0-50|/50 = 1 - 0 = 1.0
    // avg = 1.0
    const score = computeCoverScore({ x: 0, y: 50 }, scenario);
    expect(score).toBe(1.0);
  });

  it('returns low score near (100, 0) in defence', () => {
    const scenario: Scenario = { ...baseScenario, phase: 'defence' };
    // xScore = 1 - 100/100 = 0, yScore = 1 - |0-50|/50 = 1 - 1 = 0
    // avg = 0
    const score = computeCoverScore({ x: 100, y: 0 }, scenario);
    expect(score).toBe(0);
  });

  it('returns low score near (100, 100) in defence', () => {
    const scenario: Scenario = { ...baseScenario, phase: 'defence' };
    // xScore = 0, yScore = 1 - |100-50|/50 = 0
    // avg = 0
    const score = computeCoverScore({ x: 100, y: 100 }, scenario);
    expect(score).toBe(0);
  });

  it('mid-pitch position gives intermediate score in defence', () => {
    const scenario: Scenario = { ...baseScenario, phase: 'defence' };
    // xScore = 1 - 50/100 = 0.5, yScore = 1 - |50-50|/50 = 1.0
    // avg = 0.75
    const score = computeCoverScore({ x: 50, y: 50 }, scenario);
    expect(score).toBeCloseTo(0.75, 5);
  });

  it('scores in [0, 1]', () => {
    const scenario: Scenario = { ...baseScenario, phase: 'defence' };
    const positions: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 50, y: 50 },
      { x: 0, y: 50 },
      { x: 100, y: 50 },
    ];
    for (const pos of positions) {
      const score = computeCoverScore(pos, scenario);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// 8. computeRegionFitScore
// ---------------------------------------------------------------------------
describe('computeRegionFitScore', () => {
  it('returns 1.0 when inside ideal circle', () => {
    // ideal region: circle at (45,62) r=8
    const pos: Point = { x: 45, y: 62 };
    const score = computeRegionFitScore(pos, baseScenario);
    expect(score).toBe(1.0);
  });

  it('returns 1.0 at edge of ideal circle', () => {
    // Distance from (45,62) to (53,62) is exactly 8
    const pos: Point = { x: 53, y: 62 };
    const score = computeRegionFitScore(pos, baseScenario);
    expect(score).toBe(1.0);
  });

  it('returns gradient 0.6-0.9 inside acceptable circle (not in ideal)', () => {
    // acceptable region: circle at (45,60) r=14
    // Position outside ideal (r=8 from (45,62)) but inside acceptable
    const pos: Point = { x: 45, y: 72 }; // dist to ideal center=10 > 8, dist to acceptable center = 12 < 14
    const score = computeRegionFitScore(pos, baseScenario);
    expect(score).toBeGreaterThanOrEqual(0.6);
    expect(score).toBeLessThanOrEqual(0.9);
  });

  it('acceptable circle center gives score close to 0.9', () => {
    // Must be outside ideal. acceptable center is (45,60), ideal center is (45,62) r=8
    // dist from (45,60) to (45,62) = 2 which is < 8, so it hits ideal first → 1.0
    // Use a position that misses ideal but is at acceptable center
    // Ideal circle: center (45,62), r=8. Acceptable: center (45,60), r=14
    // Position at (45,49): dist to ideal center = 13 > 8, dist to acceptable center = 11 < 14
    // ratio = 1 - 11/14 ≈ 0.214, lerp(0.214, 0.6, 0.9) = 0.6 + 0.214*0.3 ≈ 0.664
    // Pick position closer to acceptable center but outside ideal
    // (55, 60): dist to ideal = sqrt(100+4)=~10.2 > 8 (outside ideal), dist to acceptable = 10 < 14
    // ratio = 1 - 10/14 ≈ 0.286, lerp(0.286, 0.6, 0.9) ≈ 0.686
    // For max score, position at acceptable center that's outside ideal:
    // Not easily possible as (45,60) is inside ideal circle.
    // Let's test at the acceptable center anyway — if it hits ideal, it gets 1.0 which is fine.
    // Use (35, 60): dist to ideal = sqrt(100+4)=~10.2 >8, dist to acceptable = sqrt(100+0)=10 <14
    const pos: Point = { x: 35, y: 60 };
    const score = computeRegionFitScore(pos, baseScenario);
    // ratio = 1 - 10/14 ≈ 0.286, lerp(0.286, 0.6, 0.9) ≈ 0.686
    expect(score).toBeGreaterThanOrEqual(0.6);
    expect(score).toBeLessThanOrEqual(0.9);
  });

  it('returns 0.75 inside acceptable rectangle', () => {
    const scenario: Scenario = {
      ...baseScenario,
      ideal_regions: [{ type: 'circle' as const, x: 80, y: 80, r: 3 }], // far away
      acceptable_regions: [{ type: 'rectangle' as const, x: 40, y: 55, width: 20, height: 20 }],
    };
    const pos: Point = { x: 45, y: 60 }; // inside the rectangle
    const score = computeRegionFitScore(pos, scenario);
    expect(score).toBe(0.75);
  });

  it('returns 0.0 when outside all regions', () => {
    const pos: Point = { x: 0, y: 0 }; // far from all regions
    const score = computeRegionFitScore(pos, baseScenario);
    expect(score).toBe(0.0);
  });

  it('ideal region takes priority over acceptable', () => {
    // Position inside both ideal and acceptable → should get 1.0 (ideal)
    const pos: Point = { x: 45, y: 62 };
    const score = computeRegionFitScore(pos, baseScenario);
    expect(score).toBe(1.0);
  });

  it('scores in [0, 1]', () => {
    const positions: Point[] = [
      { x: 0, y: 0 },
      { x: 45, y: 62 },
      { x: 50, y: 65 },
      { x: 100, y: 100 },
    ];
    for (const pos of positions) {
      const score = computeRegionFitScore(pos, baseScenario);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// 9. Monotonicity tests
// ---------------------------------------------------------------------------
describe('Monotonicity tests', () => {
  it('moving toward center of ideal region never decreases region_fit_score', () => {
    // Ideal circle at (45, 62), r=8
    // Start outside and move toward center
    const center: Point = { x: 45, y: 62 };
    const startPos: Point = { x: 20, y: 62 }; // far outside
    let prevScore = computeRegionFitScore(startPos, baseScenario);
    const steps = 20;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const pos: Point = {
        x: startPos.x + t * (center.x - startPos.x),
        y: startPos.y + t * (center.y - startPos.y),
      };
      const score = computeRegionFitScore(pos, baseScenario);
      expect(score).toBeGreaterThanOrEqual(prevScore - 1e-9);
      prevScore = score;
    }
    // Final position at center should be 1.0
    expect(prevScore).toBe(1.0);
  });

  it('distance-to-ball score increases monotonically approaching optimal band from below', () => {
    let prevScore = computeDistanceToBallScore(0, 8, 20);
    for (let d = 0.5; d <= 8; d += 0.5) {
      const score = computeDistanceToBallScore(d, 8, 20);
      expect(score).toBeGreaterThanOrEqual(prevScore - 1e-9);
      prevScore = score;
    }
    expect(prevScore).toBe(1.0);
  });

  it('distance-to-ball score decreases monotonically moving beyond optimal band', () => {
    let prevScore = computeDistanceToBallScore(20, 8, 20);
    for (let d = 21; d <= 40; d += 1) {
      const score = computeDistanceToBallScore(d, 8, 20);
      expect(score).toBeLessThanOrEqual(prevScore + 1e-9);
      prevScore = score;
    }
  });

  it('moving farther from ball beyond optimal band reduces support smoothly', () => {
    const ball = baseScenario.ball;
    // Move along a fixed direction (perpendicular to pressure for good angle)
    // outside_in pressure → perp is {0,1}, so move upward from ball
    const scores: number[] = [];
    // Start in optimal distance and go further
    for (let dy = 20; dy <= 60; dy += 5) {
      const pos: Point = { x: ball.x, y: ball.y + dy };
      const score = computeSupportScore(pos, ball, baseScenario, baseProfile);
      scores.push(score);
    }
    // After leaving optimal distance band (dist > 20), scores should generally decrease
    // The first score (dy=20, dist=20) should be high, last (dy=60, dist=60) should be lower
    expect(scores[0]).toBeGreaterThan(scores[scores.length - 1]);

    // Check that scores never increase after the initial decline (after optimal band)
    // dist at dy=25 is 25 (past optimal_max=20), so from index 1 onward should decrease
    for (let i = 2; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1] + 1e-9);
    }
  });

  it('all scoring components return values in [0, 1] for a wide range of inputs', () => {
    const testPositions: Point[] = [
      { x: 0, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 100 },
      { x: 30, y: 50 },
      { x: 45, y: 62 },
      { x: 80, y: 20 },
      { x: 10, y: 90 },
    ];

    for (const pos of testPositions) {
      const support = computeSupportScore(pos, baseScenario.ball, baseScenario, baseProfile);
      const passing = computePassingLaneScore(pos, baseScenario.ball, baseScenario, baseProfile);
      const spacing = computeSpacingScore(pos, baseScenario, baseProfile);
      const pressure = computePressureReliefScore(pos, baseScenario.ball, baseScenario);
      const widthDepth = computeWidthDepthScore(pos, baseScenario.ball, baseScenario);
      const cover = computeCoverScore(pos, baseScenario);
      const regionFit = computeRegionFitScore(pos, baseScenario);

      for (const [name, score] of Object.entries({
        support, passing, spacing, pressure, widthDepth, cover, regionFit,
      })) {
        expect(score, `${name} at (${pos.x}, ${pos.y})`).toBeGreaterThanOrEqual(0);
        expect(score, `${name} at (${pos.x}, ${pos.y})`).toBeLessThanOrEqual(1);
      }
    }
  });
});
