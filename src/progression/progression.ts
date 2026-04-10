import type { ProgressRecord, Scenario, ScenarioState } from '../types';

/**
 * Returns the list of prerequisite scenario IDs that have not yet been completed (best_score < 80).
 * Returns an empty array when all prerequisites are met or the scenario has none.
 */
export function getUnmetPrerequisites(
  scenario: Scenario,
  allProgress: Record<string, ProgressRecord>,
): string[] {
  if (!scenario.prerequisites || scenario.prerequisites.length === 0) return [];
  return scenario.prerequisites.filter(prereqId => {
    const rec = allProgress[prereqId];
    return !rec || rec.best_score < 80;
  });
}

export function getScenarioState(
  scenarioId: string,
  _progress: Record<string, ProgressRecord>,
  difficulty: number,
  allProgress: Record<string, ProgressRecord>,
  allScenarios: Scenario[],
): ScenarioState {
  const record = allProgress[scenarioId];
  if (record && record.best_score >= 80) return 'COMPLETED';

  // Check prerequisite gating before difficulty gating
  const scenario = allScenarios.find(s => s.scenario_id === scenarioId);
  if (scenario) {
    const unmet = getUnmetPrerequisites(scenario, allProgress);
    if (unmet.length > 0) return 'LOCKED';
  }

  if (difficulty === 1) return 'AVAILABLE';
  const prevDiffAvg = getAverageScoreByDifficulty(allProgress, allScenarios, difficulty - 1);
  if (prevDiffAvg >= 80) return 'AVAILABLE';
  return 'LOCKED';
}

export function getAverageScoreByDifficulty(
  progress: Record<string, ProgressRecord>,
  scenarios: Scenario[],
  difficulty: number,
): number {
  const atDifficulty = scenarios.filter(s => s.difficulty === difficulty);
  if (atDifficulty.length === 0) return 0;
  let total = 0;
  let count = 0;
  for (const s of atDifficulty) {
    const rec = progress[s.scenario_id];
    if (rec) {
      total += rec.best_score;
      count++;
    }
  }
  if (count === 0) return 0;
  return total / count;
}

export function getWeaknessTag(
  progress: Record<string, ProgressRecord>,
  scenarios: Scenario[],
): string | null {
  const tagScores: Record<string, { total: number; count: number }> = {};
  for (const scenario of scenarios) {
    const rec = progress[scenario.scenario_id];
    if (!rec) continue;
    for (const tag of scenario.tags) {
      if (!tagScores[tag]) tagScores[tag] = { total: 0, count: 0 };
      tagScores[tag].total += rec.best_score;
      tagScores[tag].count++;
    }
  }
  let weakestTag: string | null = null;
  let lowestAvg = Infinity;
  for (const [tag, data] of Object.entries(tagScores)) {
    const avg = data.total / data.count;
    if (avg < lowestAvg) {
      lowestAvg = avg;
      weakestTag = tag;
    }
  }
  return weakestTag;
}

/**
 * Returns the recommended next scenario for the user to attempt.
 *
 * Selection priority:
 * 1. Weakness-tag unplayed scenario (targets identified weak area)
 * 2. Curriculum-ordered unplayed: within curriculum groups, prefer lower learning_stage first
 * 3. Any unplayed scenario
 * 4. Lowest-scored incomplete scenario
 */
export function getRecommendedScenario(
  progress: Record<string, ProgressRecord>,
  scenarios: Scenario[],
): Scenario | null {
  // 1. Weakness tag — unplayed scenario that addresses the weak area
  const weakTag = getWeaknessTag(progress, scenarios);
  if (weakTag) {
    const tagScenarios = scenarios.filter(
      s => s.tags.includes(weakTag) && (!progress[s.scenario_id] || progress[s.scenario_id].best_score < 80),
    );
    if (tagScenarios.length > 0) return tagScenarios[0];
  }

  // 2. Curriculum-ordered unplayed: scenarios with a curriculum_group are preferred over those without.
  // Within curriculum groups, sort by group name then by learning_stage ascending.
  const unplayed = scenarios.filter(s => !progress[s.scenario_id]);
  if (unplayed.length > 0) {
    const withCurriculum = unplayed
      .filter(s => s.curriculum_group !== undefined)
      .sort((a, b) => {
        if (a.curriculum_group !== b.curriculum_group) {
          return a.curriculum_group!.localeCompare(b.curriculum_group!);
        }
        return (a.learning_stage ?? 0) - (b.learning_stage ?? 0);
      });
    if (withCurriculum.length > 0) return withCurriculum[0];
    return unplayed[0];
  }

  // 3. Lowest-scored incomplete
  const incomplete = scenarios.filter(s => progress[s.scenario_id] && progress[s.scenario_id].best_score < 80);
  if (incomplete.length > 0) {
    return incomplete.sort(
      (a, b) => (progress[a.scenario_id]?.best_score ?? 0) - (progress[b.scenario_id]?.best_score ?? 0),
    )[0];
  }
  return null;
}

