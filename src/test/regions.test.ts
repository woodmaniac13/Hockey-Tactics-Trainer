import { describe, it, expect } from 'vitest';
import { isSemanticRegion, resolveRegionGeometry, translateGeometry } from '../utils/regions';
import type { Scenario, TacticalRegion, TacticalRegionGeometry } from '../types';

const baseScenario: Scenario = {
  scenario_id: 'TEST',
  version: 1,
  title: 'Test',
  description: '',
  phase: 'attack',
  team_orientation: 'home_attacks_positive_x',
  target_player: 'p1',
  ball: { x: 40, y: 60 },
  teammates: [
    { id: 'p1', role: 'CM', team: 'home', x: 55, y: 45 },
    { id: 'p2', role: 'CB', team: 'home', x: 20, y: 30 },
  ],
  opponents: [
    { id: 'opp1', role: 'FW', team: 'away', x: 50, y: 50 },
  ],
  pressure: { direction: 'none', intensity: 'low' },
  ideal_regions: [],
  acceptable_regions: [],
  weight_profile: 'test_v1',
  constraint_thresholds: {},
  difficulty: 1,
  tags: [],
};

describe('isSemanticRegion', () => {
  it('returns true for a region with geometry field', () => {
    const region: TacticalRegion = {
      label: 'pocket',
      geometry: { type: 'circle', x: 50, y: 50, r: 10 },
    };
    expect(isSemanticRegion(region)).toBe(true);
  });

  it('returns false for a raw circle region', () => {
    const region: TacticalRegion = { type: 'circle', x: 50, y: 50, r: 10 };
    expect(isSemanticRegion(region)).toBe(false);
  });

  it('returns false for a raw rectangle region', () => {
    const region: TacticalRegion = { type: 'rectangle', x: 30, y: 30, width: 20, height: 10 };
    expect(isSemanticRegion(region)).toBe(false);
  });
});

describe('resolveRegionGeometry', () => {
  it('returns raw geometry as-is for a tagged circle', () => {
    const region: TacticalRegion = { type: 'circle', x: 50, y: 50, r: 10 };
    const result = resolveRegionGeometry(region, baseScenario);
    expect(result).toEqual({ type: 'circle', x: 50, y: 50, r: 10 });
  });

  it('returns geometry as-is for pitch-relative semantic region (no translation)', () => {
    const region: TacticalRegion = {
      label: 'central_pocket',
      reference_frame: 'pitch',
      geometry: { type: 'circle', x: 50, y: 50, r: 10 },
    };
    const result = resolveRegionGeometry(region, baseScenario);
    expect(result).toEqual({ type: 'circle', x: 50, y: 50, r: 10 });
  });

  it('returns geometry as-is for semantic region with no reference_frame (defaults to pitch)', () => {
    const region: TacticalRegion = {
      geometry: { type: 'circle', x: 50, y: 50, r: 10 },
    };
    const result = resolveRegionGeometry(region, baseScenario);
    expect(result).toEqual({ type: 'circle', x: 50, y: 50, r: 10 });
  });

  it('translates ball-relative region by ball position', () => {
    // ball at (40, 60); geometry offset (5, -5) → pitch (45, 55)
    const region: TacticalRegion = {
      reference_frame: 'ball',
      geometry: { type: 'circle', x: 5, y: -5, r: 8 },
    };
    const result = resolveRegionGeometry(region, baseScenario);
    expect(result).toEqual({ type: 'circle', x: 45, y: 55, r: 8 });
  });

  it('translates target_player-relative region by target player position', () => {
    // target p1 at (55, 45); geometry offset (0, 10) → pitch (55, 55)
    const region: TacticalRegion = {
      reference_frame: 'target_player',
      geometry: { type: 'circle', x: 0, y: 10, r: 6 },
    };
    const result = resolveRegionGeometry(region, baseScenario);
    expect(result).toEqual({ type: 'circle', x: 55, y: 55, r: 6 });
  });

  it('translates entity-relative region by the named entity position', () => {
    // opp1 at (50, 50); geometry offset (-5, 0) → pitch (45, 50)
    const region: TacticalRegion = {
      reference_frame: 'entity',
      reference_entity_id: 'opp1',
      geometry: { type: 'circle', x: -5, y: 0, r: 5 },
    };
    const result = resolveRegionGeometry(region, baseScenario);
    expect(result).toEqual({ type: 'circle', x: 45, y: 50, r: 5 });
  });

  it('returns null when entity reference cannot be found', () => {
    const region: TacticalRegion = {
      reference_frame: 'entity',
      reference_entity_id: 'nonexistent',
      geometry: { type: 'circle', x: 0, y: 0, r: 10 },
    };
    const result = resolveRegionGeometry(region, baseScenario);
    expect(result).toBeNull();
  });
});

describe('translateGeometry', () => {
  it('translates circle coordinates', () => {
    const geo: TacticalRegionGeometry = { type: 'circle', x: 10, y: 20, r: 5 };
    const result = translateGeometry(geo, { x: 30, y: 40 });
    expect(result).toEqual({ type: 'circle', x: 40, y: 60, r: 5 });
  });

  it('translates rectangle top-left corner', () => {
    const geo: TacticalRegionGeometry = { type: 'rectangle', x: 5, y: 5, width: 10, height: 8 };
    const result = translateGeometry(geo, { x: 20, y: 10 });
    expect(result).toEqual({ type: 'rectangle', x: 25, y: 15, width: 10, height: 8 });
  });

  it('translates all polygon vertices', () => {
    const geo: TacticalRegionGeometry = {
      type: 'polygon',
      vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
    };
    const result = translateGeometry(geo, { x: 5, y: 5 });
    expect(result).toEqual({
      type: 'polygon',
      vertices: [{ x: 5, y: 5 }, { x: 15, y: 5 }, { x: 15, y: 15 }],
    });
  });

  it('translates lane endpoints', () => {
    const geo: TacticalRegionGeometry = { type: 'lane', x1: 0, y1: 0, x2: 20, y2: 0, width: 8 };
    const result = translateGeometry(geo, { x: 10, y: 5 });
    expect(result).toEqual({ type: 'lane', x1: 10, y1: 5, x2: 30, y2: 5, width: 8 });
  });
});
