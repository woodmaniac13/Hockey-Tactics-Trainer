import type { EvaluationResult, FeedbackResult, Scenario, ResultType, ReasoningOption } from '../types';

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
  const { phase, tags } = scenario;
  if (phase === 'attack' && tags.includes('support')) {
    return 'The player should support the ball carrier to create a safe passing option.';
  }
  if (phase === 'defence' && tags.includes('cover')) {
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

export function generateFeedback(
  result: EvaluationResult,
  scenario: Scenario,
  reasoning?: ReasoningOption,
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
    const score = result.component_scores[key];
    if (score >= 0.7 && POSITIVES[key]) {
      positives.push(POSITIVES[key]);
    } else if (score < 0.6 && IMPROVEMENTS[key]) {
      improvements.push(IMPROVEMENTS[key]);
    }
  }

  return {
    score: result.score,
    result_type: result.result_type,
    summary: SUMMARIES[result.result_type],
    positives,
    improvements,
    tactical_explanation: getTacticalExplanation(scenario),
    reasoning_feedback: getReasoningFeedback(reasoning, result),
  };
}
