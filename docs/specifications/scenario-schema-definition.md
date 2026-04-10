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

Future Extensions

Potential additions:
- multiple movable players
- dynamic objectives
- scenario scripting
- role-specific constraints

These must not break existing schema.

⸻


