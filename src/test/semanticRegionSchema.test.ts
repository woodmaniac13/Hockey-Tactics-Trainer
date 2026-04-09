import { describe, it, expect } from 'vitest';
import {
  TacticalRegionSchema,
  SemanticRegionSchema,
  TacticalRegionGeometrySchema,
} from '../scenarios/scenarioSchema';

// ── TacticalRegionGeometrySchema ────────────────────────────────────────────

describe('TacticalRegionGeometrySchema', () => {
  it('accepts a legacy circle { x, y, r }', () => {
    expect(TacticalRegionGeometrySchema.safeParse({ x: 50, y: 50, r: 10 }).success).toBe(true);
  });

  it('accepts a tagged circle', () => {
    expect(TacticalRegionGeometrySchema.safeParse({ type: 'circle', x: 50, y: 50, r: 10 }).success).toBe(true);
  });

  it('accepts a rectangle', () => {
    expect(TacticalRegionGeometrySchema.safeParse({ type: 'rectangle', x: 10, y: 10, width: 20, height: 15 }).success).toBe(true);
  });

  it('accepts a polygon with 3+ vertices', () => {
    const vertices = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }];
    expect(TacticalRegionGeometrySchema.safeParse({ type: 'polygon', vertices }).success).toBe(true);
  });

  it('accepts a lane', () => {
    expect(TacticalRegionGeometrySchema.safeParse({ type: 'lane', x1: 0, y1: 0, x2: 20, y2: 0, width: 8 }).success).toBe(true);
  });

  it('rejects an unknown type', () => {
    expect(TacticalRegionGeometrySchema.safeParse({ type: 'oval', x: 10, y: 10, r: 5 }).success).toBe(false);
  });
});

// ── SemanticRegionSchema ────────────────────────────────────────────────────

describe('SemanticRegionSchema', () => {
  it('accepts a minimal semantic region with only geometry', () => {
    const region = {
      geometry: { type: 'circle', x: 50, y: 50, r: 10 },
    };
    expect(SemanticRegionSchema.safeParse(region).success).toBe(true);
  });

  it('accepts a fully populated pitch-relative semantic region', () => {
    const region = {
      label: 'strong_side_outlet_lane',
      purpose: 'primary_support_option',
      reference_frame: 'pitch',
      notes: 'Standard outlet channel',
      geometry: { type: 'lane', x1: 28, y1: 34, x2: 46, y2: 34, width: 10 },
    };
    expect(SemanticRegionSchema.safeParse(region).success).toBe(true);
  });

  it('accepts ball-relative semantic region without reference_entity_id', () => {
    const region = {
      label: 'escape_lane',
      purpose: 'pressure_relief',
      reference_frame: 'ball',
      geometry: { type: 'circle', x: 10, y: 0, r: 6 },
    };
    expect(SemanticRegionSchema.safeParse(region).success).toBe(true);
  });

  it('accepts entity-relative semantic region with reference_entity_id', () => {
    const region = {
      label: 'cf_cover_shadow',
      purpose: 'defensive_cover',
      reference_frame: 'entity',
      reference_entity_id: 'opp_cf',
      geometry: {
        type: 'polygon',
        vertices: [{ x: -6, y: -4 }, { x: 4, y: -8 }, { x: 8, y: 2 }, { x: -4, y: 6 }],
      },
    };
    expect(SemanticRegionSchema.safeParse(region).success).toBe(true);
  });

  it('rejects entity reference_frame without reference_entity_id', () => {
    const region = {
      reference_frame: 'entity',
      geometry: { type: 'circle', x: 0, y: 0, r: 5 },
    };
    const result = SemanticRegionSchema.safeParse(region);
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues[0]?.message;
      expect(msg).toMatch(/reference_entity_id is required/);
    }
  });

  it('rejects reference_entity_id when reference_frame is not entity', () => {
    const region = {
      reference_frame: 'ball',
      reference_entity_id: 'some_entity',
      geometry: { type: 'circle', x: 0, y: 0, r: 5 },
    };
    const result = SemanticRegionSchema.safeParse(region);
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues[0]?.message;
      expect(msg).toMatch(/reference_entity_id is only valid/);
    }
  });

  it('rejects unknown fields (strict mode)', () => {
    const region = {
      geometry: { type: 'circle', x: 50, y: 50, r: 10 },
      unknown_field: true,
    };
    expect(SemanticRegionSchema.safeParse(region).success).toBe(false);
  });

  it('rejects an invalid purpose value', () => {
    const region = {
      purpose: 'not_a_valid_purpose',
      geometry: { type: 'circle', x: 50, y: 50, r: 10 },
    };
    expect(SemanticRegionSchema.safeParse(region).success).toBe(false);
  });

  it('rejects an invalid reference_frame value', () => {
    const region = {
      reference_frame: 'absolute',
      geometry: { type: 'circle', x: 50, y: 50, r: 10 },
    };
    expect(SemanticRegionSchema.safeParse(region).success).toBe(false);
  });
});

// ── TacticalRegionSchema (union) ────────────────────────────────────────────

describe('TacticalRegionSchema', () => {
  it('accepts a raw geometry (legacy circle) without semantic wrapper', () => {
    expect(TacticalRegionSchema.safeParse({ x: 50, y: 50, r: 10 }).success).toBe(true);
  });

  it('accepts a raw geometry (lane) without semantic wrapper', () => {
    expect(TacticalRegionSchema.safeParse({ type: 'lane', x1: 0, y1: 0, x2: 20, y2: 0, width: 8 }).success).toBe(true);
  });

  it('accepts a semantic region wrapper', () => {
    const region = {
      label: 'left_inner_support_pocket',
      purpose: 'secondary_support_option',
      reference_frame: 'pitch',
      geometry: { type: 'rectangle', x: 22, y: 40, width: 12, height: 14 },
    };
    expect(TacticalRegionSchema.safeParse(region).success).toBe(true);
  });

  it('rejects a semantic region wrapper with missing geometry', () => {
    const region = {
      label: 'missing_geometry',
      purpose: 'primary_support_option',
      reference_frame: 'pitch',
    };
    // Without geometry, the value might parse as some primitive — but should fail the semantic schema
    const result = TacticalRegionSchema.safeParse(region);
    expect(result.success).toBe(false);
  });
});
