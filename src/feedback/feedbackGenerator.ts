import type { EvaluationResult, FeedbackResult, Scenario, ResultType, ReasoningOption, WeightProfile } from '../types';

const SUMMARIES: Record<ResultType, string> = {
  IDEAL: 'Excellent positioning.',
  VALID: 'Good positioning with minor improvements.',
  ALTERNATE_VALID: 'Valid solution using a different approach.',
  PARTIAL: 'Partially correct positioning.',
  INVALID: 'Positioning does not meet tactical requirements.',
  ERROR: 'Unable to generate feedback.',
};

const POSITIVES: Record<string, string> = {
  support: 'You created a strong support angle',
  passing_lane: 'You made yourself available for a pass',
  spacing: 'You maintained good spacing',
  pressure_relief: 'You helped relieve pressure',
  width_depth: 'You preserved team structure',
  cover: 'You provided defensive cover',
};

const IMPROVEMENTS: Record<string, string> = {
  support: 'Your support angle could be improved',
  passing_lane: 'You were not a clear passing option',
  spacing: 'You were too close to a teammate',
  pressure_relief: 'Your position did not relieve pressure effectively',
  width_depth: 'You did not maintain team shape',
  cover: 'You were not in a strong covering position',
};

/**
 * Per-outcome caps on positives and improvements.
 * These gates are the primary mechanism for eliminating mixed-signal feedback —
 * e.g. an INVALID result can never produce positives, and an IDEAL result shows
 * at most one improvement.
 */
const OUTCOME_GATE: Record<ResultType, { maxPositives: number; maxImprovements: number }> = {
  IDEAL:           { maxPositives: 3, maxImprovements: 1 },
  VALID:           { maxPositives: 3, maxImprovements: 2 },
  ALTERNATE_VALID: { maxPositives: 2, maxImprovements: 2 },
  PARTIAL:         { maxPositives: 1, maxImprovements: 3 },
  INVALID:         { maxPositives: 0, maxImprovements: 3 },
  ERROR:           { maxPositives: 0, maxImprovements: 0 },
};

/**
 * Generic positives that imply tactical success.
 * Suppressed via the contradiction cleanup pass when the outcome is
 * failure-oriented (PARTIAL or INVALID).
 */
const SUCCESS_IMPLYING_PHRASES: ReadonlySet<string> = new Set([
  POSITIVES.width_depth,
  POSITIVES.passing_lane,
]);

function getTacticalExplanation(scenario: Scenario): string {
  // Use authored teaching_point as the primary tactical explanation when available.
  if (scenario.teaching_point) return scenario.teaching_point;

  // Fall back to phase + concept matching for scenarios without an authored teaching point.
  const { phase, tags, primary_concept } = scenario;
  if (phase === 'attack' && (tags.includes('support') || primary_concept === 'support')) {
    return 'The player should support the ball carrier to create a safe passing option.';
  }
  if (phase === 'defence' && (tags.includes('cover') || primary_concept === 'cover')) {
    return 'Defenders should protect the central channel before pressing wide.';
  }
  if (phase === 'transition') {
    return 'Quick movement helps transition between phases effectively.';
  }
  return 'Good positioning supports team structure and enables passing options.';
}

function getReasoningFeedback(
  reasoning: ReasoningOption | undefined,
  result: EvaluationResult,
): string {
  if (!reasoning) return '';
  const bonus = result.component_scores.reasoning_bonus;
  if (bonus >= 0.8) return 'Your tactical reasoning aligned well with the scenario objectives.';
  if (bonus >= 0.5) return 'Your tactical reasoning was partially correct.';
  return 'Your tactical reasoning did not fully match the scenario objectives.';
}

/**
 * Generates human-readable feedback from a scored evaluation result.
 *
 * The summary, positives, and improvements are derived from component scores.
 * When a `weightProfile` is provided, only components with non-zero weight are
 * considered — this prevents generic "You provided defensive cover" messages in
 * scenarios where cover is irrelevant (weight 0).
 *
 * Authored `feedback_hints` on the scenario override the generic summaries when
 * the result type matches. The `teaching_emphasis` hint, if present, is passed
 * through to the result for persistent display after every attempt.
 *
 * Outcome gating (OUTCOME_GATE) enforces per-result-type caps on positives and
 * improvements to eliminate mixed-signal feedback. Authored scenario bullet
 * arrays (`success_points`, `error_points`, `alternate_points`) take precedence
 * over the generic component-text fallback. A final contradiction cleanup pass
 * removes remaining inconsistencies between the summary and the bullet lists.
 */
export function generateFeedback(
  result: EvaluationResult,
  scenario: Scenario,
  reasoning?: ReasoningOption,
  weightProfile?: WeightProfile,
): FeedbackResult {
  if (result.result_type === 'ERROR') {
    return {
      score: 0,
      result_type: 'ERROR',
      summary: SUMMARIES.ERROR,
      positives: [],
      improvements: [],
      tactical_explanation: '',
      reasoning_feedback: '',
    };
  }

  const gate = OUTCOME_GATE[result.result_type];
  const hints = scenario.feedback_hints;

  // 1. Determine summary from authored hints first, so the contradiction
  //    cleanup pass in section 4 can compare against it.
  let summary = SUMMARIES[result.result_type];
  if (hints) {
    if ((result.result_type === 'IDEAL' || result.result_type === 'VALID') && hints.success) {
      summary = hints.success;
    } else if ((result.result_type === 'PARTIAL' || result.result_type === 'INVALID') && hints.common_error) {
      summary = hints.common_error;
    } else if (result.result_type === 'ALTERNATE_VALID' && hints.alternate_valid) {
      summary = hints.alternate_valid;
    }
  }

  // 2. Collect scored component candidates, skipping zero-weight components.
  const componentKeys = ['support', 'passing_lane', 'spacing', 'pressure_relief', 'width_depth', 'cover'] as const;
  type ComponentEntry = { key: typeof componentKeys[number]; score: number; weight: number };

  const positiveCandidates: ComponentEntry[] = [];
  const improvementCandidates: ComponentEntry[] = [];

  for (const key of componentKeys) {
    // Skip components that carry zero weight — they are irrelevant to this
    // scenario and would only produce noise (e.g. "defensive cover" in a
    // build-out scenario).
    const weight = weightProfile?.weights[key] ?? 1;
    if (weight === 0) continue;

    const score = result.component_scores[key];
    if (score >= 0.8) {
      positiveCandidates.push({ key, score, weight });
    } else if (score < 0.6) {
      improvementCandidates.push({ key, score, weight });
    }
  }

  // Sort by weighted importance: best positives first, worst improvements first.
  positiveCandidates.sort((a, b) => (b.score * b.weight) - (a.score * a.weight));
  improvementCandidates.sort((a, b) => (a.score * a.weight) - (b.score * b.weight));

  // 3. Build positives and improvements, preferring authored scenario bullets
  //    over generic component text. Fall back to generic only when authored
  //    bullets are absent.
  const isSuccess = result.result_type === 'IDEAL' || result.result_type === 'VALID';
  const isFailure = result.result_type === 'PARTIAL' || result.result_type === 'INVALID';
  const isAlt = result.result_type === 'ALTERNATE_VALID';

  let positives: string[];
  let improvements: string[];

  if (isSuccess && hints?.success_points && hints.success_points.length > 0) {
    positives = hints.success_points.slice(0, gate.maxPositives);
    improvements = improvementCandidates.slice(0, gate.maxImprovements).map(c => IMPROVEMENTS[c.key]);
  } else if (isAlt && hints?.alternate_points && hints.alternate_points.length > 0) {
    positives = hints.alternate_points.slice(0, gate.maxPositives);
    improvements = improvementCandidates.slice(0, gate.maxImprovements).map(c => IMPROVEMENTS[c.key]);
  } else if (isFailure && hints?.error_points && hints.error_points.length > 0) {
    positives = positiveCandidates.slice(0, gate.maxPositives).map(c => POSITIVES[c.key]);
    improvements = hints.error_points.slice(0, gate.maxImprovements);
  } else {
    positives = positiveCandidates.slice(0, gate.maxPositives).map(c => POSITIVES[c.key]);
    improvements = improvementCandidates.slice(0, gate.maxImprovements).map(c => IMPROVEMENTS[c.key]);
  }

  // 4. Contradiction cleanup pass.

  // 4a. For IDEAL results, suppress improvements where the component score is
  //     above 0.5 — those are not genuine weaknesses worth surfacing.
  //     Re-filter directly from improvementCandidates to avoid any reliance on
  //     index correspondence with the previously built improvements array.
  if (result.result_type === 'IDEAL') {
    const genuinelyWeak = improvementCandidates.filter(e => e.score <= 0.5);
    improvements = genuinelyWeak.slice(0, gate.maxImprovements).map(c => IMPROVEMENTS[c.key]);
  }

  // 4b. When the outcome is failure-oriented (PARTIAL or INVALID), strip any
  //     generic positives that imply tactical success — they would contradict
  //     the coaching message regardless of what the summary text says.
  //     This is outcome-driven rather than phrase-matched, avoiding brittleness
  //     when authors use different failure-message wording.
  if (isFailure) {
    positives = positives.filter(p => !SUCCESS_IMPLYING_PHRASES.has(p));
  }

  return {
    score: result.score,
    result_type: result.result_type,
    summary,
    positives,
    improvements,
    tactical_explanation: getTacticalExplanation(scenario),
    reasoning_feedback: getReasoningFeedback(reasoning, result),
    teaching_emphasis: hints?.teaching_emphasis,
  };
}
