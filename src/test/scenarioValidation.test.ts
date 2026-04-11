import { describe, it, expect } from 'vitest';
import { evaluate } from '../evaluation/evaluator';
import { resolveRegionGeometry } from '../utils/regions';
import type { Scenario, WeightProfile, TacticalRegionGeometry } from '../types';

import S01Json from '../../public/scenarios/build-out/S01.json';
import S02Json from '../../public/scenarios/defence/S02.json';
import S03Json from '../../public/scenarios/attack/S03.json';
import S04Json from '../../public/scenarios/transition/S04.json';
import S05Json from '../../public/scenarios/build-out/S05.json';
import buildOutProfile from '../../public/weights/build_out_v1.json';
import defenceProfile from '../../public/weights/defence_v1.json';
import attackProfile from '../../public/weights/attack_v1.json';
import transitionProfile from '../../public/weights/transition_v1.json';

const entries = [
  { id: 'S01', scenario: S01Json as unknown as Scenario, profile: buildOutProfile as unknown as WeightProfile },
  { id: 'S02', scenario: S02Json as unknown as Scenario, profile: defenceProfile as unknown as WeightProfile },
  { id: 'S03', scenario: S03Json as unknown as Scenario, profile: attackProfile as unknown as WeightProfile },
  { id: 'S04', scenario: S04Json as unknown as Scenario, profile: transitionProfile as unknown as WeightProfile },
  { id: 'S05', scenario: S05Json as unknown as Scenario, profile: buildOutProfile as unknown as WeightProfile },
];

function getRegionCenter(geo: TacticalRegionGeometry): { x: number; y: number } {
  switch (geo.type) {
    case 'circle': return { x: geo.x, y: geo.y };
    case 'rectangle': return { x: geo.x + geo.width / 2, y: geo.y + geo.height / 2 };
    case 'lane': return { x: (geo.x1 + geo.x2) / 2, y: (geo.y1 + geo.y2) / 2 };
    case 'polygon': {
      const n = geo.vertices.length;
      return { x: geo.vertices.reduce((s, v) => s + v.x, 0) / n, y: geo.vertices.reduce((s, v) => s + v.y, 0) / n };
    }
  }
}

const SCORING_WEIGHT_KEYS = [
  'support', 'passing_lane', 'spacing', 'pressure_relief',
  'width_depth', 'cover', 'region_fit',
] as const;

describe('Scenario validation (S01–S05)', () => {
  describe('Ideal region centers should usually pass constraints', () => {
    for (const { id, scenario, profile } of entries) {
      it(`${id}: ideal region centers pass constraints`, () => {
        const failures: string[] = [];
        for (let i = 0; i < scenario.ideal_regions.length; i++) {
          const region = scenario.ideal_regions[i];
          const geo = resolveRegionGeometry(region, scenario);
          if (!geo) {
            failures.push(`region[${i}]: could not resolve geometry`);
            continue;
          }
          const center = getRegionCenter(geo);
          const result = evaluate(scenario, center, profile);
          if (!result.constraints_passed) {
            failures.push(
              `region[${i}] center (${center.x.toFixed(1)}, ${center.y.toFixed(1)}): ` +
              `failed constraints [${result.failed_constraints.join(', ')}]`
            );
          }
        }
        // Most ideal region centers should pass constraints.
        // Allow at most one documented exception per scenario.
        expect(
          failures.length,
          `Constraint failures:\n${failures.join('\n')}`,
        ).toBeLessThanOrEqual(1);
      });
    }
  });

  describe('Weight profile weights should sum close to 1.0', () => {
    for (const { id, profile } of entries) {
      it(`${id}: scoring weights sum ≈ 1.0 (excluding reasoning_bonus)`, () => {
        const weights = profile.weights;
        const sum = SCORING_WEIGHT_KEYS.reduce(
          (acc, key) => acc + ((weights as Record<string, number>)[key] ?? 0),
          0,
        );
        expect(sum).toBeGreaterThan(0.95);
        expect(sum).toBeLessThan(1.05);
      });
    }
  });

  describe('Constraint thresholds should be in [0, 1]', () => {
    for (const { id, scenario } of entries) {
      it(`${id}: all constraint thresholds are in [0, 1]`, () => {
        const thresholds = scenario.constraint_thresholds;
        for (const [key, value] of Object.entries(thresholds)) {
          expect(
            value,
            `${id} constraint_thresholds.${key}`,
          ).toBeGreaterThanOrEqual(0);
          expect(
            value,
            `${id} constraint_thresholds.${key}`,
          ).toBeLessThanOrEqual(1);
        }
      });
    }
  });

  describe('No overlapping ideal regions that are identical', () => {
    for (const { id, scenario } of entries) {
      it(`${id}: ideal regions have distinct center+radius`, () => {
        const resolved: { center: { x: number; y: number }; radius: number }[] = [];
        for (const region of scenario.ideal_regions) {
          const geo = resolveRegionGeometry(region, scenario);
          if (!geo) continue;
          const center = getRegionCenter(geo);
          const radius = geo.type === 'circle' ? geo.r : 0;
          resolved.push({ center, radius });
        }
        for (let i = 0; i < resolved.length; i++) {
          for (let j = i + 1; j < resolved.length; j++) {
            const a = resolved[i];
            const b = resolved[j];
            const identical =
              Math.abs(a.center.x - b.center.x) < 0.01 &&
              Math.abs(a.center.y - b.center.y) < 0.01 &&
              Math.abs(a.radius - b.radius) < 0.01;
            expect(identical, `${id} ideal regions [${i}] and [${j}] are identical`).toBe(false);
          }
        }
      });
    }
  });

  describe('Ideal regions should be within pitch bounds (0–100)', () => {
    for (const { id, scenario } of entries) {
      it(`${id}: resolved ideal region centers are within [0, 100]`, () => {
        for (let i = 0; i < scenario.ideal_regions.length; i++) {
          const geo = resolveRegionGeometry(scenario.ideal_regions[i], scenario);
          if (!geo) continue;
          const center = getRegionCenter(geo);
          expect(
            center.x,
            `${id} ideal_regions[${i}] center.x out of bounds`,
          ).toBeGreaterThanOrEqual(0);
          expect(
            center.x,
            `${id} ideal_regions[${i}] center.x out of bounds`,
          ).toBeLessThanOrEqual(100);
          expect(
            center.y,
            `${id} ideal_regions[${i}] center.y out of bounds`,
          ).toBeGreaterThanOrEqual(0);
          expect(
            center.y,
            `${id} ideal_regions[${i}] center.y out of bounds`,
          ).toBeLessThanOrEqual(100);
        }
      });
    }
  });

  describe('Weight profile has non-zero weight for constrained components', () => {
    for (const { id, scenario, profile } of entries) {
      it(`${id}: constrained components have non-zero weight`, () => {
        const warnings: string[] = [];
        const thresholds = scenario.constraint_thresholds;
        const weights = profile.weights as Record<string, number>;
        for (const [key, threshold] of Object.entries(thresholds)) {
          if (threshold > 0 && (weights[key] ?? 0) === 0) {
            warnings.push(
              `constraint "${key}" threshold=${threshold} but weight=0`,
            );
          }
        }
        // Warn but don't hard-fail — a weight of 0 with a constraint set is unusual but not necessarily wrong.
        if (warnings.length > 0) {
          console.warn(`[${id}] ${warnings.join('; ')}`);
        }
        expect(warnings.length, warnings.join('; ')).toBe(0);
      });
    }
  });

  describe('Feedback hints consistency', () => {
    for (const { id, scenario } of entries) {
      it(`${id}: feedback_hints has success and common_error`, () => {
        const hints = scenario.feedback_hints;
        if (!hints) return; // no hints authored — skip
        expect(hints.success, `${id} missing feedback_hints.success`).toBeTruthy();
        expect(hints.common_error, `${id} missing feedback_hints.common_error`).toBeTruthy();
      });

      it(`${id}: feedback_hints.success_points has length > 0 if present`, () => {
        const hints = scenario.feedback_hints;
        if (!hints || !hints.success_points) return;
        expect(hints.success_points.length).toBeGreaterThan(0);
      });
    }
  });
});
