# Semantic region implementation plan

## Status
Implementation plan for adding semantic region wrappers on top of the existing tactical region geometry model.

This document translates the semantic region proposal into concrete code changes.

The design intent remains:

- pitch-relative semantic regions are the default and preferred mode
- entity-relative, ball-relative, and target-player-relative regions are advanced options
- existing geometric regions remain valid during transition

---

## Objective

Implement semantic regions in a way that:

- preserves compatibility with existing authored scenarios
- adds tactical meaning without breaking current evaluation flow
- keeps geometry resolution centralized in the evaluator pipeline
- provides a clean migration path from raw geometry to semantic wrappers

---

## Files expected to change

### Primary

- `src/scenarios/scenarioSchema.ts`
- `src/evaluation/evaluator.ts`
- `src/types/index.ts`

### Likely follow-up

- `docs/specifications/scenario-schema-definition.md`
- `docs/guides/scenario-authoring-guide.md`
- selected example scenarios under `public/scenarios/`

---

## Step 1 — Add semantic wrapper types to the schema

## Target

Allow `ideal_regions` and `acceptable_regions` to contain either:

- raw geometry (current behavior), or
- a semantic wrapper containing metadata plus `geometry`

## Proposed schema additions

### Reference frame

```ts
export const ReferenceFrameSchema = z.enum([
  'pitch',
  'ball',
  'target_player',
  'entity',
]);
```

### Semantic purpose

```ts
export const SemanticRegionPurposeSchema = z.enum([
  'primary_support_option',
  'secondary_support_option',
  'passing_lane_support',
  'pressure_relief',
  'switch_option',
  'width_hold',
  'depth_hold',
  'defensive_cover',
  'central_protection',
  'recovery_run',
  'press_trigger',
  'screening_position',
  'custom',
]);
```

### Semantic region wrapper

```ts
export const SemanticRegionSchema = z.object({
  label: z.string().optional(),
  purpose: SemanticRegionPurposeSchema.optional(),
  reference_frame: ReferenceFrameSchema.optional(),
  reference_entity_id: z.string().optional(),
  notes: z.string().optional(),
  geometry: TacticalRegionGeometrySchema,
}).strict().superRefine((region, ctx) => {
  const frame = region.reference_frame ?? 'pitch';
  if (frame === 'entity' && !region.reference_entity_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['reference_entity_id'],
      message: 'reference_entity_id is required when reference_frame is "entity"',
    });
  }
  if (frame !== 'entity' && region.reference_entity_id !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['reference_entity_id'],
      message: 'reference_entity_id is only valid when reference_frame is "entity"',
    });
  }
});
```

### Geometry extraction

Refactor the current union of region primitives into a geometry-only schema:

```ts
export const TacticalRegionGeometrySchema = z.union([
  CircleRegionSchema,
  TaggedCircleRegionSchema,
  RectangleRegionSchema,
  PolygonRegionSchema,
  LaneRegionSchema,
]);
```

Then redefine tactical region as:

```ts
export const TacticalRegionSchema = z.union([
  TacticalRegionGeometrySchema,
  SemanticRegionSchema,
]);
```

---

## Step 2 — Update shared TypeScript types

## Target

Reflect the schema additions in `src/types/index.ts`.

## Proposed type shape

```ts
export type ReferenceFrame =
  | 'pitch'
  | 'ball'
  | 'target_player'
  | 'entity';

export type SemanticRegionPurpose =
  | 'primary_support_option'
  | 'secondary_support_option'
  | 'passing_lane_support'
  | 'pressure_relief'
  | 'switch_option'
  | 'width_hold'
  | 'depth_hold'
  | 'defensive_cover'
  | 'central_protection'
  | 'recovery_run'
  | 'press_trigger'
  | 'screening_position'
  | 'custom';

export type TacticalRegionGeometry =
  | { x: number; y: number; r: number }
  | { type: 'circle'; x: number; y: number; r: number }
  | { type: 'rectangle'; x: number; y: number; width: number; height: number; rotation?: number }
  | { type: 'polygon'; vertices: Point[] }
  | { type: 'lane'; x1: number; y1: number; x2: number; y2: number; width: number };

export type SemanticRegion = {
  label?: string;
  purpose?: SemanticRegionPurpose;
  reference_frame?: ReferenceFrame;
  reference_entity_id?: string;
  notes?: string;
  geometry: TacticalRegionGeometry;
};

export type TacticalRegion = TacticalRegionGeometry | SemanticRegion;
```

---

## Step 3 — Add evaluator-side region resolution

## Target

Resolve semantic regions into pitch-space geometry before existing hit-testing logic runs.

This should be the main implementation principle:

- downstream scoring should operate on resolved geometry
- semantic metadata should remain optional and non-breaking

## Proposed evaluator additions

### A. Add type guards

```ts
function isSemanticRegion(region: TacticalRegion): region is SemanticRegion {
  return 'geometry' in region;
}
```

### B. Add entity lookup helper

```ts
function getReferencePointForRegion(region: SemanticRegion, scenario: Scenario): Point | null {
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
```

### C. Add geometry translation helper

```ts
function translateGeometry(
  geometry: TacticalRegionGeometry,
  origin: Point,
): TacticalRegionGeometry {
  if (!('type' in geometry)) {
    return { x: geometry.x + origin.x, y: geometry.y + origin.y, r: geometry.r };
  }
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
  }
}
```

### D. Resolve region to pitch-space geometry

```ts
function resolveRegionGeometry(region: TacticalRegion, scenario: Scenario): TacticalRegionGeometry | null {
  if (!isSemanticRegion(region)) return region;
  const frame = region.reference_frame ?? 'pitch';
  if (frame === 'pitch') return region.geometry;
  const origin = getReferencePointForRegion(region, scenario);
  if (!origin) return null;
  return translateGeometry(region.geometry, origin);
}
```

---

## Step 4 — Route all hit testing through resolved geometry

## Target

Refactor region-hit logic to operate on resolved geometry rather than directly on the original authored region object.

## Recommended approach

- rename the current `isRegionHit` helper to something like `isResolvedGeometryHit`
- resolve each region first
- skip invalid unresolved semantic regions safely

## Proposed evaluation flow

```ts
function isRegionHit(playerPos: Point, region: TacticalRegion, scenario: Scenario): boolean {
  const resolved = resolveRegionGeometry(region, scenario);
  if (!resolved) return false;
  return isResolvedGeometryHit(playerPos, resolved);
}
```

Then update `computeRegionFitScore` to pass `scenario` through.

---

## Step 5 — Preserve current scoring behavior initially

## Target

Keep the first semantic-region implementation low-risk.

The first pass should:

- preserve current region scoring rules
- add only reference-frame resolution
- avoid coupling semantic `purpose` into scoring yet

That means:

- ideal region hit still yields `1.0`
- acceptable circle still uses a boundary gradient
- acceptable non-circle still returns the current fixed acceptable score

Semantic metadata can be used later for richer feedback or evaluator tuning.

---

## Step 6 — Add example authored regions

## Target

Add a minimal number of scenarios that demonstrate the new preferred authoring style.

## Recommended examples

### Example A — pitch-relative lane

A preferred new-style region:

```json
{
  "label": "strong_side_outlet_lane",
  "purpose": "primary_support_option",
  "reference_frame": "pitch",
  "geometry": {
    "type": "lane",
    "x1": 28,
    "y1": 34,
    "x2": 46,
    "y2": 34,
    "width": 10
  }
}
```

### Example B — pitch-relative rectangle

```json
{
  "label": "left_inner_support_pocket",
  "purpose": "secondary_support_option",
  "reference_frame": "pitch",
  "geometry": {
    "type": "rectangle",
    "x": 22,
    "y": 40,
    "width": 12,
    "height": 14
  }
}
```

### Example C — advanced ball-relative lane

Add only one advanced example after the pitch-relative path works cleanly.

---

## Step 7 — Authoring policy to apply after implementation

After the code lands, the repo should prefer:

- semantic regions for all newly authored scenarios
- `reference_frame: 'pitch'` by default
- explicit `label` and `purpose` where possible

Advanced frames (`ball`, `target_player`, `entity`) should be used only when the tactical meaning genuinely depends on another object.

---

## Step 8 — Deferred items

These should not be part of the first implementation pass.

### Deferred

- purpose-aware scoring
- purpose-aware feedback generation
- warnings for missing labels or purposes in runtime UI
- automatic migration of all old scenarios
- pressure-direction-derived reference frames
- advanced region-shape gradients for polygons and lanes

The goal of the first pass is structure and compatibility, not full semantic exploitation.

---

## Acceptance criteria

Implementation is complete when all of the following are true.

### Schema acceptance

- `ideal_regions` and `acceptable_regions` accept semantic wrappers
- geometric regions remain valid
- `reference_frame` defaults to pitch behavior
- `entity` mode requires `reference_entity_id`

### Evaluator acceptance

- semantic regions resolve to pitch-space geometry before hit testing
- pitch-relative semantic regions behave identically to equivalent raw geometry
- ball-relative, target-player-relative, and entity-relative regions resolve correctly
- unresolved entity references fail safely

### Content acceptance

- at least one scenario demonstrates pitch-relative semantic region authoring
- at least one advanced example exists after the base path is stable

---

## Recommended next code sequence

1. update `src/scenarios/scenarioSchema.ts`
2. update `src/types/index.ts`
3. update `src/evaluation/evaluator.ts`
4. add 1–2 example scenarios using pitch-relative semantic regions
5. run validation and evaluator tests

---

## Recommendation

Implement semantic regions as a thin wrapper around the existing geometry system.

Keep the first pass focused on:

- schema support
- pitch-relative default behavior
- advanced reference-frame resolution
- evaluator compatibility

Do not expand into purpose-aware scoring until the semantic wrapper model is stable.
