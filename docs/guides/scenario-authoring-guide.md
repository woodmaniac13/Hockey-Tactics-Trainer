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

To label the high-level tactical pattern of the scenario, add a `scenario_archetype` value. This improves authoring consistency and AI generation quality. Choose from the validated catalog:

| Value | Tactical pattern |
|---|---|
| `back_outlet_support` | Back-line player offering an outlet pass option |
| `fullback_escape_option` | Fullback creating an escape route under pressure |
| `midfield_triangle_restore` | Midfield player reconnecting the passing triangle |
| `interior_support_under_press` | Interior player supporting the ball carrier under press |
| `forward_width_hold` | Forward maintaining wide position to stretch defence |
| `forward_press_angle` | Forward positioning to apply a pressing angle |
| `help_side_cover` | Player on the help side covering a central channel |
| `central_recovery_cover` | Central player recovering into a covering shape |
| `sideline_trap_support` | Support player assisting a sideline trap structure |
| `weak_side_balance` | Weak-side player balancing the team shape |

```json
{
  "scenario_archetype": "interior_support_under_press"
}
```

See [specifications/scenario-semantic-metadata-spec.md](../specifications/scenario-semantic-metadata-spec.md) for the full list of available fields, controlled vocabulary values, and examples.

⸻

Step 3 — Run Content Lint

Run the content lint check to catch errors and warnings before loading the scenario in the app:

```bash
npm run lint-content
```

This validates all scenario files in `public/scenarios/`. Fix any **errors** before committing. **Warnings** are advisory — review them but they do not block acceptance.

Alternatively, use the standalone script for a more detailed pre-commit report:

```bash
npx tsx scripts/lint-scenarios.ts
```

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

Minimum Required Semantic Fields

New authored scenarios must include the following fields. The content lint layer (`npm run lint-content`) will error if any of these are absent:

| Field | Why required |
|---|---|
| `line_group` | Identifies which line the scenario targets (`back`, `midfield`, `forward`) |
| `primary_concept` | Names the main tactical concept being taught |
| `situation` | Describes the tactical game situation (controls filtering) |
| `teaching_point` | One-sentence coaching message shown as tactical context in feedback |
| `feedback_hints.success` | Specific coaching language shown on IDEAL/VALID results |
| `feedback_hints.common_error` | Coaching language shown on PARTIAL/INVALID results |

**Strongly recommended** (the lint layer will warn if absent):

| Field | Why recommended |
|---|---|
| `scenario_archetype` | Ensures authoring consistency and improves LLM generation quality |
| `target_role_family` | Helps content filtering and gap analysis |
| `field_zone` | Enables coverage analysis across the pitch |
| `feedback_hints.teaching_emphasis` | Shown after every attempt as a persistent coaching point |
| `secondary_concepts` | Documents additional tactical concepts covered |

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

All authored regions must use the **semantic wrapper** format. Choose the geometry shape that best fits the intended tactical area:

```json
{
  "label": "inside_support_pocket",
  "purpose": "primary_support_option",
  "reference_frame": "pitch",
  "geometry": { "type": "circle", "x": 52, "y": 64, "r": 6 }
}
```

| Geometry shape | When to use |
|---|---|
| `{ "type": "circle", x, y, r }` | Simple circular zone — use for most support/cover regions |
| `{ "type": "rectangle", x, y, width, height, rotation? }` | Corridor or box-shaped zones |
| `{ "type": "polygon", vertices: [{x,y}...] }` | Irregular or angled tactical areas |
| `{ "type": "lane", x1, y1, x2, y2, width }` | Passing lanes or diagonal corridors |

> **Note:** Raw geometry without a semantic wrapper (e.g. `{ "type": "circle", ... }` at the top level) is only accepted in tests and internal tooling. Authored scenarios must use semantic wrappers. The content lint will error if raw geometry is found in `public/scenarios/`.

Ideal Regions
- represent best tactical positioning
- include a `purpose` of `primary_support_option` or similar
- should not be too small

Acceptable Regions
- allow variation and capture reasonable alternatives
- use `purpose: "secondary_support_option"` or equivalent

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
	•	Run `npm run lint-content` — zero errors
	•	All required semantic fields present (line_group, primary_concept, situation, teaching_point)
	•	feedback_hints.success and feedback_hints.common_error present
	•	All regions use semantic wrapper format (not raw geometry)
	•	Coordinates valid (0–100)
	•	Target player exists in teammates
	•	At least one opponent exists
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


