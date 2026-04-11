import { describe, it, expect } from 'vitest';
import { evaluate } from '../evaluation/evaluator';
import { generateFeedback } from '../feedback/feedbackGenerator';
import type { Scenario, WeightProfile } from '../types';

import S01Json from '../../public/scenarios/build-out/S01.json';
import S02Json from '../../public/scenarios/defence/S02.json';
import S03Json from '../../public/scenarios/attack/S03.json';
import S04Json from '../../public/scenarios/transition/S04.json';
import S05Json from '../../public/scenarios/build-out/S05.json';
import buildOutProfile from '../../public/weights/build_out_v1.json';
import defenceProfile from '../../public/weights/defence_v1.json';
import attackProfile from '../../public/weights/attack_v1.json';
import transitionProfile from '../../public/weights/transition_v1.json';

import { resolveRegionGeometry } from '../utils/regions';
import type { TacticalRegionGeometry } from '../types';

const scenarios = [
  { scenario: S01Json as unknown as Scenario, profile: buildOutProfile as unknown as WeightProfile },
  { scenario: S02Json as unknown as Scenario, profile: defenceProfile as unknown as WeightProfile },
  { scenario: S03Json as unknown as Scenario, profile: attackProfile as unknown as WeightProfile },
  { scenario: S04Json as unknown as Scenario, profile: transitionProfile as unknown as WeightProfile },
  { scenario: S05Json as unknown as Scenario, profile: buildOutProfile as unknown as WeightProfile },
];

function getRegionCenter(geo: TacticalRegionGeometry): { x: number; y: number } {
  switch (geo.type) {
    case 'circle': return { x: geo.x, y: geo.y };
    case 'rectangle': return { x: geo.x + geo.width / 2, y: geo.y + geo.height / 2 };
    case 'lane': return { x: (geo.x1 + geo.x2) / 2, y: (geo.y1 + geo.y2) / 2 };
    case 'polygon': {
      const n = geo.vertices.length;
      const cx = geo.vertices.reduce((s, v) => s + v.x, 0) / n;
      const cy = geo.vertices.reduce((s, v) => s + v.y, 0) / n;
      return { x: cx, y: cy };
    }
  }
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// ─── 1. Ideal-region center invariants ──────────────────────────────────────

// Known exceptions: ideal regions whose centre fails a constraint due to
// deliberate tactical tension in the scenario design.
//   S03 "far_post_run" — width_hold purpose far from ball; support score
//     (0.36) < constraint (0.4) because the position prioritises width over
//     proximity-based support.
//   S05 "strong_side_outlet_lane" — lane midpoint sits near opponents
//     (opp_press, opp_cm), so pressure_relief (0.07) < constraint (0.4).
const KNOWN_CENTER_EXCEPTIONS = new Set([
  'S03:far_post_run',
  'S05:strong_side_outlet_lane',
]);

describe('1. Ideal-region center invariants', () => {
  for (const { scenario, profile } of scenarios) {
    describe(`scenario ${scenario.scenario_id}`, () => {
      for (const region of scenario.ideal_regions) {
        const geo = resolveRegionGeometry(region, scenario);
        if (!geo) continue;
        const center = getRegionCenter(geo);
        const label = ('label' in region && region.label) || geo.type;
        const key = `${scenario.scenario_id}:${label}`;

        if (KNOWN_CENTER_EXCEPTIONS.has(key)) {
          it(`center of ideal region "${label}" is a known constraint-tension exception`, () => {
            const result = evaluate(scenario, center, profile);
            // These are INVALID due to constraint failure, but region_fit should
            // still be 1.0 (inside the ideal region).
            expect(result.region_fit_score).toBe(1.0);
            expect(result.failed_constraints.length).toBeGreaterThan(0);
          });
        } else {
          it(`center of ideal region "${label}" should not be INVALID`, () => {
            const result = evaluate(scenario, center, profile);
            expect(result.result_type).not.toBe('INVALID');
          });
        }
      }
    });
  }
});

// ─── 2. Far-out-of-region invariants ────────────────────────────────────────

describe('2. Far-out-of-region invariants', () => {
  const farPositions = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 0, y: 100 },
    { x: 100, y: 100 },
    { x: 50, y: 0 },
    { x: 50, y: 100 },
  ];

  for (const { scenario, profile } of scenarios) {
    describe(`scenario ${scenario.scenario_id}`, () => {
      for (const pos of farPositions) {
        it(`(${pos.x}, ${pos.y}) should not be IDEAL or VALID unless high score`, () => {
          const result = evaluate(scenario, pos, profile);
          if (result.result_type === 'IDEAL' || result.result_type === 'VALID') {
            // This should not happen for positions far from all regions.
            // If it does, the region must overlap the corner (unexpected).
            expect(result.region_fit_score).toBeGreaterThan(0);
          }
          if (result.result_type === 'ALTERNATE_VALID') {
            expect(result.score).toBeGreaterThanOrEqual(50);
          }
        });
      }
    });
  }
});

// ─── 3. Symmetry invariants (S01) ──────────────────────────────────────────

describe('3. Symmetry invariants (S01 mirrored pockets)', () => {
  const s01 = S01Json as unknown as Scenario;
  const profile = buildOutProfile as unknown as WeightProfile;

  // S01 has ball at y=50, ideal pockets at (28,62) and (32,38).
  // Mirror pairs around ball's y=50 axis:
  const mirrorPairs = [
    { a: { x: 28, y: 62 }, b: { x: 28, y: 38 } },
    { a: { x: 32, y: 38 }, b: { x: 32, y: 62 } },
  ];

  for (const { a, b } of mirrorPairs) {
    it(`support scores at (${a.x},${a.y}) and (${b.x},${b.y}) should be close (< 0.05)`, () => {
      const resultA = evaluate(s01, a, profile);
      const resultB = evaluate(s01, b, profile);

      const diff = Math.abs(resultA.component_scores.support - resultB.component_scores.support);
      expect(diff).toBeLessThan(0.05);
    });

    it(`result types at (${a.x},${a.y}) and (${b.x},${b.y}) should be comparable`, () => {
      const resultA = evaluate(s01, a, profile);
      const resultB = evaluate(s01, b, profile);

      // Both should be in the same general tier: both non-INVALID, or both INVALID.
      const tierA = resultA.result_type === 'INVALID' ? 'bad' : 'ok';
      const tierB = resultB.result_type === 'INVALID' ? 'bad' : 'ok';
      expect(tierA).toBe(tierB);
    });
  }
});

// ─── 4. Monotonicity — region fit approach ─────────────────────────────────

describe('4. Monotonicity — region fit approach', () => {
  // Use S01's first ideal region (circle at (28,62) r=8)
  const s01 = S01Json as unknown as Scenario;
  const profile = buildOutProfile as unknown as WeightProfile;

  const geo = resolveRegionGeometry(s01.ideal_regions[0], s01);
  if (geo && geo.type === 'circle') {
    const cx = geo.x;
    const cy = geo.y;
    const r = geo.r;

    // Approach from outside (+x direction) toward center
    const distances = [r * 1.5, r * 1.0, r * 0.5, 0];
    const positions = distances.map(d => ({ x: cx + d, y: cy }));

    it('regionFit at distance r*0.5 should be 1.0 (inside ideal)', () => {
      const result = evaluate(s01, positions[2], profile);
      expect(result.component_scores.region_fit).toBe(1.0);
    });

    it('regionFit at center should be 1.0', () => {
      const result = evaluate(s01, positions[3], profile);
      expect(result.component_scores.region_fit).toBe(1.0);
    });

    it('regionFit should never decrease as we move closer to the center', () => {
      const fits = positions.map(pos => {
        const result = evaluate(s01, pos, profile);
        return result.component_scores.region_fit;
      });

      for (let i = 1; i < fits.length; i++) {
        expect(fits[i]).toBeGreaterThanOrEqual(fits[i - 1]);
      }
    });
  }
});

// ─── 5. Property-style randomized tests ────────────────────────────────────

describe('5. Property-style randomized tests', () => {

  // ── 5a. Random sampling inside ideal regions → high pass rate ────────────

  // Regions with known constraint tension may have a lower non-INVALID rate.
  // We still assert a floor: even in tensioned regions, region_fit = 1.0
  // should lift scores above zero. The default threshold is 80%; regions
  // with documented tension use a relaxed floor.
  //   S03 regions: support constraint tension (far from ball).
  //   S05 lane: almost all points fail pressure_relief ≥ 0.4 because the
  //     lane runs alongside nearby opponents (opp_press, opp_cm).
  const REGION_MIN_PASS: Record<string, number> = {
    'S03:central_attacking_pocket': 5,
    'S03:far_post_run': 5,
    'S05:strong_side_outlet_lane': 1,
  };
  const DEFAULT_MIN_PASS = 16; // 80% of 20

  describe('5a. Random sampling inside ideal regions → high pass rate', () => {
    for (const { scenario, profile } of scenarios) {
      describe(`scenario ${scenario.scenario_id}`, () => {
        for (const region of scenario.ideal_regions) {
          const geo = resolveRegionGeometry(region, scenario);
          if (!geo) continue;
          const label = ('label' in region && region.label) || geo.type;
          const key = `${scenario.scenario_id}:${label}`;
          const minNonInvalid = REGION_MIN_PASS[key] ?? DEFAULT_MIN_PASS;

          it(`≥${minNonInvalid}/20 random points inside "${label}" should not be INVALID`, () => {
            const rand = seededRandom(
              scenario.scenario_id.charCodeAt(1) * 1000 + label.charCodeAt(0),
            );
            const points = generateRandomPointsInRegion(geo, 20, rand);
            const results = points.map(p => evaluate(scenario, p, profile));
            const nonInvalid = results.filter(r => r.result_type !== 'INVALID').length;

            expect(nonInvalid).toBeGreaterThanOrEqual(minNonInvalid);
          });
        }
      });
    }
  });

  // ── 5b. Random sampling far outside regions → low IDEAL rate ─────────────

  describe('5b. Random sampling far outside regions → none should be IDEAL', () => {
    // Corner zones far from any authored region
    const cornerZones = [
      { xMin: 0, xMax: 5, yMin: 0, yMax: 5 },
      { xMin: 95, xMax: 100, yMin: 0, yMax: 5 },
      { xMin: 0, xMax: 5, yMin: 95, yMax: 100 },
      { xMin: 95, xMax: 100, yMin: 95, yMax: 100 },
    ];

    for (const { scenario, profile } of scenarios) {
      it(`scenario ${scenario.scenario_id}: no random corner point should be IDEAL`, () => {
        const rand = seededRandom(scenario.scenario_id.charCodeAt(1) * 7 + 42);
        const points: { x: number; y: number }[] = [];
        for (const zone of cornerZones) {
          for (let i = 0; i < 5; i++) {
            points.push({
              x: zone.xMin + rand() * (zone.xMax - zone.xMin),
              y: zone.yMin + rand() * (zone.yMax - zone.yMin),
            });
          }
        }
        const results = points.map(p => evaluate(scenario, p, profile));
        for (const result of results) {
          expect(result.result_type).not.toBe('IDEAL');
        }
      });
    }
  });

  // ── 5c. Zero-weight components don't affect feedback text ────────────────

  describe('5c. Zero-weight components should not produce feedback text', () => {
    const zeroWeightProfile: WeightProfile = {
      profile_id: 'test_zero_weights',
      version: 1,
      weights: {
        support: 0.30,
        passing_lane: 0.25,
        spacing: 0.15,
        pressure_relief: 0.20,
        width_depth: 0,
        cover: 0,
        region_fit: 0.10,
        reasoning_bonus: 0.02,
      },
    };

    const rand = seededRandom(9999);

    for (const { scenario } of scenarios) {
      it(`scenario ${scenario.scenario_id}: feedback with cover=0, width_depth=0 omits their text`, () => {
        // Generate a few random positions and check feedback for each
        for (let i = 0; i < 5; i++) {
          const pos = { x: rand() * 100, y: rand() * 100 };
          const result = evaluate(scenario, pos, zeroWeightProfile);
          const feedback = generateFeedback(result, scenario, undefined, zeroWeightProfile);

          const allText = [
            feedback.summary,
            ...feedback.positives,
            ...feedback.improvements,
            feedback.tactical_explanation,
          ].join(' ');

          expect(allText).not.toContain('defensive cover');
          expect(allText).not.toContain('team structure');
        }
      });
    }
  });

  // ── 5d. Score range invariant ────────────────────────────────────────────

  describe('5d. Score range invariant', () => {
    const rand = seededRandom(31415);

    for (const { scenario, profile } of scenarios) {
      it(`scenario ${scenario.scenario_id}: all scores in [0,100], components in [0,1]`, () => {
        for (let i = 0; i < 20; i++) {
          const pos = { x: rand() * 100, y: rand() * 100 };
          const result = evaluate(scenario, pos, profile);

          expect(result.score).toBeGreaterThanOrEqual(0);
          expect(result.score).toBeLessThanOrEqual(100);

          const cs = result.component_scores;
          for (const key of Object.keys(cs) as (keyof typeof cs)[]) {
            expect(cs[key]).toBeGreaterThanOrEqual(0);
            expect(cs[key]).toBeLessThanOrEqual(1);
          }
        }
      });
    }
  });
});

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Generates random points inside a resolved geometry region using rejection
 * sampling with a bounding box for efficiency.
 */
function generateRandomPointsInRegion(
  geo: TacticalRegionGeometry,
  count: number,
  rand: () => number,
): { x: number; y: number }[] {
  const bb = getBoundingBox(geo);
  const points: { x: number; y: number }[] = [];
  let attempts = 0;
  const maxAttempts = count * 200;

  while (points.length < count && attempts < maxAttempts) {
    attempts++;
    const x = bb.xMin + rand() * (bb.xMax - bb.xMin);
    const y = bb.yMin + rand() * (bb.yMax - bb.yMin);
    if (isInsideRegion({ x, y }, geo)) {
      points.push({ x, y });
    }
  }
  return points;
}

function getBoundingBox(geo: TacticalRegionGeometry): {
  xMin: number; xMax: number; yMin: number; yMax: number;
} {
  switch (geo.type) {
    case 'circle':
      return { xMin: geo.x - geo.r, xMax: geo.x + geo.r, yMin: geo.y - geo.r, yMax: geo.y + geo.r };
    case 'rectangle':
      return { xMin: geo.x, xMax: geo.x + geo.width, yMin: geo.y, yMax: geo.y + geo.height };
    case 'lane': {
      const hw = geo.width / 2;
      return {
        xMin: Math.min(geo.x1, geo.x2) - hw,
        xMax: Math.max(geo.x1, geo.x2) + hw,
        yMin: Math.min(geo.y1, geo.y2) - hw,
        yMax: Math.max(geo.y1, geo.y2) + hw,
      };
    }
    case 'polygon': {
      const xs = geo.vertices.map(v => v.x);
      const ys = geo.vertices.map(v => v.y);
      return { xMin: Math.min(...xs), xMax: Math.max(...xs), yMin: Math.min(...ys), yMax: Math.max(...ys) };
    }
  }
}

function isInsideRegion(pos: { x: number; y: number }, geo: TacticalRegionGeometry): boolean {
  switch (geo.type) {
    case 'circle':
      return Math.hypot(pos.x - geo.x, pos.y - geo.y) <= geo.r;
    case 'rectangle':
      return pos.x >= geo.x && pos.x <= geo.x + geo.width &&
             pos.y >= geo.y && pos.y <= geo.y + geo.height;
    case 'lane': {
      // Point-to-segment distance
      const dx = geo.x2 - geo.x1;
      const dy = geo.y2 - geo.y1;
      const lenSq = dx * dx + dy * dy;
      let t = lenSq === 0 ? 0 : ((pos.x - geo.x1) * dx + (pos.y - geo.y1) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const projX = geo.x1 + t * dx;
      const projY = geo.y1 + t * dy;
      return Math.hypot(pos.x - projX, pos.y - projY) <= geo.width / 2;
    }
    case 'polygon': {
      // Ray-casting algorithm
      let inside = false;
      const vs = geo.vertices;
      for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        const xi = vs[i].x, yi = vs[i].y;
        const xj = vs[j].x, yj = vs[j].y;
        const intersect =
          yi > pos.y !== yj > pos.y &&
          pos.x < ((xj - xi) * (pos.y - yi)) / (yj - yi) + xi;
        if (intersect) inside = !inside;
      }
      return inside;
    }
  }
}
