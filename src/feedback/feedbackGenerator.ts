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

  const positives: string[] = [];
  const improvements: string[] = [];

  const componentKeys = ['support', 'passing_lane', 'spacing', 'pressure_relief', 'width_depth', 'cover'] as const;
  for (const key of componentKeys) {
    // Skip components that carry zero weight — they are irrelevant to this
    // scenario and would only produce noise (e.g. "defensive cover" in a
    // build-out scenario).
    const weight = weightProfile?.weights[key] ?? 1;
    if (weight === 0) continue;

    const score = result.component_scores[key];
    if (score >= 0.8 && POSITIVES[key]) {
      positives.push(POSITIVES[key]);
    } else if (score < 0.6 && IMPROVEMENTS[key]) {
      improvements.push(IMPROVEMENTS[key]);
    }
  }

  // Determine the authored summary override from feedback_hints based on result type
  const hints = scenario.feedback_hints;
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
