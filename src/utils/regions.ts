import type {
  TacticalRegion,
  TacticalRegionGeometry,
  SemanticRegion,
  Scenario,
  Point,
} from '../types';

/** Returns true when a region carries semantic metadata (i.e. is a SemanticRegion). */
export function isSemanticRegion(region: TacticalRegion): region is SemanticRegion {
  return 'geometry' in region;
}

/**
 * Returns the reference origin for a semantic region's reference frame.
 * Pitch-relative regions use the zero origin (no translation required).
 * Returns null if the reference entity cannot be found.
 */
export function getReferencePointForRegion(region: SemanticRegion, scenario: Scenario): Point | null {
  const frame = region.reference_frame ?? 'pitch';
  switch (frame) {
    case 'pitch':
      return { x: 0, y: 0 };
    case 'ball':
      return scenario.ball;
    case 'target_player': {
      const target = scenario.teammates.find(t => t.id === scenario.target_player);
      return target ? { x: target.x, y: target.y } : null;
    }
    case 'entity': {
      const entities = [...scenario.teammates, ...scenario.opponents];
      const ref = entities.find(e => e.id === region.reference_entity_id);
      return ref ? { x: ref.x, y: ref.y } : null;
    }
    default:
      return null;
  }
}

/**
 * Translates all coordinate fields of a geometry primitive by the given origin offset.
 * Used to convert entity-relative / ball-relative regions into pitch-space.
 */
export function translateGeometry(geometry: TacticalRegionGeometry, origin: Point): TacticalRegionGeometry {
  switch (geometry.type) {
    case 'circle':
      return { ...geometry, x: geometry.x + origin.x, y: geometry.y + origin.y };
    case 'rectangle':
      return { ...geometry, x: geometry.x + origin.x, y: geometry.y + origin.y };
    case 'polygon':
      return {
        ...geometry,
        vertices: geometry.vertices.map(v => ({ x: v.x + origin.x, y: v.y + origin.y })),
      };
    case 'lane':
      return {
        ...geometry,
        x1: geometry.x1 + origin.x,
        y1: geometry.y1 + origin.y,
        x2: geometry.x2 + origin.x,
        y2: geometry.y2 + origin.y,
      };
    default: {
      // TypeScript exhaustiveness guard — should never be reached with a valid TacticalRegionGeometry.
      const _exhaustive: never = geometry;
      return _exhaustive;
    }
  }
}

/**
 * Resolves a TacticalRegion into pitch-space geometry ready for hit-testing or rendering.
 * Raw geometry is returned as-is.
 * Semantic regions are translated according to their reference frame.
 * Returns null if the reference entity cannot be found (safe fallback — treated as no hit / not drawn).
 */
export function resolveRegionGeometry(region: TacticalRegion, scenario: Scenario): TacticalRegionGeometry | null {
  if (!isSemanticRegion(region)) return region;
  const frame = region.reference_frame ?? 'pitch';
  if (frame === 'pitch') return region.geometry;
  const origin = getReferencePointForRegion(region, scenario);
  if (!origin) return null;
  return translateGeometry(region.geometry, origin);
}
