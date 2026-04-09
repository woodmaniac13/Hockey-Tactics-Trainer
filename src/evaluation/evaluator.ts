import type {
  Scenario,
  Point,
  WeightProfile,
  EvaluationResult,
  ComponentScores,
  ResultType,
  ReasoningOption,
  TacticalRegion,
  TacticalRegionGeometry,
  SemanticRegion,
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

/** Score player distance to ball against an optimal band. Returns 0–1. */
function computeDistanceToBallScore(
  dist: number,
  optimalMin: number,
  optimalMax: number,
): number {
  if (dist >= optimalMin && dist <= optimalMax) return 1.0;
  if (dist < optimalMin) return clamp(dist / optimalMin, 0, 1);
  return clamp(1 - (dist - optimalMax) / optimalMax, 0, 1);
}

function computeSupportScore(
  playerPos: Point,
  ball: Point,
  scenario: Scenario,
  weightProfile: WeightProfile,
): number {
  const toBall = normalize({ x: ball.x - playerPos.x, y: ball.y - playerPos.y });
  const pressureVec = pressureToVector(scenario.pressure.direction);

  // Angle-based component
  let angleScore: number;
  if (pressureVec.x === 0 && pressureVec.y === 0) {
    angleScore = 0.8;
  } else {
    const perpPressure = perpendicular(pressureVec);
    const angle = angleBetween(toBall, perpPressure);
    if (angle >= 30 && angle <= 60) angleScore = 1.0;
    else if (angle >= 15 && angle < 30) angleScore = lerp((angle - 15) / 15, 0.6, 1.0);
    else if (angle > 60 && angle <= 75) angleScore = lerp((75 - angle) / 15, 0.6, 1.0);
    else if (angle < 15) angleScore = lerp(angle / 15, 0.0, 0.6);
    else angleScore = lerp(clamp((90 - angle) / 15, 0, 1), 0.0, 0.6);
  }

  // Distance-to-ball band component
  const distConfig = weightProfile.component_config?.distance_to_ball;
  const optimalMin = distConfig?.optimal_min ?? 8;
  const optimalMax = distConfig?.optimal_max ?? 25;
  const dist = distance(playerPos, ball);
  const distScore = computeDistanceToBallScore(dist, optimalMin, optimalMax);

  // Blend: angle is primary (70%), distance-to-ball band is secondary (30%)
  return clamp(0.7 * angleScore + 0.3 * distScore, 0, 1);
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

/** Returns true if playerPos is inside a circle-shaped region (legacy or tagged). */
function isInsideCircle(playerPos: Point, x: number, y: number, r: number): boolean {
  return distance(playerPos, { x, y }) <= r;
}

/** Returns true if playerPos is inside an axis-aligned or rotated rectangle region. */
function isInsideRectangle(
  playerPos: Point,
  rx: number,
  ry: number,
  width: number,
  height: number,
  rotation?: number,
): boolean {
  if (!rotation) {
    return playerPos.x >= rx && playerPos.x <= rx + width &&
           playerPos.y >= ry && playerPos.y <= ry + height;
  }
  const cx = rx + width / 2;
  const cy = ry + height / 2;
  const cos = Math.cos(-rotation);
  const sin = Math.sin(-rotation);
  const localX = cos * (playerPos.x - cx) - sin * (playerPos.y - cy);
  const localY = sin * (playerPos.x - cx) + cos * (playerPos.y - cy);
  return Math.abs(localX) <= width / 2 && Math.abs(localY) <= height / 2;
}

/** Returns true if playerPos is inside a polygon using the ray-casting algorithm. */
function isInsidePolygon(playerPos: Point, vertices: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].x, yi = vertices[i].y;
    const xj = vertices[j].x, yj = vertices[j].y;
    const intersect =
      yi > playerPos.y !== yj > playerPos.y &&
      playerPos.x < ((xj - xi) * (playerPos.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Returns true if playerPos is within width/2 of the lane spine segment. */
function isInsideLane(
  playerPos: Point,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
): boolean {
  const dist = pointToLineDistance(playerPos, { x: x1, y: y1 }, { x: x2, y: y2 });
  return dist <= width / 2;
}

// ─── Semantic region resolution ──────────────────────────────────────────────

/** Returns true when a region carries semantic metadata (i.e. is a SemanticRegion). */
function isSemanticRegion(region: TacticalRegion): region is SemanticRegion {
  return 'geometry' in region;
}

/**
 * Returns the reference origin for a semantic region's reference frame.
 * Pitch-relative regions use the zero origin (no translation required).
 * Returns null if the reference entity cannot be found.
 */
function getReferencePointForRegion(region: SemanticRegion, scenario: Scenario): Point | null {
  const frame = region.reference_frame ?? 'pitch';
  switch (frame) {
    case 'pitch':
      return { x: 0, y: 0 };
    case 'ball':
      return scenario.ball;
    case 'target_player': {
      const target = scenario.teammates.find(t => t.id === scenario.target_player);
      return target ? { x: target.x, y: target.y } : null;
    }
    case 'entity': {
      const entities = [...scenario.teammates, ...scenario.opponents];
      const ref = entities.find(e => e.id === region.reference_entity_id);
      return ref ? { x: ref.x, y: ref.y } : null;
    }
    default:
      return null;
  }
}

/**
 * Translates all coordinate fields of a geometry primitive by the given origin offset.
 * Used to convert entity-relative / ball-relative regions into pitch-space.
 */
function translateGeometry(geometry: TacticalRegionGeometry, origin: Point): TacticalRegionGeometry {
  switch (geometry.type) {
    case 'circle':
      return { ...geometry, x: geometry.x + origin.x, y: geometry.y + origin.y };
    case 'rectangle':
      return { ...geometry, x: geometry.x + origin.x, y: geometry.y + origin.y };
    case 'polygon':
      return {
        ...geometry,
        vertices: geometry.vertices.map(v => ({ x: v.x + origin.x, y: v.y + origin.y })),
      };
    case 'lane':
      return {
        ...geometry,
        x1: geometry.x1 + origin.x,
        y1: geometry.y1 + origin.y,
        x2: geometry.x2 + origin.x,
        y2: geometry.y2 + origin.y,
      };
    default: {
      // TypeScript exhaustiveness guard — should never be reached with a valid TacticalRegionGeometry.
      const _exhaustive: never = geometry;
      return _exhaustive;
    }
  }
}

/**
 * Resolves a TacticalRegion into pitch-space geometry ready for hit-testing.
 * Raw geometry is returned as-is.
 * Semantic regions are translated according to their reference frame.
 * Returns null if the reference entity cannot be found (safe fallback — treated as no hit).
 */
function resolveRegionGeometry(region: TacticalRegion, scenario: Scenario): TacticalRegionGeometry | null {
  if (!isSemanticRegion(region)) return region;
  const frame = region.reference_frame ?? 'pitch';
  if (frame === 'pitch') return region.geometry;
  const origin = getReferencePointForRegion(region, scenario);
  if (!origin) return null;
  return translateGeometry(region.geometry, origin);
}

// ─── Geometry hit-testing ──────────────────────────────────────────────────

function computeRegionFitScore(playerPos: Point, scenario: Scenario): number {
  for (const region of scenario.ideal_regions) {
    if (isRegionHit(playerPos, region, scenario)) return 1.0;
  }
  for (const region of scenario.acceptable_regions) {
    if (isRegionHit(playerPos, region, scenario)) {
      // Resolve to geometry to determine whether to apply the circle gradient.
      const resolved = resolveRegionGeometry(region, scenario);
      if (resolved && resolved.type === 'circle') {
        const cr = resolved as { x: number; y: number; r: number };
        const d = distance(playerPos, { x: cr.x, y: cr.y });
        const ratio = 1 - d / cr.r;
        return lerp(ratio, 0.6, 0.9);
      }
      // For non-circle shapes, return a fixed mid-range acceptable score.
      return 0.75;
    }
  }
  return 0.0;
}

function isRegionHit(playerPos: Point, region: TacticalRegion, scenario: Scenario): boolean {
  const resolved = resolveRegionGeometry(region, scenario);
  if (!resolved) return false;
  return isResolvedGeometryHit(playerPos, resolved);
}

/** Hit-tests a player position against an already-resolved pitch-space geometry. */
function isResolvedGeometryHit(playerPos: Point, region: TacticalRegionGeometry): boolean {
  switch (region.type) {
    case 'circle':
      return isInsideCircle(playerPos, region.x, region.y, region.r);
    case 'rectangle':
      return isInsideRectangle(playerPos, region.x, region.y, region.width, region.height, region.rotation);
    case 'polygon':
      return isInsidePolygon(playerPos, region.vertices);
    case 'lane':
      return isInsideLane(playerPos, region.x1, region.y1, region.x2, region.y2, region.width);
    default:
      return false;
  }
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

    const support = computeSupportScore(playerPos, ball, scenario, weightProfile);
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

    // Warn when the authored weights do not sum to 1.0 — the evaluator normalizes
    // at runtime so scoring is unaffected, but the log helps catch authoring mistakes.
    const scoringWeightSum = Object.values(w).reduce((a, b) => a + b, 0);
    if (scoringWeightSum > 0 && Math.abs(scoringWeightSum - 1.0) > 0.001) {
      console.warn(
        `Weight profile "${weightProfile.profile_id}" scoring weights sum to ` +
        `${scoringWeightSum.toFixed(4)} (expected 1.0); normalizing at evaluation time.`,
      );
    }

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
