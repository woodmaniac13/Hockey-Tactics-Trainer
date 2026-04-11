import { describe, it, expect } from 'vitest';
import { __testing } from '../evaluation/evaluator';

const { classifyResult } = __testing;

describe('classifyResult', () => {
  // 1. All 5 reachable result types
  describe('all reachable result types', () => {
    it('returns IDEAL for regionFit=1.0 and score >= 80', () => {
      expect(classifyResult(80, 1.0, true)).toBe('IDEAL');
    });

    it('returns VALID for regionFit=1.0 and score < 80', () => {
      expect(classifyResult(50, 1.0, true)).toBe('VALID');
    });

    it('returns VALID for regionFit > 0 and score >= 65', () => {
      expect(classifyResult(65, 0.5, true)).toBe('VALID');
    });

    it('returns PARTIAL for regionFit > 0 and score between 40-64', () => {
      expect(classifyResult(40, 0.5, true)).toBe('PARTIAL');
    });

    it('returns ALTERNATE_VALID for regionFit=0 and score >= 50', () => {
      expect(classifyResult(50, 0, true)).toBe('ALTERNATE_VALID');
    });

    it('returns INVALID when constraints fail', () => {
      expect(classifyResult(100, 1.0, false)).toBe('INVALID');
    });
  });

  // 2. Boundary tests at exact threshold values
  describe('boundary values', () => {
    it('score=80, regionFit=1.0 → IDEAL (exact boundary)', () => {
      expect(classifyResult(80, 1.0, true)).toBe('IDEAL');
    });

    it('score=79, regionFit=1.0 → VALID (just below IDEAL threshold)', () => {
      expect(classifyResult(79, 1.0, true)).toBe('VALID');
    });

    it('score=65, regionFit=0.5 → VALID (exact boundary)', () => {
      expect(classifyResult(65, 0.5, true)).toBe('VALID');
    });

    it('score=64, regionFit=0.5 → PARTIAL (just below VALID threshold)', () => {
      expect(classifyResult(64, 0.5, true)).toBe('PARTIAL');
    });

    it('score=40, regionFit=0.5 → PARTIAL (exact boundary)', () => {
      expect(classifyResult(40, 0.5, true)).toBe('PARTIAL');
    });

    it('score=39, regionFit=0.5 → INVALID (just below PARTIAL threshold)', () => {
      expect(classifyResult(39, 0.5, true)).toBe('INVALID');
    });

    it('score=50, regionFit=0 → ALTERNATE_VALID (exact boundary)', () => {
      expect(classifyResult(50, 0, true)).toBe('ALTERNATE_VALID');
    });

    it('score=49, regionFit=0 → INVALID (just below ALTERNATE_VALID threshold)', () => {
      expect(classifyResult(49, 0, true)).toBe('INVALID');
    });
  });

  // 3. Failed constraints always produce INVALID
  describe('failed constraints always produce INVALID', () => {
    it('high score + perfect regionFit + failed constraints → INVALID', () => {
      expect(classifyResult(100, 1.0, false)).toBe('INVALID');
    });

    it('score=80 + regionFit=1.0 + failed constraints → INVALID', () => {
      expect(classifyResult(80, 1.0, false)).toBe('INVALID');
    });

    it('score=65 + regionFit=0.5 + failed constraints → INVALID', () => {
      expect(classifyResult(65, 0.5, false)).toBe('INVALID');
    });

    it('score=50 + regionFit=0 + failed constraints → INVALID', () => {
      expect(classifyResult(50, 0, false)).toBe('INVALID');
    });

    it('score=0 + regionFit=0 + failed constraints → INVALID', () => {
      expect(classifyResult(0, 0, false)).toBe('INVALID');
    });
  });

  // 4. PARTIAL is reachable (regionFit > 0, score between 40-64)
  describe('PARTIAL reachability', () => {
    it('score=40, regionFit=0.5 → PARTIAL', () => {
      expect(classifyResult(40, 0.5, true)).toBe('PARTIAL');
    });

    it('score=50, regionFit=0.5 → PARTIAL', () => {
      expect(classifyResult(50, 0.5, true)).toBe('PARTIAL');
    });

    it('score=64, regionFit=0.5 → PARTIAL', () => {
      expect(classifyResult(64, 0.5, true)).toBe('PARTIAL');
    });

    it('score=55, regionFit=0.1 → PARTIAL (low regionFit still > 0)', () => {
      expect(classifyResult(55, 0.1, true)).toBe('PARTIAL');
    });
  });

  // 5. ALTERNATE_VALID requires score >= 50
  describe('ALTERNATE_VALID score floor', () => {
    it('score=50, regionFit=0 → ALTERNATE_VALID', () => {
      expect(classifyResult(50, 0, true)).toBe('ALTERNATE_VALID');
    });

    it('score=75, regionFit=0 → ALTERNATE_VALID', () => {
      expect(classifyResult(75, 0, true)).toBe('ALTERNATE_VALID');
    });

    it('score=100, regionFit=0 → ALTERNATE_VALID', () => {
      expect(classifyResult(100, 0, true)).toBe('ALTERNATE_VALID');
    });

    it('score=49, regionFit=0 → INVALID (below floor)', () => {
      expect(classifyResult(49, 0, true)).toBe('INVALID');
    });
  });

  // 6. Score floor: regionFit=0, score=49 → INVALID
  it('score floor: regionFit=0, score=49 → INVALID', () => {
    expect(classifyResult(49, 0, true)).toBe('INVALID');
  });

  // 7. Score floor: regionFit=0, score=50 → ALTERNATE_VALID
  it('score floor: regionFit=0, score=50 → ALTERNATE_VALID', () => {
    expect(classifyResult(50, 0, true)).toBe('ALTERNATE_VALID');
  });

  // 8. regionFit=1.0 with any passing score → at least VALID
  describe('regionFit=1.0 always at least VALID', () => {
    it('score=0, regionFit=1.0 → VALID', () => {
      expect(classifyResult(0, 1.0, true)).toBe('VALID');
    });

    it('score=1, regionFit=1.0 → VALID', () => {
      expect(classifyResult(1, 1.0, true)).toBe('VALID');
    });

    it('score=39, regionFit=1.0 → VALID', () => {
      expect(classifyResult(39, 1.0, true)).toBe('VALID');
    });

    it('score=79, regionFit=1.0 → VALID', () => {
      expect(classifyResult(79, 1.0, true)).toBe('VALID');
    });

    it('score=80, regionFit=1.0 → IDEAL (promoted above VALID)', () => {
      expect(classifyResult(80, 1.0, true)).toBe('IDEAL');
    });

    it('score=100, regionFit=1.0 → IDEAL', () => {
      expect(classifyResult(100, 1.0, true)).toBe('IDEAL');
    });
  });

  // 9. Very low score (< 40) with regionFit > 0 → INVALID
  describe('very low score with regionFit > 0', () => {
    it('score=0, regionFit=0.5 → INVALID', () => {
      expect(classifyResult(0, 0.5, true)).toBe('INVALID');
    });

    it('score=20, regionFit=0.5 → INVALID', () => {
      expect(classifyResult(20, 0.5, true)).toBe('INVALID');
    });

    it('score=39, regionFit=0.5 → INVALID', () => {
      expect(classifyResult(39, 0.5, true)).toBe('INVALID');
    });

    it('score=39, regionFit=0.99 → INVALID', () => {
      expect(classifyResult(39, 0.99, true)).toBe('INVALID');
    });
  });

  // 10. Edge case: score=0, regionFit=0, constraints pass → INVALID
  it('edge case: score=0, regionFit=0, constraints pass → INVALID', () => {
    expect(classifyResult(0, 0, true)).toBe('INVALID');
  });
});
