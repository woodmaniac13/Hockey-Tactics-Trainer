import { describe, it, expect } from 'vitest';
import { getScenarioState, getWeaknessTag, getRecommendedScenario, getAverageScoreByDifficulty } from '../progression/progression';
import type { Scenario, ProgressRecord } from '../types';

const makeScenario = (id: string, difficulty: number, tags: string[]): Scenario => ({
  scenario_id: id,
  version: 1,
  title: id,
  description: '',
  phase: 'attack',
  team_orientation: 'home_attacks_positive_x',
  target_player: 'p1',
  ball: { x: 50, y: 50 },
  teammates: [{ id: 'p1', role: 'CM', team: 'home', x: 50, y: 50 }],
  opponents: [],
  pressure: { direction: 'none', intensity: 'low' },
  ideal_regions: [],
  acceptable_regions: [],
  weight_profile: 'build_out_v1',
  constraint_thresholds: {},
  difficulty,
  tags,
});

const makeRecord = (best: number): ProgressRecord => ({
  version: 1,
  best_score: best,
  last_score: best,
  attempt_count: 1,
  last_played: Date.now(),
});

describe('getScenarioState', () => {
  const scenarios = [
    makeScenario('S1', 1, ['support']),
    makeScenario('S2', 2, ['cover']),
  ];

  it('difficulty 1 is always AVAILABLE', () => {
    const state = getScenarioState('S1', {}, 1, {}, scenarios);
    expect(state).toBe('AVAILABLE');
  });

  it('difficulty 2 is LOCKED without completed difficulty 1', () => {
    const state = getScenarioState('S2', {}, 2, {}, scenarios);
    expect(state).toBe('LOCKED');
  });

  it('difficulty 2 is AVAILABLE when difficulty 1 average >= 80', () => {
    const progress = { S1: makeRecord(85) };
    const state = getScenarioState('S2', progress, 2, progress, scenarios);
    expect(state).toBe('AVAILABLE');
  });

  it('returns COMPLETED when best_score >= 80', () => {
    const progress = { S1: makeRecord(90) };
    const state = getScenarioState('S1', progress, 1, progress, scenarios);
    expect(state).toBe('COMPLETED');
  });
});

describe('getWeaknessTag', () => {
  const scenarios = [
    makeScenario('S1', 1, ['support']),
    makeScenario('S2', 1, ['cover']),
  ];

  it('returns null with no progress', () => {
    expect(getWeaknessTag({}, scenarios)).toBeNull();
  });

  it('returns the tag with the lowest average score', () => {
    const progress = {
      S1: makeRecord(90),
      S2: makeRecord(40),
    };
    expect(getWeaknessTag(progress, scenarios)).toBe('cover');
  });
});

describe('getRecommendedScenario', () => {
  const scenarios = [
    makeScenario('S1', 1, ['support']),
    makeScenario('S2', 1, ['cover']),
  ];

  it('recommends unplayed scenario first', () => {
    const rec = getRecommendedScenario({}, scenarios);
    expect(rec?.scenario_id).toBe('S1');
  });

  it('recommends incomplete scenario', () => {
    const progress = { S1: makeRecord(90) };
    const rec = getRecommendedScenario(progress, scenarios);
    expect(rec?.scenario_id).toBe('S2');
  });
});

describe('getAverageScoreByDifficulty', () => {
  const scenarios = [
    makeScenario('S1', 1, ['support']),
    makeScenario('S2', 1, ['cover']),
    makeScenario('S3', 2, ['attack']),
  ];

  it('returns 0 for difficulty with no records', () => {
    expect(getAverageScoreByDifficulty({}, scenarios, 1)).toBe(0);
  });

  it('returns correct average', () => {
    const progress = { S1: makeRecord(80), S2: makeRecord(60) };
    expect(getAverageScoreByDifficulty(progress, scenarios, 1)).toBe(70);
  });
});
