# Scenario Schema Specification

## Overview

This document defines the structure, validation rules, and semantics of scenario files used by the Field Hockey Tactical Trainer.

Scenarios are static JSON files loaded at runtime. They define:
- the board state
- the tactical objective
- the player to be evaluated
- acceptable solution regions
- evaluation thresholds

This schema must be strictly validated before use.

---

## Design Goals

- Human-readable and editable
- Deterministic and consistent
- Flexible enough for multiple valid solutions
- Strict enough to prevent ambiguous or broken scenarios
- Compatible with static hosting (no external dependencies)

---

## File Location

All scenarios must be stored under:

```text
/public/scenarios/

Organized by category:

/public/scenarios/
  /build-out/
  /defence/
  /attack/
  /transition/


⸻

Scenario Structure

Full Example

{
  "scenario_id": "CM_SUPPORT_RIGHT_01",
  "version": 1,
  "title": "CM support under right-side pressure",
  "description": "Move the CM to support the ball carrier safely.",
  "phase": "attack",
  "team_orientation": "home_attacks_positive_x",

  "target_player": "CM",

  "ball": { "x": 58, "y": 68 },

  "teammates": [
    { "id": "CM", "role": "CM", "team": "home", "x": 50, "y": 60 },
    { "id": "RB", "role": "RB", "team": "home", "x": 60, "y": 70 }
  ],

  "opponents": [
    { "id": "F1", "role": "F", "team": "away", "x": 62, "y": 68 }
  ],

  "pressure": {
    "direction": "inside_out",
    "intensity": "medium"
  },

  "ideal_regions": [
    {
      "label": "inside_support_pocket",
      "purpose": "primary_support_option",
      "reference_frame": "pitch",
      "geometry": { "type": "circle", "x": 52, "y": 64, "r": 6 }
    }
  ],

  "acceptable_regions": [
    {
      "label": "wider_support_zone",
      "purpose": "secondary_support_option",
      "reference_frame": "pitch",
      "geometry": { "type": "circle", "x": 48, "y": 66, "r": 10 }
    }
  ],

  "weight_profile": "build_out_v1",

  "constraint_thresholds": {
    "support": 0.7,
    "passing_lane": 0.7,
    "pressure_relief": 0.6
  },

  "difficulty": 2,
  "tags": ["support", "cm", "build_out"]
}


⸻

Required Fields

Field	Type	Required
scenario_id	string	yes
version	number	yes
title	string	yes
description	string	yes
phase	string	yes
team_orientation	string	yes
target_player	string	yes
ball	object	yes
teammates	array	yes
opponents	array	yes
pressure	object	yes
ideal_regions	array	yes
acceptable_regions	array	yes
weight_profile	string	yes
constraint_thresholds	object	yes
difficulty	number	yes
tags	array	yes

---

Optional Semantic Metadata Fields

All fields below are optional. Existing scenarios without them remain fully valid. See [specifications/scenario-semantic-metadata-spec.md](scenario-semantic-metadata-spec.md) for full documentation.

| Field | Type | Description |
|---|---|---|
| `line_group` | enum | Line group: `back` \| `midfield` \| `forward` |
| `primary_concept` | enum | Primary tactical concept (controlled vocabulary) |
| `secondary_concepts` | enum[] | Additional concepts (same vocabulary) |
| `teaching_point` | string | Short authored coaching point |
| `target_role_family` | enum | Role family: `back` \| `midfield` \| `forward` |
| `situation` | enum | Tactical situation (controlled vocabulary) |
| `field_zone` | enum | Field zone (controlled vocabulary) |
| `game_state` | enum | Game state (controlled vocabulary) |
| `curriculum_group` | string | Named curriculum learning group |
| `learning_stage` | integer | Step number within the curriculum group |
| `prerequisites` | string[] | Scenario IDs to complete first |
| `recommended_after` | string[] | Scenario IDs for soft follow-up sequencing |
| `feedback_hints` | object | Authored coaching language hooks |
| `scenario_archetype` | enum | Tactical archetype (controlled vocabulary) |
| `correct_reasoning` | ReasoningOption[] | Reasoning options that are correct for this scenario (see [Authored Reasoning Alignment](#authored-reasoning-alignment)) |
| `entity_relationships` | EntityRelationship[] | Authoring-only spatial/tactical relationships (see [Entity Relationships](#entity-relationships)) |
| `consequence_frame` | ConsequenceFrame | Post-submission "what happens next" overlay (see [Consequence Frame](#consequence-frame)) |

⸻

Field Definitions

scenario_id

Unique identifier for scenario.

Rules:
	•	must be globally unique
	•	uppercase snake case recommended

⸻

version

Integer version.

Rules:
	•	increment on any change affecting scoring or layout
	•	used for compatibility with stored attempts

⸻

phase

Defines tactical context.

Allowed values:
	•	attack
	•	defence
	•	transition

⸻

team_orientation

Must be:

home_attacks_positive_x

No alternatives are defined.

⸻

target_player

ID of the player the user controls.

Must match a teammate entity.

⸻

ball

{ "x": number, "y": number }

Rules:
	•	0 ≤ x ≤ 100
	•	0 ≤ y ≤ 100

⸻

teammates / opponents

Array of entities.

Entity schema

{
  "id": "CM",
  "role": "CM",
  "team": "home",
  "x": 50,
  "y": 60
}

Rules
	•	unique id
	•	valid role string
	•	team must be:
	•	“home”
	•	“away”
	•	coordinates must be valid

⸻

Entity Constraints
	•	minimum total entities ≥ 10 recommended
	•	must include at least 1 opponent
	•	must include target player in teammates
	•	no duplicate ids

⸻

Pressure Object

{
  "direction": "inside_out",
  "intensity": "medium"
}

direction values
	•	inside_out
	•	outside_in
	•	central
	•	none

intensity values
	•	low
	•	medium
	•	high

Optional pressure detail fields (all optional):

| Field | Type | Description |
|---|---|---|
| `primary_presser_id` | string | Entity ID of the main pressing player |
| `forced_side` | enum | `inside` \| `outside` \| `sideline` \| `baseline` \| `none` |
| `blocked_lane` | string | Authored label for the blocked passing lane |
| `trap_zone` | string | Authored label for the intended trap area |

Example with optional fields:

{
  "direction": "outside_in",
  "intensity": "high",
  "primary_presser_id": "F1",
  "forced_side": "sideline",
  "blocked_lane": "central_return"
}

⸻

Regions

Regions use a polymorphic `TacticalRegion` type that accepts either a **semantic wrapper** (required for authored scenarios) or raw typed geometry (accepted in tests and internal tooling only).

**Authored scenarios must use semantic wrappers.** The content lint layer enforces this at authoring time. See `src/scenarios/scenarioLint.ts` and the authoring guide.

### Semantic wrapper (required for authored scenarios)

A semantic wrapper pairs tactical metadata with a geometric shape. Use this format for all `ideal_regions` and `acceptable_regions` in authored scenarios.

```json
{
  "label": "inside_support_pocket",
  "purpose": "primary_support_option",
  "reference_frame": "pitch",
  "geometry": { "type": "circle", "x": 52, "y": 64, "r": 6 }
}
```

**Fields**

| Field | Required | Description |
|---|---|---|
| `geometry` | **yes** | One of the typed geometry primitives below |
| `label` | recommended | Short descriptive name for the region |
| `purpose` | recommended | Controlled vocabulary — see `SemanticRegionPurpose` in types |
| `reference_frame` | optional | `pitch` (default), `ball`, `target_player`, or `entity` |
| `reference_entity_id` | conditional | Required only when `reference_frame` is `entity` |
| `notes` | optional | Authoring notes (not shown in UI) |

**Reference frames**

| Value | Meaning |
|---|---|
| `pitch` | Coordinates are absolute pitch-space (default, use for most scenarios) |
| `ball` | Geometry is offset relative to the ball position at load time |
| `target_player` | Geometry is offset relative to the target player's starting position |
| `entity` | Geometry is offset relative to a named entity (`reference_entity_id` required) |

---

### Geometry primitives (used inside `geometry` field)

All geometric regions require a `type` discriminator.

#### Circle

```json
{ "type": "circle", "x": 52, "y": 64, "r": 6 }
```

#### Rectangle

```json
{ "type": "rectangle", "x": 48, "y": 60, "width": 10, "height": 8 }
{ "type": "rectangle", "x": 48, "y": 60, "width": 10, "height": 8, "rotation": 0.3927 }
```

`rotation` is optional (radians, counter-clockwise). Omit or set to `0` for axis-aligned.

#### Polygon

```json
{ "type": "polygon", "vertices": [{"x":48,"y":60},{"x":58,"y":60},{"x":55,"y":70}] }
```

Any convex or concave polygon with ≥ 3 vertices. Point-in-polygon is evaluated with the ray-casting algorithm.

#### Lane

```json
{ "type": "lane", "x1": 40, "y1": 50, "x2": 70, "y2": 50, "width": 8 }
```

A rectangular corridor of constant width centred on the line segment (`x1,y1`) → (`x2,y2`).

---

### Ideal Regions

Best solutions. The geometry should define the tactically optimal area. Each region should be wrapped in a semantic wrapper with `purpose: "primary_support_option"` or equivalent.

### Acceptable Regions

Valid but less optimal solutions. Use `purpose: "secondary_support_option"` or similar in the semantic wrapper.

---

Rules
- at least one region must exist across both arrays
- all regions in authored scenarios must use the semantic wrapper format
- regions must be within pitch bounds
- circles: radius must be > 0
- rectangles: `width` and `height` must be > 0
- polygons: must have ≥ 3 vertices
- lanes: `width` must be > 0

⸻

Constraint Thresholds

Defines minimum required performance.

{
  "support": 0.7,
  "passing_lane": 0.7,
  "pressure_relief": 0.6
}

Rules
	•	values between 0 and 1
	•	must match known evaluation components

⸻

Weight Profile

Reference string:

"weight_profile": "build_out_v1"

Must match file in:

/public/weights/


⸻

Difficulty

Integer:
	•	1 (easy)
	•	5 (hard)

⸻

Tags

Used for grouping and progression.

Examples:
	•	support
	•	cover
	•	press
	•	build_out
	•	transition

⸻

Validation Rules (Strict)

Scenario must be rejected if:
	•	missing required field
	•	invalid coordinate
	•	no opponents
	•	no regions defined
	•	invalid pressure direction
	•	unknown weight profile
	•	duplicate entity ids
	•	target player not in teammates

⸻

Schema Validation

Use runtime validation (e.g. Zod).

Validation must occur:
	•	on scenario load
	•	before rendering

⸻

Error Handling

If scenario fails validation:
	•	do not render
	•	log error to console
	•	show user-friendly message
	•	continue loading other scenarios

⸻

Version Compatibility

The `version` field tracks changes to scoring layout. When loading stored progress:
- match on `scenario_id` only
- version mismatches do not invalidate attempts; they are surfaced to the user as informational

Historical score comparability across versions is not guaranteed and is out of scope.

---

Best Practices
	•	keep scenarios focused on one concept
	•	avoid overcrowding entities
	•	include realistic spacing
	•	allow multiple valid solutions
	•	avoid overly small regions
	•	ensure pressure context is clear

⸻

---

## Named Zones

Semantic regions support a `named_zone` field as an alternative to explicit `geometry`. When `named_zone` is present and `geometry` is absent, the system resolves coordinates automatically from the `NAMED_PITCH_ZONES` lookup table in `src/utils/pitchConstants.ts`.

When both `named_zone` and `geometry` are present, `geometry` takes precedence.

**Example**
```json
{
  "label": "left_midfield_support",
  "purpose": "primary_support_option",
  "named_zone": "left_midfield_triangle_slot"
}
```

### Full `NAMED_PITCH_ZONES` catalog

All geometries are in pitch-space (0–100 scale).

**Goalkeeper areas**

| Key | Geometry | Centre |
|---|---|---|
| `gk_distribution_area` | circle r=10 | x=8, y=50 |

**Defensive build-out pockets**

| Key | Geometry | Centre |
|---|---|---|
| `left_back_escape_pocket` | circle r=9 | x=22, y=82 |
| `right_back_escape_pocket` | circle r=9 | x=22, y=18 |
| `cb_outlet_right` | circle r=8 | x=20, y=28 |
| `cb_outlet_left` | circle r=8 | x=20, y=72 |
| `defensive_switch_corridor` | lane width=12 | x1=15,y1=35 → x2=15,y2=65 |

**Midfield support slots**

| Key | Geometry | Centre |
|---|---|---|
| `left_midfield_triangle_slot` | circle r=8 | x=42, y=28 |
| `right_midfield_triangle_slot` | circle r=8 | x=42, y=72 |
| `central_midfield_triangle_slot` | circle r=9 | x=45, y=50 |
| `midfield_right_outlet` | rect 14×18 | x=34, y=18 |
| `midfield_left_outlet` | rect 14×18 | x=34, y=64 |
| `midfield_interior_support` | rect 16×24 | x=40, y=38 |

**Defensive cover shadows**

| Key | Geometry | Centre |
|---|---|---|
| `central_cover_shadow` | circle r=10 | x=42, y=50 |
| `defensive_block_central` | rect 15×30 | x=15, y=35 |
| `right_cover_position` | circle r=9 | x=48, y=32 |
| `left_cover_position` | circle r=9 | x=48, y=68 |

**Recovery corridors**

| Key | Geometry | Centre |
|---|---|---|
| `right_recovery_corridor` | rect 25×22 | x=30, y=5 |
| `left_recovery_corridor` | rect 25×22 | x=30, y=73 |
| `central_recovery_zone` | circle r=12 | x=35, y=50 |

**Sideline trap positions**

| Key | Geometry | Centre |
|---|---|---|
| `sideline_trap_right` | rect 22×14 | x=35, y=2 |
| `sideline_trap_left` | rect 22×14 | x=35, y=84 |
| `pressing_trigger_right` | circle r=8 | x=28, y=18 |
| `pressing_trigger_left` | circle r=8 | x=28, y=82 |

**Attacking width strips**

| Key | Geometry | Centre |
|---|---|---|
| `right_wing_hold_strip` | rect 22×18 | x=60, y=3 |
| `left_wing_hold_strip` | rect 22×18 | x=60, y=79 |

**Attacking transition channels**

| Key | Geometry | Centre |
|---|---|---|
| `central_attacking_channel` | rect 18×24 | x=57, y=38 |
| `forward_run_right_channel` | circle r=9 | x=68, y=28 |
| `forward_run_left_channel` | circle r=9 | x=68, y=72 |
| `forward_run_central` | circle r=10 | x=70, y=50 |

**Circle-entry and D zones**

| Key | Geometry | Centre |
|---|---|---|
| `left_circle_entry_zone` | circle r=10 | x=82, y=28 |
| `right_circle_entry_zone` | circle r=10 | x=82, y=72 |
| `central_circle_entry_zone` | circle r=10 | x=84, y=50 |
| `d_edge_right` | circle r=8 | x=83, y=30 |
| `d_edge_central` | circle r=8 | x=86, y=50 |
| `d_edge_left` | circle r=8 | x=83, y=70 |
| `penalty_spot_corridor` | rect 12×16 | x=86, y=42 |
| `far_post_right` | circle r=7 | x=92, y=40 |
| `far_post_left` | circle r=7 | x=92, y=60 |

---

## Entity Relationships

The optional `entity_relationships` array declares spatial and tactical relationships between entities. These are **authoring-only** annotations — they are not used by the evaluator or scoring pipeline. The content lint layer cross-checks declared relationships against actual entity coordinates and emits warnings on geometric inconsistencies.

**Primary purpose:** help LLMs reason about player layouts relationally ("cb2 is `goal_side_of` the opposing forward") and derive realistic coordinates from those relationships using `CANONICAL_POSITION_ANCHORS` as a starting point.

**Structure**

```json
"entity_relationships": [
  {
    "entity_id": "CB2",
    "relationship": "goal_side_of",
    "relative_to": "F1",
    "notes": "CB2 sits between F1 and the home goal to prevent a through ball."
  }
]
```

| Field | Required | Description |
|---|---|---|
| `entity_id` | yes | ID of the entity whose position is being described |
| `relationship` | yes | Spatial/tactical relationship (controlled vocabulary below) |
| `relative_to` | yes | Entity ID of the reference entity, or `"ball"` for ball-relative |
| `notes` | optional | Authored note explaining the tactical intent |

**Relationship types**

| Value | Meaning |
|---|---|
| `goal_side_of` | Entity is positioned closer to own goal than the reference entity |
| `supporting_behind` | Entity is behind the reference (lower x value) |
| `screening` | Entity is positioned to block a passing lane to the reference |
| `pressing` | Entity is actively closing down the reference |
| `tracking_runner` | Entity is marking the reference in a run |
| `providing_width` | Entity is on the wide flank relative to the reference |

---

## Authored Reasoning Alignment

The optional `correct_reasoning` field explicitly declares which reasoning options are tactically correct for the scenario. When present, the evaluator uses this list directly to award the reasoning bonus. When absent, the evaluator falls back to a tag-driven heuristic.

```json
"correct_reasoning": ["create_passing_angle", "support_under_pressure"]
```

**Runtime behaviour:**
- Player selects a value in the list → reasoning bonus awarded
- Player selects a value not in the list → no bonus
- Field absent → tag-driven heuristic used

**Allowed values**

| Value | Label shown to player |
|---|---|
| `create_passing_angle` | Create a passing angle |
| `provide_cover` | Provide cover |
| `enable_switch` | Enable a switch |
| `support_under_pressure` | Support under pressure |
| `maintain_width` | Maintain width |
| `restore_shape` | Restore team shape |
| `break_pressure` | Break the press |
| `occupy_depth` | Occupy depth |

---

## Consequence Frame

The optional `consequence_frame` field contains authored one-step tactical consequences shown on the board after the player submits their position. It is **not evaluated** — it is used only for board overlay and feedback display.

- `on_success` is shown for IDEAL, VALID, and ALTERNATE_VALID results.
- `on_failure` is shown for PARTIAL and INVALID results.
- Both branches are optional independently.

**Structure**

```json
"consequence_frame": {
  "on_success": {
    "consequence_type": "pass_opened",
    "explanation": "Your inside support angle opens a pass through the press.",
    "arrows": [
      { "style": "pass", "from_entity_id": "RB", "to_entity_id": "CM", "label": "escape pass" }
    ],
    "pressure_result": "broken"
  },
  "on_failure": {
    "consequence_type": "pressure_maintained",
    "explanation": "Staying flat gives the presser an easy intercept.",
    "pressure_result": "intensified"
  }
}
```

### `OutcomePreview` fields

| Field | Required | Description |
|---|---|---|
| `consequence_type` | yes | Controlled vocabulary anchoring the outcome to a known tactical pattern |
| `explanation` | yes | One coaching sentence (max ~200 chars) tied to the tactical concept |
| `arrows` | optional | Arrows drawn on the board (max 3) |
| `entity_shifts` | optional | Entities shown at a future "ghost" position (max 2) |
| `pass_option_states` | optional | Pass lane states between entities (open / blocked / risky) |
| `lane_highlight` | optional | An explicit lane geometry highlighted as open or blocked |
| `pressure_result` | optional | `broken` \| `maintained` \| `intensified` |
| `shape_result` | optional | `triangle_formed` \| `line_restored` \| `overloaded` \| `exposed` |

### `consequence_type` controlled vocabulary

Positive types suit `on_success`; negative types suit `on_failure`. The lint layer warns when a negative type appears on `on_success`.

| Value | Meaning |
|---|---|
| `pass_opened` | The move creates a clear passing option |
| `pass_blocked` | The move fails to create a passing option |
| `pressure_broken` | The move breaks the press |
| `pressure_maintained` | The press is not relieved |
| `shape_restored` | The team regains structural shape |
| `shape_broken` | The team loses structural shape |
| `cover_gained` | Defensive cover is established |
| `cover_lost` | Defensive cover is lost |
| `lane_opened` | A passing lane is opened |
| `lane_closed` | A passing lane is closed |
| `triangle_formed` | A passing triangle is created |
| `triangle_broken` | A passing triangle is disrupted |
| `width_gained` | Width is maintained or increased |
| `width_lost` | Width is lost |
| `depth_created` | Depth is added to the attack |
| `overloaded_zone` | A zone is numerically overloaded |

### `Arrow` fields

| Field | Description |
|---|---|
| `style` | `pass` \| `run` \| `pressure` \| `cover_shift` |
| `from_entity_id` | Source entity ID, or `'ball'` |
| `to_entity_id` | Target entity ID, or `'ball'` |
| `from_point` | Explicit pitch-space source point (use when no entity anchor) |
| `to_point` | Explicit pitch-space target point (use when no entity anchor) |
| `label` | Optional short label near the arrow midpoint |

### `EntityShift` fields

| Field | Description |
|---|---|
| `entity_id` | ID of the entity showing a future ghost position |
| `to_x` | Target x in pitch space (0–100) |
| `to_y` | Target y in pitch space (0–100) |
| `label` | Optional label shown near the ghost position |

### `PassOptionState` fields

| Field | Description |
|---|---|
| `from_entity_id` | Entity with the ball (or `'ball'`) |
| `to_entity_id` | Potential receiving entity |
| `state` | `open` \| `blocked` \| `risky` |
| `label` | Optional coaching label |

---

## ScenarioIntent (Coordinate-Free Authoring Format)

`ScenarioIntent` is an LLM-friendly input format that describes a scenario entirely in symbolic/semantic terms — **no coordinates required**. The `intentToScenario()` function resolves a `ScenarioIntent` into a draft `Scenario` with real coordinates by looking up `position_hint` anchors and `named_zone` geometries from `src/utils/pitchConstants.ts`.

**Source:** `src/scenarios/scenarioIntent.ts`  
**CLI:** `npm run generate-scenario -- <intent.json>`

### Workflow

1. Author or LLM generates a `ScenarioIntent` JSON (no x/y values needed).
2. Run `npm run generate-scenario -- <intent.json>` to produce a draft `Scenario`.
3. Run `npm run lint-content` and fix any errors or warnings.
4. Review/adjust the draft and commit to `public/scenarios/`.

### Key differences from the full Scenario schema

| Difference | ScenarioIntent | Scenario |
|---|---|---|
| Entity coordinates | `position_hint` key from `CANONICAL_POSITION_ANCHORS` | Raw `x`, `y` |
| Region geometry | `named_zone` key or `offset_hint` description | Explicit geometry or `named_zone` |
| Boilerplate fields | Omitted | `scenario_id`, `version`, `weight_profile` filled by converter |
| Ball position | Inferred from `is_ball_carrier` entity | Explicit `ball` object |

### Required fields

All fields that are optional in the full Scenario schema are **required** in `ScenarioIntent` to ensure the LLM provides complete semantic metadata before conversion:

`title`, `description`, `scenario_archetype`, `phase`, `line_group`, `primary_concept`, `situation`, `field_zone`, `game_state`, `difficulty`, `teaching_point`, `feedback_hints`, `entities` (min 2), `ideal_zones` (min 1), `pressure`

### `IntentEntity` structure

```json
{
  "id": "CM",
  "role": "CM",
  "team": "home",
  "position_hint": "cm_own_half_right",
  "is_target": true
}
```

- `position_hint` must be a key from `CANONICAL_POSITION_ANCHORS`.
- Mark exactly one entity `is_target: true`.
- Optionally mark one entity `is_ball_carrier: true`; if absent the ball is placed at the first non-GK home entity.

### `IntentRegion` structure

```json
{
  "label": "inside_support_pocket",
  "purpose": "primary_support_option",
  "named_zone": "left_midfield_triangle_slot"
}
```

Either `named_zone` (preferred — resolves geometry automatically) or `offset_hint` (documents intent; converter uses a placeholder circle) must be provided.

### Canonical position anchors (key entries)

| Key | Role | x | y |
|---|---|---|---|
| `gk_own_goal` | Goalkeeper | 3 | 50 |
| `cb_defensive_central` | Centre-back | 18 | 50 |
| `rb_defensive_right` | Right-back | 20 | 12 |
| `lb_defensive_left` | Left-back | 20 | 88 |
| `dm_defensive_mid` | Defensive mid | 32 | 50 |
| `cm_own_half_central` | Central mid (own half) | 38 | 50 |
| `cm_midfield_central` | Central mid (midfield) | 48 | 50 |
| `cm_advanced_central` | Central mid (advanced) | 58 | 50 |
| `fw_attacking_central` | Forward | 72 | 50 |
| `cf_circle_edge_central` | Striker at circle edge | 82 | 50 |

See `src/utils/pitchConstants.ts` for the full table including all opponent anchors and width/channel variants.

---

## Future Extensions

Potential additions:
- multiple movable players
- dynamic objectives
- scenario scripting
- role-specific constraints

These must not break existing schema.

