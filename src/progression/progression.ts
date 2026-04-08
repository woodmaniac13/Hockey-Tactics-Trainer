import type { ProgressRecord, Scenario, ScenarioState } from '../types';

export function getScenarioState(
  scenarioId: string,
  _progress: Record<string, ProgressRecord>,
  difficulty: number,
  allProgress: Record<string, ProgressRecord>,
  allScenarios: Scenario[],
): ScenarioState {
  const record = allProgress[scenarioId];
  if (record && record.best_score >= 80) return 'COMPLETED';
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

export function getRecommendedScenario(
  progress: Record<string, ProgressRecord>,
  scenarios: Scenario[],
): Scenario | null {
  const weakTag = getWeaknessTag(progress, scenarios);
  if (weakTag) {
    const tagScenarios = scenarios.filter(s => s.tags.includes(weakTag) && (!progress[s.scenario_id] || progress[s.scenario_id].best_score < 80));
    if (tagScenarios.length > 0) return tagScenarios[0];
  }
  const unplayed = scenarios.filter(s => !progress[s.scenario_id]);
  if (unplayed.length > 0) return unplayed[0];
  const incomplete = scenarios.filter(s => progress[s.scenario_id] && progress[s.scenario_id].best_score < 80);
  if (incomplete.length > 0) {
    return incomplete.sort((a, b) => (progress[a.scenario_id]?.best_score ?? 0) - (progress[b.scenario_id]?.best_score ?? 0))[0];
  }
  return null;
}
