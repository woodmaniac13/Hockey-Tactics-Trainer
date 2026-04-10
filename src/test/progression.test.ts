import { describe, it, expect } from 'vitest';
import { getScenarioState, getWeaknessTag, getRecommendedScenario, getAverageScoreByDifficulty, getUnmetPrerequisites } from '../progression/progression';
import type { Scenario, ProgressRecord } from '../types';

const makeScenario = (id: string, difficulty: number, tags: string[], extra?: Partial<Scenario>): Scenario => ({
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
  ...extra,
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
    const state = getScenarioState('S1', 1, {}, scenarios);
    expect(state).toBe('AVAILABLE');
  });

  it('difficulty 2 is LOCKED without completed difficulty 1', () => {
    const state = getScenarioState('S2', 2, {}, scenarios);
    expect(state).toBe('LOCKED');
  });

  it('difficulty 2 is AVAILABLE when difficulty 1 average >= 80', () => {
    const progress = { S1: makeRecord(85) };
    const state = getScenarioState('S2', 2, progress, scenarios);
    expect(state).toBe('AVAILABLE');
  });

  it('returns COMPLETED when best_score >= 80', () => {
    const progress = { S1: makeRecord(90) };
    const state = getScenarioState('S1', 1, progress, scenarios);
    expect(state).toBe('COMPLETED');
  });
});

describe('getScenarioState — prerequisite gating', () => {
  it('LOCKED when prerequisite is not completed', () => {
    const scenarios = [
      makeScenario('S1', 1, ['support']),
      makeScenario('S2', 1, ['cover'], { prerequisites: ['S1'] }),
    ];
    // S1 not completed — S2 should be LOCKED despite being difficulty 1
    const state = getScenarioState('S2', 1, {}, scenarios);
    expect(state).toBe('LOCKED');
  });

  it('AVAILABLE when all prerequisites are completed', () => {
    const scenarios = [
      makeScenario('S1', 1, ['support']),
      makeScenario('S2', 1, ['cover'], { prerequisites: ['S1'] }),
    ];
    const progress = { S1: makeRecord(85) };
    const state = getScenarioState('S2', 1, progress, scenarios);
    expect(state).toBe('AVAILABLE');
  });

  it('LOCKED when one of multiple prerequisites is not completed', () => {
    const scenarios = [
      makeScenario('S1', 1, ['support']),
      makeScenario('S2', 1, ['cover']),
      makeScenario('S3', 1, ['transition'], { prerequisites: ['S1', 'S2'] }),
    ];
    const progress = { S1: makeRecord(85) }; // S2 not done
    const state = getScenarioState('S3', 1, progress, scenarios);
    expect(state).toBe('LOCKED');
  });

  it('prerequisite met with score exactly 80 unlocks scenario', () => {
    const scenarios = [
      makeScenario('S1', 1, ['support']),
      makeScenario('S2', 1, ['cover'], { prerequisites: ['S1'] }),
    ];
    const progress = { S1: makeRecord(80) };
    const state = getScenarioState('S2', 1, progress, scenarios);
    expect(state).toBe('AVAILABLE');
  });
});

describe('getUnmetPrerequisites', () => {
  it('returns empty array when no prerequisites defined', () => {
    const scenario = makeScenario('S1', 1, ['support']);
    expect(getUnmetPrerequisites(scenario, {})).toEqual([]);
  });

  it('returns IDs of unmet prerequisites', () => {
    const scenario = makeScenario('S2', 1, ['cover'], { prerequisites: ['S1', 'S3'] });
    const progress = { S1: makeRecord(85) }; // S3 not done
    expect(getUnmetPrerequisites(scenario, progress)).toEqual(['S3']);
  });

  it('returns empty array when all prerequisites are completed', () => {
    const scenario = makeScenario('S2', 1, ['cover'], { prerequisites: ['S1'] });
    const progress = { S1: makeRecord(85) };
    expect(getUnmetPrerequisites(scenario, progress)).toEqual([]);
  });

  it('prerequisite with score below 80 is still unmet', () => {
    const scenario = makeScenario('S2', 1, ['cover'], { prerequisites: ['S1'] });
    const progress = { S1: makeRecord(70) };
    expect(getUnmetPrerequisites(scenario, progress)).toEqual(['S1']);
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

describe('getRecommendedScenario — curriculum ordering', () => {
  it('within same curriculum_group, recommends lower learning_stage first', () => {
    const scenarios = [
      makeScenario('S1', 1, [], { curriculum_group: 'basics', learning_stage: 2 }),
      makeScenario('S2', 1, [], { curriculum_group: 'basics', learning_stage: 1 }),
    ];
    const rec = getRecommendedScenario({}, scenarios);
    expect(rec?.scenario_id).toBe('S2');
  });

  it('scenarios with curriculum_group are preferred over those without', () => {
    const scenarios = [
      makeScenario('S1', 1, []),
      makeScenario('S2', 1, [], { curriculum_group: 'basics', learning_stage: 1 }),
    ];
    const rec = getRecommendedScenario({}, scenarios);
    expect(rec?.scenario_id).toBe('S2');
  });

  it('falls back to first unplayed when no curriculum metadata', () => {
    const scenarios = [
      makeScenario('S1', 1, []),
      makeScenario('S2', 1, []),
    ];
    const rec = getRecommendedScenario({}, scenarios);
    expect(rec?.scenario_id).toBe('S1');
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
