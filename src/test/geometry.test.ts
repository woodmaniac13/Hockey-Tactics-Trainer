import { describe, it, expect } from 'vitest';
import { distance, angleBetween, normalize, perpendicular, pointToLineDistance, pressureToVector } from '../utils/geometry';

describe('distance', () => {
  it('returns 0 for same point', () => {
    expect(distance({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(0);
  });
  it('returns correct distance for horizontal', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 0 })).toBe(3);
  });
  it('returns correct distance for diagonal', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});

describe('normalize', () => {
  it('returns zero vector for zero input', () => {
    expect(normalize({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });
  it('returns unit vector for non-zero input', () => {
    const n = normalize({ x: 3, y: 4 });
    expect(n.x).toBeCloseTo(0.6);
    expect(n.y).toBeCloseTo(0.8);
  });
});

describe('angleBetween', () => {
  it('returns 0 for parallel vectors', () => {
    expect(angleBetween({ x: 1, y: 0 }, { x: 2, y: 0 })).toBeCloseTo(0);
  });
  it('returns 90 for perpendicular vectors', () => {
    expect(angleBetween({ x: 1, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(90);
  });
  it('returns 180 for opposite vectors', () => {
    expect(angleBetween({ x: 1, y: 0 }, { x: -1, y: 0 })).toBeCloseTo(180);
  });
  it('returns 0 for zero vector', () => {
    expect(angleBetween({ x: 0, y: 0 }, { x: 1, y: 0 })).toBe(0);
  });
});

describe('perpendicular', () => {
  it('rotates 90 degrees', () => {
    const p = perpendicular({ x: 1, y: 0 });
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBe(1);
  });
});

describe('pointToLineDistance', () => {
  it('returns 0 for point on line', () => {
    expect(pointToLineDistance({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 2, y: 0 })).toBeCloseTo(0);
  });
  it('returns correct distance for point off line', () => {
    expect(pointToLineDistance({ x: 1, y: 1 }, { x: 0, y: 0 }, { x: 2, y: 0 })).toBeCloseTo(1);
  });
  it('clamps to segment endpoints', () => {
    const d = pointToLineDistance({ x: 5, y: 0 }, { x: 0, y: 0 }, { x: 2, y: 0 });
    expect(d).toBeCloseTo(3);
  });
  it('handles zero-length segment', () => {
    const d = pointToLineDistance({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 });
    expect(d).toBeCloseTo(5);
  });
});

describe('pressureToVector', () => {
  it('inside_out returns negative x', () => {
    expect(pressureToVector('inside_out')).toEqual({ x: -1, y: 0 });
  });
  it('outside_in returns positive x', () => {
    expect(pressureToVector('outside_in')).toEqual({ x: 1, y: 0 });
  });
  it('none returns zero vector', () => {
    expect(pressureToVector('none')).toEqual({ x: 0, y: 0 });
  });
});
