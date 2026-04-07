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
    { "x": 52, "y": 64, "r": 6 }
  ],

  "acceptable_regions": [
    { "x": 48, "y": 66, "r": 10 }
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

No alternatives allowed in MVP.

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

⸻

Regions

Ideal Regions

Best solutions.

{
  "x": number,
  "y": number,
  "r": number
}


⸻

Acceptable Regions

Valid but less optimal solutions.

Same structure as ideal.

⸻

Rules
	•	at least one region must exist across both arrays
	•	regions must be within pitch bounds
	•	radius must be > 0

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

When loading progress:
	•	match scenario_id + version
	•	if version mismatch:
	•	treat as new scenario
	•	do not merge attempts

⸻

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
	•	polygon regions
	•	multiple movable players
	•	dynamic objectives
	•	scenario scripting
	•	role-specific constraints

These must not break existing schema.

⸻


