# Scenario Authoring Guide

## Overview

This document defines how scenarios are created, validated, and maintained for the Field Hockey Tactical Trainer.

Scenarios are the **primary content system** of the application.  
All gameplay, learning, and progression depend on their quality.

Scenarios are authored as **static JSON files** and committed to the repository.

---

## Authoring Goals

- Create realistic field hockey situations
- Teach a single clear tactical concept per scenario
- Allow multiple valid solutions where appropriate
- Ensure clarity of purpose for the player
- Maintain consistency across all scenarios

---

## Author Workflow (MVP)

### Step 1 — Create Scenario File
- Copy an existing scenario or template
- Save under appropriate category folder:

```text
/public/scenarios/<category>/


⸻

Step 2 — Fill Required Fields
	•	scenario_id
	•	version
	•	title
	•	description
	•	phase
	•	ball position
	•	teammates
	•	opponents
	•	pressure
	•	target player
	•	regions
	•	weight profile
	•	constraints
	•	difficulty
	•	tags

⸻

Step 2b — Add Optional Semantic Metadata (recommended for new scenarios)

Adding semantic metadata is optional but recommended. At minimum, consider including:

```json
{
  "line_group": "midfield",
  "primary_concept": "support",
  "situation": "build_out_under_press",
  "teaching_point": "One sentence describing the core coaching message."
}
```

For scenarios in a learning progression, also add:

```json
{
  "curriculum_group": "midfield_support",
  "learning_stage": 2,
  "prerequisites": ["CM_SUPPORT_BASIC_01"]
}
```

For authored feedback, add:

```json
{
  "feedback_hints": {
    "success": "What to say when the player succeeds.",
    "common_error": "What to say for the most typical mistake."
  }
}
```

See [specifications/scenario-semantic-metadata-spec.md](../specifications/scenario-semantic-metadata-spec.md) for the full list of available fields, controlled vocabulary values, and examples.

⸻

Step 3 — Validate
	•	run schema validation
	•	fix any errors
	•	ensure no missing required fields

⸻

Step 4 — Test Locally
	•	load scenario in app
	•	verify:
	•	board renders correctly
	•	player can move
	•	scoring behaves as expected
	•	feedback is logical

⸻

Step 5 — Commit & Deploy
	•	commit JSON file
	•	push to repository
	•	GitHub Pages deploy updates

⸻

Scenario Design Principles

1. Single Concept Focus

Each scenario should primarily test:
	•	support
	•	cover
	•	transfer
	•	spacing
	•	pressure response

Avoid mixing too many concepts.

⸻

2. Clear Tactical Intent

Scenario description must clearly state:
	•	what the player is trying to achieve

Example:

“Move to support the ball carrier safely under pressure.”

⸻

3. Realistic Spacing
	•	avoid unrealistic clustering
	•	maintain plausible player positions
	•	simulate real match situations

⸻

4. Meaningful Pressure

Pressure must be:
	•	explicitly defined
	•	relevant to the scenario

Bad example:
	•	pressure: none (for complex support scenario)

⸻

5. Multiple Valid Solutions

Where possible:
	•	include acceptable regions
	•	allow alternate-valid solutions via constraints

Avoid overly restrictive setups.

⸻

6. Region Design

Regions use the polymorphic `TacticalRegion` type. Choose whichever shape best fits the intended area:

| Shape | When to use |
|---|---|
| `{ x, y, r }` (legacy circle) | Simple circular zone — most common |
| `{ type: "circle", x, y, r }` | Same as legacy; explicit tag optional |
| `{ type: "rectangle", x, y, width, height, rotation? }` | Corridor or box-shaped zones |
| `{ type: "polygon", vertices: [{x,y}...] }` | Irregular or angled areas |
| `{ type: "lane", x1, y1, x2, y2, width }` | Passing lanes or diagonal corridors |

Ideal Regions
- represent best tactical positioning
- should not be too small

Acceptable Regions
- allow variation
- capture reasonable alternatives

⸻

7. Constraint Thresholds

Constraints should:
	•	reflect the tactical goal
	•	not be overly strict
	•	align with weight profile

⸻

8. Difficulty Calibration

Difficulty	Meaning
1	very obvious
2	simple
3	moderate
4	complex
5	advanced


⸻

Scenario Categories

Recommended folders:
	•	build-out
	•	defence
	•	attack
	•	transition

⸻

Naming Conventions

scenario_id

Format:

<ROLE>_<CONCEPT>_<VARIANT>

Example:

CM_SUPPORT_RIGHT_01


⸻

Tags

Used for progression and filtering.

Examples:
	•	support
	•	cover
	•	press
	•	build_out
	•	transition
	•	spacing

⸻

Common Mistakes

1. Overly Small Regions
	•	makes valid play fail
	•	causes frustration

⸻

2. Missing Pressure Context
	•	removes tactical meaning

⸻

3. No Acceptable Regions
	•	too rigid
	•	prevents alternate valid solutions

⸻

4. Unrealistic Layout
	•	players too close
	•	impossible spacing

⸻

5. Conflicting Constraints
	•	creates impossible scoring
	•	must be avoided

⸻

Validation Checklist

Before committing:
	•	All required fields present
	•	Coordinates valid (0–100)
	•	Target player exists in teammates
	•	At least one opponent exists
	•	Regions defined
	•	Pressure defined
	•	Weight profile exists
	•	Scenario loads in app
	•	Feedback makes sense

⸻

Testing Guidelines

Manual Testing
	•	try multiple positions:
	•	ideal
	•	acceptable
	•	clearly wrong
	•	verify scoring behavior
	•	verify alternate-valid cases

⸻

Edge Case Testing
	•	place player far away
	•	place player directly on ball
	•	place player overlapping teammate

⸻

Content Quality Guidelines

Good scenarios:
	•	feel like real hockey
	•	teach one thing clearly
	•	reward correct thinking
	•	explain mistakes clearly

Bad scenarios:
	•	unclear objective
	•	ambiguous scoring
	•	too many competing ideas
	•	overly strict positioning

⸻

Versioning Rules
- increment version when:
  - positions change
  - regions change
  - constraints change
  - scoring logic changes

Do NOT change version for:
- spelling fixes
- description text updates only

---

Future Authoring Improvements

Planned (not required for MVP):
	•	visual scenario editor
	•	drag-and-place authoring UI
	•	automatic region suggestion
	•	AI-assisted scenario generation

⸻

Responsibilities

Authors
	•	create high-quality scenarios
	•	validate correctness
	•	ensure clarity

Developers
	•	enforce schema validation
	•	provide debugging tools
	•	ensure engine matches spec

⸻

Final Rule

If a scenario produces confusing or inconsistent feedback:

→ Fix the scenario, not the player.

Scenarios must always be:
	•	clear
	•	fair
	•	explainable

⸻


