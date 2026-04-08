import type {
  Scenario,
  Point,
  WeightProfile,
  EvaluationResult,
  ComponentScores,
  ResultType,
  ReasoningOption,
} from '../types';
import {
  distance,
  angleBetween,
  normalize,
  perpendicular,
  pointToLineDistance,
  pressureToVector,
} from '../utils/geometry';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Maximum additive bonus from reasoning alignment (10% of max normalized score). */
const REASONING_BONUS_CAP = 0.1;

function lerp(t: number, lo: number, hi: number): number {
  return lo + t * (hi - lo);
}

function computeSupportScore(
  playerPos: Point,
  ball: Point,
  scenario: Scenario,
): number {
  const toBall = normalize({ x: ball.x - playerPos.x, y: ball.y - playerPos.y });
  const pressureVec = pressureToVector(scenario.pressure.direction);
  if (pressureVec.x === 0 && pressureVec.y === 0) return 0.8;
  const perpPressure = perpendicular(pressureVec);
  const angle = angleBetween(toBall, perpPressure);
  if (angle >= 30 && angle <= 60) return 1.0;
  if (angle >= 15 && angle < 30) return lerp((angle - 15) / 15, 0.6, 1.0);
  if (angle > 60 && angle <= 75) return lerp((75 - angle) / 15, 0.6, 1.0);
  if (angle < 15) return lerp(angle / 15, 0.0, 0.6);
  return lerp(clamp((90 - angle) / 15, 0, 1), 0.0, 0.6);
}

function computePassingLaneScore(
  playerPos: Point,
  ball: Point,
  scenario: Scenario,
  weightProfile: WeightProfile,
): number {
  const blockThreshold = weightProfile.component_config?.passing_lane?.block_threshold ?? 5;
  let blocked = false;
  for (const opp of scenario.opponents) {
    const dist = pointToLineDistance({ x: opp.x, y: opp.y }, ball, playerPos);
    if (dist < blockThreshold) {
      blocked = true;
      break;
    }
  }
  if (!blocked) return 1.0;
  return 0.5;
}

function computeSpacingScore(
  playerPos: Point,
  scenario: Scenario,
  weightProfile: WeightProfile,
): number {
  const minDist = weightProfile.component_config?.spacing?.min_distance ?? 8;
  const teammates = scenario.teammates.filter(t => t.id !== scenario.target_player);
  if (teammates.length === 0) return 1.0;
  let minFound = Infinity;
  for (const tm of teammates) {
    const d = distance(playerPos, { x: tm.x, y: tm.y });
    if (d < minFound) minFound = d;
  }
  if (minFound >= minDist) return 1.0;
  return clamp(minFound / minDist, 0, 1);
}

function computePressureReliefScore(
  playerPos: Point,
  ball: Point,
  scenario: Scenario,
): number {
  const pressureVec = pressureToVector(scenario.pressure.direction);
  if (pressureVec.x === 0 && pressureVec.y === 0) return 0.8;
  const toPlayer = normalize({ x: playerPos.x - ball.x, y: playerPos.y - ball.y });
  const angle = angleBetween(toPlayer, pressureVec);
  return clamp(angle / 90, 0, 1);
}

function computeWidthDepthScore(
  playerPos: Point,
  ball: Point,
  scenario: Scenario,
): number {
  const xDiff = Math.abs(playerPos.x - ball.x);
  const yDiff = Math.abs(playerPos.y - ball.y);
  const optimalMin = 8;
  const optimalMax = 30;
  let xScore = 0;
  if (xDiff >= optimalMin && xDiff <= optimalMax) {
    xScore = 1.0;
  } else if (xDiff < optimalMin) {
    xScore = xDiff / optimalMin;
  } else {
    xScore = clamp(1 - (xDiff - optimalMax) / optimalMax, 0, 1);
  }
  let yScore = 0;
  if (yDiff >= optimalMin && yDiff <= optimalMax) {
    yScore = 1.0;
  } else if (yDiff < optimalMin) {
    yScore = yDiff / optimalMin;
  } else {
    yScore = clamp(1 - (yDiff - optimalMax) / optimalMax, 0, 1);
  }
  if (scenario.phase === 'attack' || scenario.phase === 'defence') return lerp(0.5, xScore, yScore);
  return (xScore + yScore) / 2;
}

function computeCoverScore(
  playerPos: Point,
  scenario: Scenario,
): number {
  if (scenario.phase !== 'defence') return 0.7;
  const centralY = 50;
  const yDist = Math.abs(playerPos.y - centralY);
  const xScore = clamp(1 - playerPos.x / 100, 0, 1);
  const yScore = clamp(1 - yDist / 50, 0, 1);
  return (xScore + yScore) / 2;
}

function computeRegionFitScore(playerPos: Point, scenario: Scenario): number {
  for (const region of scenario.ideal_regions) {
    const d = distance(playerPos, { x: region.x, y: region.y });
    if (d <= region.r) return 1.0;
  }
  for (const region of scenario.acceptable_regions) {
    const d = distance(playerPos, { x: region.x, y: region.y });
    if (d <= region.r) {
      const ratio = 1 - d / region.r;
      return lerp(ratio, 0.6, 0.9);
    }
  }
  return 0.0;
}

function computeReasoningBonus(
  reasoning: ReasoningOption | undefined,
  scenario: Scenario,
): number {
  if (!reasoning) return 0;
  const tag = scenario.tags[0] ?? '';
  const alignmentMap: Record<string, string[]> = {
    support: ['create_passing_angle', 'support_under_pressure'],
    cover: ['provide_cover'],
    attack: ['create_passing_angle', 'enable_switch'],
    transition: ['enable_switch', 'support_under_pressure'],
  };
  const goodOptions = alignmentMap[tag] ?? alignmentMap[scenario.phase] ?? [];
  return goodOptions.includes(reasoning) ? 1.0 : 0.0;
}

function checkConstraints(
  componentScores: ComponentScores,
  scenario: Scenario,
): string[] {
  const failed: string[] = [];
  const thresholds = scenario.constraint_thresholds;
  const check = (key: keyof typeof thresholds, score: number) => {
    const t = thresholds[key];
    if (t !== undefined && score < t) failed.push(key);
  };
  check('support', componentScores.support);
  check('passing_lane', componentScores.passing_lane);
  check('spacing', componentScores.spacing);
  check('pressure_relief', componentScores.pressure_relief);
  check('width_depth', componentScores.width_depth);
  check('cover', componentScores.cover);
  return failed;
}

function classifyResult(
  finalScore: number,
  regionFitScore: number,
  constraintsPassed: boolean,
): ResultType {
  if (constraintsPassed && regionFitScore === 1.0 && finalScore >= 80) return 'IDEAL';
  if (constraintsPassed && regionFitScore === 0) return 'ALTERNATE_VALID';
  if (constraintsPassed && (regionFitScore > 0 || finalScore >= 65)) return 'VALID';
  if (constraintsPassed && finalScore >= 40) return 'PARTIAL';
  return 'INVALID';
}

export function evaluate(
  scenario: Scenario,
  playerPos: Point,
  weightProfile: WeightProfile,
  reasoning?: ReasoningOption,
): EvaluationResult {
  try {
    const ball = scenario.ball;

    const support = computeSupportScore(playerPos, ball, scenario);
    const passing_lane = computePassingLaneScore(playerPos, ball, scenario, weightProfile);
    const spacing = computeSpacingScore(playerPos, scenario, weightProfile);
    const pressure_relief = computePressureReliefScore(playerPos, ball, scenario);
    const width_depth = computeWidthDepthScore(playerPos, ball, scenario);
    const cover = computeCoverScore(playerPos, scenario);
    const region_fit = computeRegionFitScore(playerPos, scenario);
    const reasoning_bonus_raw = computeReasoningBonus(reasoning, scenario);

    const weights = weightProfile.weights;
    const w = {
      support: weights.support ?? 0,
      passing_lane: weights.passing_lane ?? 0,
      spacing: weights.spacing ?? 0,
      pressure_relief: weights.pressure_relief ?? 0,
      width_depth: weights.width_depth ?? 0,
      cover: weights.cover ?? 0,
      region_fit: weights.region_fit ?? 0,
    };

    const weightedSum =
      support * w.support +
      passing_lane * w.passing_lane +
      spacing * w.spacing +
      pressure_relief * w.pressure_relief +
      width_depth * w.width_depth +
      cover * w.cover +
      region_fit * w.region_fit;

    const totalWeight = Object.values(w).reduce((a, b) => a + b, 0);
    const normalizedScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
    const safeScore = isNaN(normalizedScore) ? 0 : normalizedScore;

    // Reasoning bonus: additive, capped at +10% of max score
    const reasoningBonusWeight = weights.reasoning_bonus ?? 0;
    const reasoningBonusCapped = Math.min(reasoning_bonus_raw * reasoningBonusWeight, REASONING_BONUS_CAP);
    const scoredWithBonus = clamp(safeScore + reasoningBonusCapped, 0, 1);
    const score = Math.round(clamp(scoredWithBonus * 100, 0, 100));

    // Store reasoning_bonus as the raw 0/1 alignment signal for feedback
    const componentScores: ComponentScores = {
      support,
      passing_lane,
      spacing,
      pressure_relief,
      width_depth,
      cover,
      region_fit,
      reasoning_bonus: reasoning_bonus_raw,
    };

    const failed_constraints = checkConstraints(componentScores, scenario);
    const constraints_passed = failed_constraints.length === 0;
    const result_type = classifyResult(score, region_fit, constraints_passed);

    return {
      score,
      result_type,
      component_scores: componentScores,
      constraints_passed,
      region_fit_score: region_fit,
      failed_constraints,
    };
  } catch {
    return {
      score: 0,
      result_type: 'ERROR',
      component_scores: {
        support: 0,
        passing_lane: 0,
        spacing: 0,
        pressure_relief: 0,
        width_depth: 0,
        cover: 0,
        region_fit: 0,
        reasoning_bonus: 0,
      },
      constraints_passed: false,
      region_fit_score: 0,
      failed_constraints: ['evaluation_error'],
    };
  }
}
