import { describe, it, expect } from 'vitest';
import {
  FIELD_ZONE_BOUNDS,
  CANONICAL_POSITION_ANCHORS,
  NAMED_PITCH_ZONES,
  TACTICAL_DISTANCE_BANDS,
  isPointInZone,
  isPointInZoneX,
  pitchDistance,
  resolvePositionHint,
} from '../utils/pitchConstants';

// ── FIELD_ZONE_BOUNDS ─────────────────────────────────────────────────────────

describe('FIELD_ZONE_BOUNDS', () => {
  it('covers all 12 FieldZone values', () => {
    const expectedZones = [
      'defensive_third_left', 'defensive_third_central', 'defensive_third_right',
      'middle_third_left', 'middle_third_central', 'middle_third_right',
      'attacking_third_left', 'attacking_third_central', 'attacking_third_right',
      'circle_edge_left', 'circle_edge_central', 'circle_edge_right',
    ];
    for (const zone of expectedZones) {
      expect(FIELD_ZONE_BOUNDS).toHaveProperty(zone);
    }
  });

  it('has xMin < xMax and yMin < yMax for every zone', () => {
    for (const [_zone, bounds] of Object.entries(FIELD_ZONE_BOUNDS)) {
      expect(bounds.xMin).toBeLessThan(bounds.xMax);
      expect(bounds.yMin).toBeLessThan(bounds.yMax);
    }
  });

  it('has all x bounds within 0–100', () => {
    for (const [_zone, bounds] of Object.entries(FIELD_ZONE_BOUNDS)) {
      expect(bounds.xMin).toBeGreaterThanOrEqual(0);
      expect(bounds.xMax).toBeLessThanOrEqual(100);
    }
  });

  it('has all y bounds within 0–100', () => {
    for (const [_zone, bounds] of Object.entries(FIELD_ZONE_BOUNDS)) {
      expect(bounds.yMin).toBeGreaterThanOrEqual(0);
      expect(bounds.yMax).toBeLessThanOrEqual(100);
    }
  });

  it('places defensive third at lower x than attacking third', () => {
    expect(FIELD_ZONE_BOUNDS.defensive_third_central.xMax).toBeLessThan(
      FIELD_ZONE_BOUNDS.attacking_third_central.xMin,
    );
  });

  it('places circle_edge fully inside attacking third x range', () => {
    expect(FIELD_ZONE_BOUNDS.circle_edge_central.xMin).toBeGreaterThanOrEqual(
      FIELD_ZONE_BOUNDS.attacking_third_central.xMin,
    );
  });
});

// ── CANONICAL_POSITION_ANCHORS ────────────────────────────────────────────────

describe('CANONICAL_POSITION_ANCHORS', () => {
  it('contains the goalkeeper anchor', () => {
    expect(CANONICAL_POSITION_ANCHORS).toHaveProperty('gk_own_goal');
    expect(CANONICAL_POSITION_ANCHORS.gk_own_goal!.x).toBeLessThan(10);
    expect(CANONICAL_POSITION_ANCHORS.gk_own_goal!.y).toBe(50);
  });

  it('places CB anchors in the defensive x range', () => {
    const cb = CANONICAL_POSITION_ANCHORS.cb_defensive_central!;
    expect(cb.x).toBeGreaterThan(0);
    expect(cb.x).toBeLessThan(30);
  });

  it('places CM anchors in the midfield x range', () => {
    const cm = CANONICAL_POSITION_ANCHORS.cm_midfield_central!;
    expect(cm.x).toBeGreaterThanOrEqual(30);
    expect(cm.x).toBeLessThanOrEqual(65);
  });

  it('places CF anchors in the attacking x range', () => {
    const cf = CANONICAL_POSITION_ANCHORS.cf_circle_edge_central!;
    expect(cf.x).toBeGreaterThanOrEqual(65);
  });

  it('has all anchor coordinates within 0–100', () => {
    for (const [_key, anchor] of Object.entries(CANONICAL_POSITION_ANCHORS)) {
      expect(anchor.x).toBeGreaterThanOrEqual(0);
      expect(anchor.x).toBeLessThanOrEqual(100);
      expect(anchor.y).toBeGreaterThanOrEqual(0);
      expect(anchor.y).toBeLessThanOrEqual(100);
    }
  });

  it('includes at least 30 position anchors', () => {
    expect(Object.keys(CANONICAL_POSITION_ANCHORS).length).toBeGreaterThanOrEqual(30);
  });
});

// ── NAMED_PITCH_ZONES ─────────────────────────────────────────────────────────

describe('NAMED_PITCH_ZONES', () => {
  it('contains expected tactical zones', () => {
    const requiredZones = [
      'gk_distribution_area',
      'left_back_escape_pocket',
      'right_back_escape_pocket',
      'central_midfield_triangle_slot',
      'central_cover_shadow',
      'd_edge_left',
      'd_edge_central',
      'd_edge_right',
      'penalty_spot_corridor',
    ];
    for (const zone of requiredZones) {
      expect(NAMED_PITCH_ZONES).toHaveProperty(zone);
    }
  });

  it('every zone has a valid type discriminator', () => {
    const validTypes = ['circle', 'rectangle', 'lane', 'polygon'];
    for (const [_name, geo] of Object.entries(NAMED_PITCH_ZONES)) {
      expect(validTypes).toContain(geo.type);
    }
  });

  it('circle zones have positive r', () => {
    for (const [_name, geo] of Object.entries(NAMED_PITCH_ZONES)) {
      if (geo.type === 'circle') {
        expect(geo.r).toBeGreaterThan(0);
      }
    }
  });

  it('contains at least 20 named zones', () => {
    expect(Object.keys(NAMED_PITCH_ZONES).length).toBeGreaterThanOrEqual(20);
  });
});

// ── TACTICAL_DISTANCE_BANDS ───────────────────────────────────────────────────

describe('TACTICAL_DISTANCE_BANDS', () => {
  it('has min < max for every band', () => {
    for (const [_name, band] of Object.entries(TACTICAL_DISTANCE_BANDS)) {
      expect(band.min).toBeLessThan(band.max);
    }
  });

  it('support_range is larger than very_close', () => {
    expect(TACTICAL_DISTANCE_BANDS.support_range!.min).toBeGreaterThan(
      TACTICAL_DISTANCE_BANDS.very_close!.max,
    );
  });
});

// ── isPointInZone ─────────────────────────────────────────────────────────────

describe('isPointInZone', () => {
  it('places ball at x=5, y=50 in defensive_third_central', () => {
    expect(isPointInZone(5, 50, 'defensive_third_central')).toBe(true);
  });

  it('places ball at x=50, y=50 in middle_third_central', () => {
    expect(isPointInZone(50, 50, 'middle_third_central')).toBe(true);
  });

  it('places ball at x=80, y=20 in attacking_third_right', () => {
    expect(isPointInZone(80, 20, 'attacking_third_right')).toBe(true);
  });

  it('rejects ball at x=5, y=50 from attacking_third_central', () => {
    expect(isPointInZone(5, 50, 'attacking_third_central')).toBe(false);
  });
});

// ── isPointInZoneX ────────────────────────────────────────────────────────────

describe('isPointInZoneX', () => {
  it('accepts x=5 for defensive_third_central', () => {
    expect(isPointInZoneX(5, 'defensive_third_central')).toBe(true);
  });

  it('accepts x=70 for attacking_third_central (at edge)', () => {
    expect(isPointInZoneX(70, 'attacking_third_central')).toBe(true);
  });

  it('rejects x=80 for defensive_third_central', () => {
    expect(isPointInZoneX(80, 'defensive_third_central')).toBe(false);
  });

  it('rejects x=10 for attacking_third_central', () => {
    expect(isPointInZoneX(10, 'attacking_third_central')).toBe(false);
  });
});

// ── pitchDistance ─────────────────────────────────────────────────────────────

describe('pitchDistance', () => {
  it('returns 0 for the same point', () => {
    expect(pitchDistance({ x: 30, y: 40 }, { x: 30, y: 40 })).toBe(0);
  });

  it('returns correct Euclidean distance', () => {
    expect(pitchDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBeCloseTo(5, 5);
  });
});

// ── resolvePositionHint ───────────────────────────────────────────────────────

describe('resolvePositionHint', () => {
  it('resolves a known hint', () => {
    const anchor = resolvePositionHint('gk_own_goal');
    expect(anchor).toBeDefined();
    expect(anchor!.x).toBe(3);
    expect(anchor!.y).toBe(50);
  });

  it('returns undefined for an unknown hint', () => {
    expect(resolvePositionHint('not_a_real_hint')).toBeUndefined();
  });
});
