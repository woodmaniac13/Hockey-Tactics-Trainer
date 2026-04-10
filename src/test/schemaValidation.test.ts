import { describe, it, expect } from 'vitest';
import {
  WeightProfileSchema,
  ScenarioPackManifestSchema,
  WeightsManifestSchema,
} from '../scenarios/scenarioSchema';

// ── WeightProfileSchema ──────────────────────────────────────────────────────

describe('WeightProfileSchema', () => {
  const validProfile = {
    profile_id: 'build_out_v1',
    version: 1,
    weights: {
      support: 0.25,
      passing_lane: 0.20,
      spacing: 0.15,
      pressure_relief: 0.20,
      width_depth: 0.10,
      region_fit: 0.08,
      reasoning_bonus: 0.02,
    },
    component_config: {
      distance_to_ball: { optimal_min: 8, optimal_max: 20 },
      spacing: { min_distance: 8 },
      passing_lane: { block_threshold: 5 },
    },
  };

  it('accepts a valid weight profile', () => {
    expect(WeightProfileSchema.safeParse(validProfile).success).toBe(true);
  });

  it('accepts a minimal weight profile with only required fields', () => {
    const minimal = {
      profile_id: 'minimal_v1',
      version: 1,
      weights: { support: 1.0 },
    };
    expect(WeightProfileSchema.safeParse(minimal).success).toBe(true);
  });

  it('rejects a profile where all scoring weights are zero', () => {
    const allZero = {
      profile_id: 'zero_v1',
      version: 1,
      weights: { support: 0, passing_lane: 0 },
    };
    const result = WeightProfileSchema.safeParse(allZero);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/at least one non-zero/);
    }
  });

  it('rejects a profile with unknown fields (strict mode)', () => {
    const withUnknown = { ...validProfile, extra: true };
    expect(WeightProfileSchema.safeParse(withUnknown).success).toBe(false);
  });

  it('rejects a negative weight value', () => {
    const withNegative = { ...validProfile, weights: { support: -0.1 } };
    expect(WeightProfileSchema.safeParse(withNegative).success).toBe(false);
  });
});

// ── ScenarioPackManifestSchema ───────────────────────────────────────────────

describe('ScenarioPackManifestSchema', () => {
  const validManifest = {
    version: 1,
    packs: [
      {
        id: 'fundamentals',
        title: 'Fundamentals',
        description: 'Core positioning concepts.',
        order: 1,
        scenarios: ['packs/fundamentals/support_basic.json'],
      },
      {
        id: 'advanced',
        title: 'Advanced',
        description: 'Advanced scenarios.',
        order: 2,
        scenarios: ['packs/advanced/press_escape.json'],
      },
    ],
  };

  it('accepts a valid manifest', () => {
    expect(ScenarioPackManifestSchema.safeParse(validManifest).success).toBe(true);
  });

  it('rejects duplicate pack ids', () => {
    const withDuplicatePack = {
      version: 1,
      packs: [
        { id: 'fundamentals', title: 'A', description: '', order: 1, scenarios: ['a.json'] },
        { id: 'fundamentals', title: 'B', description: '', order: 2, scenarios: ['b.json'] },
      ],
    };
    const result = ScenarioPackManifestSchema.safeParse(withDuplicatePack);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/Duplicate scenario pack id/);
    }
  });

  it('rejects duplicate scenario paths within the same pack', () => {
    const withDuplicateInPack = {
      version: 1,
      packs: [
        {
          id: 'fundamentals',
          title: 'A',
          description: '',
          order: 1,
          scenarios: ['packs/a.json', 'packs/a.json'],
        },
      ],
    };
    const result = ScenarioPackManifestSchema.safeParse(withDuplicateInPack);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/Duplicate scenario path/);
    }
  });

  it('rejects a scenario path referenced in two different packs', () => {
    const withCrossPackDuplicate = {
      version: 1,
      packs: [
        { id: 'pack_a', title: 'A', description: '', order: 1, scenarios: ['shared.json'] },
        { id: 'pack_b', title: 'B', description: '', order: 2, scenarios: ['shared.json'] },
      ],
    };
    const result = ScenarioPackManifestSchema.safeParse(withCrossPackDuplicate);
    expect(result.success).toBe(false);
  });
});

// ── WeightsManifestSchema ────────────────────────────────────────────────────

describe('WeightsManifestSchema', () => {
  it('accepts a valid weights manifest', () => {
    const manifest = { version: 1, profiles: ['build_out_v1', 'attack_v1'] };
    expect(WeightsManifestSchema.safeParse(manifest).success).toBe(true);
  });

  it('rejects an empty profiles array', () => {
    const manifest = { version: 1, profiles: [] };
    expect(WeightsManifestSchema.safeParse(manifest).success).toBe(false);
  });

  it('rejects unknown fields (strict mode)', () => {
    const manifest = { version: 1, profiles: ['build_out_v1'], extra: true };
    expect(WeightsManifestSchema.safeParse(manifest).success).toBe(false);
  });
});
