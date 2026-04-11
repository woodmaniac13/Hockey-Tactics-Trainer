import { describe, it, expect } from 'vitest';
import { __testing } from '../evaluation/evaluator';
import type { TacticalRegionGeometry, Point } from '../types';

const {
  isInsideCircle,
  isInsideRectangle,
  isInsidePolygon,
  isInsideLane,
  isResolvedGeometryHit,
} = __testing;

// ─── isInsideCircle ──────────────────────────────────────────────────────────

describe('isInsideCircle', () => {
  const cx = 50;
  const cy = 50;
  const r = 10;

  it('returns true for the center point', () => {
    expect(isInsideCircle({ x: cx, y: cy }, cx, cy, r)).toBe(true);
  });

  it('returns true for a point on the exact boundary', () => {
    expect(isInsideCircle({ x: cx + r, y: cy }, cx, cy, r)).toBe(true);
    expect(isInsideCircle({ x: cx, y: cy - r }, cx, cy, r)).toBe(true);
  });

  it('returns false for a point just outside the boundary', () => {
    expect(isInsideCircle({ x: cx + r + 0.01, y: cy }, cx, cy, r)).toBe(false);
  });

  it('returns false for a point far away', () => {
    expect(isInsideCircle({ x: 200, y: 200 }, cx, cy, r)).toBe(false);
  });
});

// ─── isInsideRectangle (axis-aligned) ────────────────────────────────────────

describe('isInsideRectangle (axis-aligned)', () => {
  const rx = 20;
  const ry = 30;
  const w = 40;
  const h = 20;

  it('returns true for the center of the rectangle', () => {
    expect(isInsideRectangle({ x: rx + w / 2, y: ry + h / 2 }, rx, ry, w, h)).toBe(true);
  });

  it('returns true for the top-left corner (inclusive)', () => {
    expect(isInsideRectangle({ x: rx, y: ry }, rx, ry, w, h)).toBe(true);
  });

  it('returns true for the bottom-right corner (inclusive)', () => {
    expect(isInsideRectangle({ x: rx + w, y: ry + h }, rx, ry, w, h)).toBe(true);
  });

  it('returns false for a point just outside the left edge', () => {
    expect(isInsideRectangle({ x: rx - 0.01, y: ry + h / 2 }, rx, ry, w, h)).toBe(false);
  });

  it('returns false for a point just outside the right edge', () => {
    expect(isInsideRectangle({ x: rx + w + 0.01, y: ry + h / 2 }, rx, ry, w, h)).toBe(false);
  });

  it('returns false for a point just outside the top edge', () => {
    expect(isInsideRectangle({ x: rx + w / 2, y: ry - 0.01 }, rx, ry, w, h)).toBe(false);
  });

  it('returns false for a point just outside the bottom edge', () => {
    expect(isInsideRectangle({ x: rx + w / 2, y: ry + h + 0.01 }, rx, ry, w, h)).toBe(false);
  });

  it('returns true for an arbitrary interior point', () => {
    expect(isInsideRectangle({ x: rx + 5, y: ry + 5 }, rx, ry, w, h)).toBe(true);
  });
});

// ─── isInsideRectangle (rotated) ─────────────────────────────────────────────

describe('isInsideRectangle (rotated)', () => {
  // Rectangle centred at (50, 50), width=20, height=10
  const rx = 40; // cx - w/2
  const ry = 45; // cy - h/2
  const w = 20;
  const h = 10;
  const cx = rx + w / 2; // 50
  const cy = ry + h / 2; // 50

  it('center is still inside with 45° rotation', () => {
    const rot = Math.PI / 4;
    expect(isInsideRectangle({ x: cx, y: cy }, rx, ry, w, h, rot)).toBe(true);
  });

  it('point inside axis-aligned rect can be outside when rotated 45°', () => {
    // (rx+1, ry+1) = (41, 46) is well inside the axis-aligned rect
    // After 45° rotation the corners move; (41, 46) is near a corner and may fall outside
    const rot = Math.PI / 4;
    // The top-left corner of the axis-aligned rect is far from the rotated rect's boundary
    const corner: Point = { x: rx + 0.1, y: ry + 0.1 };
    expect(isInsideRectangle(corner, rx, ry, w, h, rot)).toBe(false);
  });

  it('90° rotation swaps width and height, changing which points are inside', () => {
    const rot = Math.PI / 2;
    // With 90° rotation the rect effectively becomes 10 wide × 20 tall centred at (50,50)
    // Point at (55, 50) is inside axis-aligned (half-width=10) but outside rotated (half-width now 5)
    expect(isInsideRectangle({ x: cx + 6, y: cy }, rx, ry, w, h)).toBe(true); // axis-aligned
    expect(isInsideRectangle({ x: cx + 6, y: cy }, rx, ry, w, h, rot)).toBe(false); // rotated

    // Point at (50, 59) is outside axis-aligned (half-height=5) but inside rotated (half-height now 10)
    expect(isInsideRectangle({ x: cx, y: cy + 9 }, rx, ry, w, h)).toBe(false); // axis-aligned
    expect(isInsideRectangle({ x: cx, y: cy + 9 }, rx, ry, w, h, rot)).toBe(true); // rotated
  });

  it('0 rotation behaves the same as axis-aligned (no rotation arg)', () => {
    const inside: Point = { x: rx + 5, y: ry + 5 };
    const outside: Point = { x: rx - 1, y: ry - 1 };
    // rotation = 0 is falsy, so the axis-aligned branch is used
    expect(isInsideRectangle(inside, rx, ry, w, h, 0)).toBe(
      isInsideRectangle(inside, rx, ry, w, h),
    );
    expect(isInsideRectangle(outside, rx, ry, w, h, 0)).toBe(
      isInsideRectangle(outside, rx, ry, w, h),
    );
  });
});

// ─── isInsidePolygon ─────────────────────────────────────────────────────────

describe('isInsidePolygon', () => {
  describe('triangle', () => {
    const triangle: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 10 },
    ];

    it('returns true for a point clearly inside the triangle', () => {
      expect(isInsidePolygon({ x: 5, y: 3 }, triangle)).toBe(true);
    });

    it('returns false for a point clearly outside the triangle', () => {
      expect(isInsidePolygon({ x: 20, y: 20 }, triangle)).toBe(false);
    });

    it('handles a point on a vertex (ray-casting edge case)', () => {
      // Behavior on exact vertex is implementation-dependent for ray-casting;
      // just verify it returns a boolean without crashing
      const result = isInsidePolygon({ x: 0, y: 0 }, triangle);
      expect(typeof result).toBe('boolean');
    });

    it('handles a point on an edge (ray-casting edge case)', () => {
      // Midpoint of the bottom edge (0,0)→(10,0) is (5,0)
      const result = isInsidePolygon({ x: 5, y: 0 }, triangle);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('square polygon', () => {
    const square: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];

    it('returns true for the center of the square', () => {
      expect(isInsidePolygon({ x: 5, y: 5 }, square)).toBe(true);
    });

    it('returns false for a point outside the square', () => {
      expect(isInsidePolygon({ x: 11, y: 5 }, square)).toBe(false);
    });
  });

  describe('convex polygon (pentagon)', () => {
    // Regular-ish pentagon
    const pentagon: Point[] = [
      { x: 50, y: 30 },
      { x: 65, y: 45 },
      { x: 60, y: 65 },
      { x: 40, y: 65 },
      { x: 35, y: 45 },
    ];

    it('returns true for the centroid', () => {
      expect(isInsidePolygon({ x: 50, y: 50 }, pentagon)).toBe(true);
    });

    it('returns false for a point outside', () => {
      expect(isInsidePolygon({ x: 30, y: 30 }, pentagon)).toBe(false);
    });
  });

  describe('L-shaped concave polygon', () => {
    // L-shape:
    //  (0,0)───(10,0)
    //    │         │
    //  (0,10)──(5,10)
    //            │
    //          (5,20)──(10,20)
    //                     │
    //                  (10,10)  ← actually we need a proper L
    // Proper L-shape vertices (counter-clockwise):
    const lShape: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 5, y: 5 },
      { x: 5, y: 10 },
      { x: 0, y: 10 },
    ];

    it('returns true for a point in the horizontal arm of the L', () => {
      expect(isInsidePolygon({ x: 7, y: 2 }, lShape)).toBe(true);
    });

    it('returns true for a point in the vertical arm of the L', () => {
      expect(isInsidePolygon({ x: 2, y: 7 }, lShape)).toBe(true);
    });

    it('returns false for a point in the concavity', () => {
      // (7, 7) is in the missing square of the L
      expect(isInsidePolygon({ x: 7, y: 7 }, lShape)).toBe(false);
    });

    it('returns false for a point fully outside', () => {
      expect(isInsidePolygon({ x: 15, y: 15 }, lShape)).toBe(false);
    });
  });
});

// ─── isInsideLane ────────────────────────────────────────────────────────────

describe('isInsideLane', () => {
  describe('horizontal lane from (10,50) to (60,50), width=10', () => {
    const x1 = 10, y1 = 50, x2 = 60, y2 = 50, laneWidth = 10;

    it('returns true for the midpoint of the spine', () => {
      expect(isInsideLane({ x: 35, y: 50 }, x1, y1, x2, y2, laneWidth)).toBe(true);
    });

    it('returns true at exactly width/2 distance from spine (boundary)', () => {
      expect(isInsideLane({ x: 35, y: 55 }, x1, y1, x2, y2, laneWidth)).toBe(true);
    });

    it('returns false beyond width/2 from the spine', () => {
      expect(isInsideLane({ x: 35, y: 55.01 }, x1, y1, x2, y2, laneWidth)).toBe(false);
    });

    it('returns false for a point past the endpoints (clamped to segment)', () => {
      // Point directly to the left of x1 but on the spine's y — outside the segment
      expect(isInsideLane({ x: 0, y: 50 }, x1, y1, x2, y2, laneWidth)).toBe(false);
    });
  });

  describe('diagonal lane from (0,0) to (10,10), width=4', () => {
    const x1 = 0, y1 = 0, x2 = 10, y2 = 10, laneWidth = 4;

    it('returns true for a point on the spine (midpoint)', () => {
      expect(isInsideLane({ x: 5, y: 5 }, x1, y1, x2, y2, laneWidth)).toBe(true);
    });

    it('returns true for a point perpendicular to spine within width', () => {
      // Perpendicular offset of 1 unit from midpoint (5,5) along direction (-1/√2, 1/√2)
      const offset = 1;
      const px = 5 - offset / Math.SQRT2;
      const py = 5 + offset / Math.SQRT2;
      expect(isInsideLane({ x: px, y: py }, x1, y1, x2, y2, laneWidth)).toBe(true);
    });

    it('returns false for a point perpendicular to spine beyond width', () => {
      // Perpendicular offset of 3 units (> width/2 = 2)
      const offset = 3;
      const px = 5 - offset / Math.SQRT2;
      const py = 5 + offset / Math.SQRT2;
      expect(isInsideLane({ x: px, y: py }, x1, y1, x2, y2, laneWidth)).toBe(false);
    });
  });
});

// ─── isResolvedGeometryHit (dispatch) ────────────────────────────────────────

describe('isResolvedGeometryHit', () => {
  it('dispatches circle type correctly', () => {
    const region: TacticalRegionGeometry = { type: 'circle' as const, x: 50, y: 50, r: 10 };
    expect(isResolvedGeometryHit({ x: 50, y: 50 }, region)).toBe(true);
    expect(isResolvedGeometryHit({ x: 70, y: 70 }, region)).toBe(false);
  });

  it('dispatches rectangle type correctly', () => {
    const region: TacticalRegionGeometry = {
      type: 'rectangle' as const,
      x: 20,
      y: 30,
      width: 40,
      height: 20,
    };
    expect(isResolvedGeometryHit({ x: 40, y: 40 }, region)).toBe(true);
    expect(isResolvedGeometryHit({ x: 0, y: 0 }, region)).toBe(false);
  });

  it('dispatches polygon type correctly', () => {
    const region: TacticalRegionGeometry = {
      type: 'polygon' as const,
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
    };
    expect(isResolvedGeometryHit({ x: 5, y: 5 }, region)).toBe(true);
    expect(isResolvedGeometryHit({ x: 20, y: 20 }, region)).toBe(false);
  });

  it('dispatches lane type correctly', () => {
    const region: TacticalRegionGeometry = {
      type: 'lane' as const,
      x1: 10,
      y1: 50,
      x2: 60,
      y2: 50,
      width: 10,
    };
    expect(isResolvedGeometryHit({ x: 35, y: 50 }, region)).toBe(true);
    expect(isResolvedGeometryHit({ x: 35, y: 70 }, region)).toBe(false);
  });

  it('returns false for an unknown region type', () => {
    const region = { type: 'hexagon', sides: 6 } as unknown as TacticalRegionGeometry;
    expect(isResolvedGeometryHit({ x: 50, y: 50 }, region)).toBe(false);
  });
});
