# Semantic region schema proposal

## Status
Proposed schema direction for semantic tactical regions.

This proposal extends the existing tactical region model so that regions can carry tactical meaning in addition to geometry.

The design priority is:

1. **pitch-relative semantic regions as the default and preferred authoring mode**
2. **entity-relative semantic regions as an advanced option**
3. retain compatibility with existing geometric region primitives

---

## Goals

The semantic region model should:

- make scenario JSON more expressive and easier to author
- improve AI/LLM generation quality by giving regions tactical meaning, not just shape
- remain simple for common pitch-relative use cases
- allow advanced dynamic regions relative to the ball or another entity where needed
- preserve clean evaluation and future feedback expansion

---

## Design principles

### 1. Pitch-relative is the default

Most semantic regions should be authored relative to the pitch.

This should be the preferred mode for:

- static tactical zones
- support channels
- outlet lanes
- recovery zones
- cover zones
- weak-side / strong-side areas expressed in fixed pitch coordinates

Pitch-relative regions are easier to:

- validate
- author consistently
- visualize
- debug
- generate with AI systems

### 2. Entity-relative is allowed as an advanced mode

Some tactical regions are better expressed relative to the ball, target player, teammate, or opponent.

Examples:

- support lane off the ball carrier
- pressure escape corridor opposite the pressure direction
- cover shadow relative to a defender
- immediate support pocket relative to the ball position

These should be supported, but they should be explicit and secondary to the pitch-relative model.

### 3. Geometry and semantics are separate concerns

A semantic region should carry:

- **semantic meaning** (what the region is for)
- **reference frame** (how the region is positioned)
- **geometry** (what shape it takes)

This keeps the model extensible and easier for both humans and tools to reason about.

---

## Proposed schema structure

A semantic region is a wrapper around a geometric shape.

```ts
export type SemanticRegion = {
  label?: string;
  purpose?: SemanticRegionPurpose;
  reference_frame?: ReferenceFrame;
  reference_entity_id?: string;
  notes?: string;
  geometry: RegionGeometry;
};
```

---

## Proposed core fields

### `label`

Optional short semantic identifier.

Purpose:

- human-readable reference
- future feedback hooks
- AI authoring stability
- debugging and tooling

Examples:

- `strong_side_outlet_lane`
- `weak_side_support_pocket`
- `central_cover_shadow`
- `high_right_recovery_zone`

Constraints:

- optional for now
- recommended for all newly authored semantic regions
- should be unique within a scenario where practical

### `purpose`

Optional controlled semantic category describing what tactical function the region serves.

```ts
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
```

Notes:

- optional at first, but strongly recommended
- can later inform feedback generation or authoring validation
- `custom` allows temporary extension without blocking content creation

### `reference_frame`

Defines how the region is positioned.

```ts
export type ReferenceFrame =
  | 'pitch'
  | 'ball'
  | 'target_player'
  | 'entity';
```

Rules:

- default should be `pitch`
- `ball`, `target_player`, and `entity` are advanced modes
- `entity` requires `reference_entity_id`

### `reference_entity_id`

Optional entity reference used only when:

- `reference_frame === 'entity'`

This should refer to a valid teammate or opponent `id` in the scenario.

Examples:

- `tm_right_back`
- `opp_cf`

### `notes`

Optional free-text author note.

Purpose:

- short author explanation
- AI generation hints
- not required for evaluation

This should not be used as a substitute for structured fields.

### `geometry`

The region shape itself.

This proposal reuses the existing polymorphic geometry model.

```ts
export type RegionGeometry =
  | LegacyCircleGeometry
  | CircleGeometry
  | RectangleGeometry
  | PolygonGeometry
  | LaneGeometry;
```

---

## Proposed geometry types

### Legacy circle geometry

Retained for backward compatibility.

```ts
export type LegacyCircleGeometry = {
  x: number;
  y: number;
  r: number;
};
```

### Tagged circle geometry

```ts
export type CircleGeometry = {
  type: 'circle';
  x: number;
  y: number;
  r: number;
};
```

### Rectangle geometry

```ts
export type RectangleGeometry = {
  type: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
};
```

### Polygon geometry

```ts
export type PolygonGeometry = {
  type: 'polygon';
  vertices: { x: number; y: number }[];
};
```

### Lane geometry

```ts
export type LaneGeometry = {
  type: 'lane';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
};
```

---

## Proposed authored region union

To preserve a clean migration path, the scenario schema should allow either:

1. existing geometric regions, or
2. new semantic-region wrappers

```ts
export type TacticalRegion = RegionGeometry | SemanticRegion;
```

This means existing scenario files remain valid while new authored content can move toward semantic regions.

---

## Normalization rules for reference frames

The evaluator should resolve all semantic regions into pitch-space geometry before hit testing.

### `pitch`

Default mode.

No transformation required.

Interpret `geometry` exactly in pitch coordinates.

### `ball`

Interpret the geometry as anchored relative to the current ball position.

Suggested behavior:

- circle / rectangle / polygon coordinates are offsets from the ball
- lane endpoints are offsets from the ball

### `target_player`

Interpret the geometry relative to the scenario target player’s current authored position.

This is useful for support and repositioning scenarios where the tactical zone is defined relative to the player being moved.

### `entity`

Interpret the geometry relative to the entity identified by `reference_entity_id`.

This is the most advanced mode and should be used sparingly.

---

## Validation rules

The schema should validate the following.

### Base semantic region validation

- `geometry` is required
- `reference_frame` defaults to `pitch` when omitted
- `label`, `purpose`, and `notes` are optional

### Reference-frame validation

- if `reference_frame === 'entity'`, `reference_entity_id` is required
- if `reference_frame !== 'entity'`, `reference_entity_id` must be absent
- if `reference_frame === 'pitch'`, the region should be treated as the preferred/default authoring mode

### Geometry validation

Existing geometric validation rules continue unchanged.

### Recommended authoring validation

Not required for strict parsing, but recommended for tooling or warnings:

- warn if a semantic region has no `label`
- warn if a semantic region has no `purpose`
- warn if multiple semantic regions share the same `label` within one scenario
- warn if advanced reference frames are used where a pitch-relative equivalent would suffice

---

## Recommended evaluation behavior

The evaluator should follow this order:

1. detect whether a region is geometric-only or semantic
2. if semantic, resolve it into pitch-space geometry using its `reference_frame`
3. evaluate the resolved geometry using the standard region-hit logic
4. preserve semantic metadata for future feedback or debugging

Important:

- semantic metadata should not break existing geometry-based scoring
- pitch-relative semantic regions should be the common path
- advanced reference frames should resolve to the same downstream evaluator API

---

## Recommended authoring policy

### Preferred authoring mode

New scenarios should prefer:

- semantic regions
- `reference_frame: 'pitch'`
- explicit `label`
- explicit `purpose`

### Allowed advanced mode

Use entity-relative or ball-relative regions only when the tactical intent truly depends on another object.

Examples where advanced mode is justified:

- support corridor relative to the ball
- pressure escape pocket relative to the ball
- cover shadow relative to a named opponent

### Transitional compatibility

Existing region formats should remain valid.

However, new documentation and new authored examples should prefer the semantic wrapper form.

---

## Example: preferred pitch-relative semantic region

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

---

## Example: pitch-relative support pocket

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

---

## Example: advanced ball-relative region

```json
{
  "label": "immediate_escape_lane",
  "purpose": "pressure_relief",
  "reference_frame": "ball",
  "geometry": {
    "type": "lane",
    "x1": 0,
    "y1": 0,
    "x2": 14,
    "y2": -6,
    "width": 8
  }
}
```

Interpretation:

- lane starts at the ball
- lane extends by offset from the ball position

---

## Example: advanced entity-relative cover region

```json
{
  "label": "cf_cover_shadow",
  "purpose": "defensive_cover",
  "reference_frame": "entity",
  "reference_entity_id": "opp_cf",
  "geometry": {
    "type": "polygon",
    "vertices": [
      { "x": -6, "y": -4 },
      { "x": 4, "y": -8 },
      { "x": 8, "y": 2 },
      { "x": -4, "y": 6 }
    ]
  }
}
```

Interpretation:

- polygon vertices are offsets relative to the named entity position

---

## Proposed TypeScript definition

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

export type RegionGeometry =
  | { x: number; y: number; r: number }
  | { type: 'circle'; x: number; y: number; r: number }
  | { type: 'rectangle'; x: number; y: number; width: number; height: number; rotation?: number }
  | { type: 'polygon'; vertices: { x: number; y: number }[] }
  | { type: 'lane'; x1: number; y1: number; x2: number; y2: number; width: number };

export type SemanticRegion = {
  label?: string;
  purpose?: SemanticRegionPurpose;
  reference_frame?: ReferenceFrame; // defaults to 'pitch'
  reference_entity_id?: string;
  notes?: string;
  geometry: RegionGeometry;
};

export type TacticalRegion = RegionGeometry | SemanticRegion;
```

---

## Recommended implementation order

1. add this semantic wrapper schema on top of the existing region primitives
2. keep legacy geometric regions valid
3. resolve semantic regions into pitch-space geometry inside the evaluator
4. add example scenarios using pitch-relative semantic regions first
5. add advanced ball-relative and entity-relative examples only after the pitch-relative workflow is stable

---

## Recommendation

Adopt semantic regions with:

- **pitch-relative as the default**
- **entity-relative and ball-relative as advanced options**
- **semantic metadata separated from geometry**
- **full compatibility with the current geometry primitives**

This gives the project a strong path toward richer AI-friendly scenario authoring without forcing a disruptive rewrite.
