# Scenario Semantic Metadata Specification

## Overview

This document defines the optional semantic metadata fields available on scenario objects.

These fields form a **semantic layer** on top of the core scenario schema. They are all optional and do not affect the existing evaluation pipeline. Their purpose is to:
- describe the tactical intent of a scenario explicitly
- enable better filtering, progression, and content QA
- provide richer hooks for authored feedback
- improve AI-assisted scenario generation quality

For the core scenario schema (required fields, region types, validation rules), see:
[specifications/scenario-schema-definition.md](scenario-schema-definition.md)

---

## Design Principles

- enum fields validate against a controlled vocabulary at schema-parse time
- freeform string fields remain lightly constrained (string type only)
- no evaluator logic changes are required to use these fields
- all fields are optional in the Zod schema — the **content lint layer** enforces which fields are required for authored scenarios in `public/scenarios/`

The following fields are **required for authored scenarios** (enforced by `npm run lint-content`):
- `line_group`, `primary_concept`, `situation`, `teaching_point`
- `feedback_hints.success`, `feedback_hints.common_error`

All other semantic fields remain optional. See the authoring guide for the full list of required and recommended fields.

---

## Field Classification

Fields are classified by their runtime role:

| Classification | Description |
|---|---|
| **Runtime-used** | Actively used by the evaluator, progression system, feedback engine, or UI at runtime |
| **User-facing** | Shown directly to the player in the training UI |
| **Authoring-only** | Validated and stored, but not used at runtime; serves content QA, AI generation, and future-facing work |

| Field | Classification |
|---|---|
| `line_group` | Runtime-used (filtering), User-facing (badge) |
| `primary_concept` | Runtime-used (feedback fallback enrichment, filtering), User-facing (badge) |
| `secondary_concepts` | Authoring-only; reserved for future filtering |
| `teaching_point` | Runtime-used — used verbatim as `tactical_explanation` in feedback |
| `target_role_family` | Authoring-only |
| `situation` | Runtime-used (filtering), User-facing (badge) |
| `field_zone` | Authoring-only |
| `game_state` | Authoring-only |
| `curriculum_group` | Runtime-used (progression recommendation ordering), User-facing (scenario details) |
| `learning_stage` | Runtime-used (progression recommendation ordering), User-facing (scenario details) |
| `prerequisites` | Runtime-used (progression gating — hard lock), User-facing (warning in scenario details) |
| `recommended_after` | Authoring-only (soft guidance, not yet wired into runtime) |
| `scenario_archetype` | User-facing (badge in scenario details); Authoring-only at runtime |
| `feedback_hints.*` | Runtime-used (feedback summary overrides) |
| `correct_reasoning` | Runtime-used — consumed by the evaluator to score reasoning alignment |
| `pressure.primary_presser_id` | **Authoring-only** — not evaluated or scored |
| `pressure.forced_side` | **Authoring-only** — not evaluated or scored |
| `pressure.blocked_lane` | **Authoring-only** — not evaluated or scored |
| `pressure.trap_zone` | **Authoring-only** — not evaluated or scored |

---

## Tactical Semantics Fields

These fields describe what the scenario is teaching and at what line-group level.

### `line_group`

Which line of the team the scenario primarily targets.

**Type**: enum string

**Allowed values**

| Value | Meaning |
|---|---|
| `back` | defensive line player |
| `midfield` | midfield player |
| `forward` | forward or attacking player |

**Example**
```json
"line_group": "midfield"
```

---

### `primary_concept`

The single main tactical concept being taught.

**Type**: enum string

**Allowed values**

| Value | Meaning |
|---|---|
| `support` | providing a passing option for the ball carrier |
| `cover` | providing defensive cover behind a teammate |
| `transfer` | switching play or redistributing |
| `spacing` | maintaining appropriate distance and structure |
| `pressure_response` | reacting correctly to defensive pressure |
| `width_depth` | contributing width or depth to team shape |
| `recovery_shape` | recovering into a defensive structure |
| `pressing_angle` | pressing from a tactically effective angle |

**Example**
```json
"primary_concept": "support"
```

---

### `secondary_concepts`

Additional tactical concepts the scenario also exercises. Uses the same controlled vocabulary as `primary_concept`.

**Type**: array of enum strings

**Example**
```json
"secondary_concepts": ["spacing", "pressure_response"]
```

---

### `teaching_point`

A short authored sentence that captures the core coaching message of the scenario. Intended for author reference, authoring QA, and potential use in future coaching UI.

**Type**: freeform string

**Example**
```json
"teaching_point": "Offer an inside passing angle without becoming flat or crowding the nearest support."
```

---

## Role and Tactical Context Fields

These fields describe the tactical situation the scenario represents.

### `target_role_family`

The role family of the player the user controls.

**Type**: enum string

**Allowed values**: `back` | `midfield` | `forward`

**Example**
```json
"target_role_family": "midfield"
```

---

### `situation`

The tactical situation context of the scenario.

**Type**: enum string

**Allowed values**

| Value | Meaning |
|---|---|
| `build_out_under_press` | building out from defence under opposition press |
| `settled_attack` | attacking in a settled shape with time on the ball |
| `defensive_shape` | holding or adjusting a defensive structure |
| `high_press` | pressing high as a team |
| `recovery_defence` | recovering into shape after losing possession |
| `counter_attack` | transitioning quickly from defence to attack |
| `sideline_trap` | pressing toward the sideline as a team |
| `free_hit_shape` | positioning for a free hit restart |
| `circle_entry_support` | supporting a teammate entering the circle |

**Example**
```json
"situation": "build_out_under_press"
```

---

### `field_zone`

The primary field zone where the scenario takes place.

**Type**: enum string

**Allowed values**

| Value |
|---|
| `defensive_third_left` |
| `defensive_third_central` |
| `defensive_third_right` |
| `middle_third_left` |
| `middle_third_central` |
| `middle_third_right` |
| `attacking_third_left` |
| `attacking_third_central` |
| `attacking_third_right` |
| `circle_edge_left` |
| `circle_edge_central` |
| `circle_edge_right` |

**Example**
```json
"field_zone": "middle_third_right"
```

---

### `game_state`

The game state at the time of the scenario.

**Type**: enum string

**Allowed values**

| Value | Meaning |
|---|---|
| `open_play` | flowing play |
| `restart` | set piece or restart situation |
| `turnover` | immediately following a change of possession |
| `counter` | counter-attack situation |
| `set_press` | organised team press triggered by a cue |

**Example**
```json
"game_state": "open_play"
```

---

## Pressure Detail Fields

> **Authoring-only.** These fields extend the `pressure` object with optional authored detail for content QA, author intent documentation, and future integration. They are **not** used by the evaluator, scoring engine, or feedback system at runtime.

The existing `direction` and `intensity` fields remain required and unchanged.

### `primary_presser_id`

The entity ID of the player applying the primary press.

**Type**: string

**Example**
```json
"primary_presser_id": "F1"
```

---

### `forced_side`

Which side the ball carrier is being forced toward by pressure.

**Type**: enum string

**Allowed values**: `inside` | `outside` | `sideline` | `baseline` | `none`

**Example**
```json
"forced_side": "inside"
```

---

### `blocked_lane`

An authored label for the passing lane that is being blocked by the pressing player or shape. Freeform string; no controlled vocabulary required.

**Example values**: `central_return` | `inside_midfield` | `line_pass` | `switch_lane`

**Example**
```json
"blocked_lane": "line_pass"
```

---

### `trap_zone`

An authored label for the area the press is intended to funnel the ball carrier into. Freeform string.

**Example**
```json
"trap_zone": "right_touchline"
```

---

## Curriculum and Progression Fields

These fields describe where a scenario fits within a structured learning progression.

### `curriculum_group`

The named learning group this scenario belongs to. Freeform string; no controlled vocabulary enforced.

**Example groups**: `back_build_out` | `midfield_support` | `forward_press` | `defensive_cover` | `transition_recovery` | `attacking_width`

**Example**
```json
"curriculum_group": "midfield_support"
```

---

### `learning_stage`

The step number within the curriculum group. Should be a positive integer.

**Example**
```json
"learning_stage": 2
```

---

### `prerequisites`

An array of `scenario_id` values that **must** be completed (best_score ≥ 80) before this scenario becomes available. This is a hard gate — the scenario will be `LOCKED` until all prerequisites are met. Unmet prerequisites are shown in the scenario details UI.

**Example**
```json
"prerequisites": ["CM_SUPPORT_BASIC_01"]
```

---

### `recommended_after`

An array of `scenario_id` values that work well as follow-up scenarios after this one. Softer than prerequisites — used for suggested sequencing rather than hard unlocking.

> **Not yet wired at runtime.** This field is stored and validated but not currently consumed by the progression system. It is retained as an authoring documentation tool and reserved for future curriculum tooling. Use it to document intended sequencing when authoring scenario packs.

**Example**
```json
"recommended_after": ["CM_SUPPORT_PRESSURE_02"]
```

---

## Authored Feedback Hints

The `feedback_hints` object provides scenario-specific coaching language. If present, these strings can be used by the feedback system to produce more human, context-aware responses.

If absent, the feedback system falls back to its standard generated output.

### Fields

| Field | Description |
|---|---|
| `success` | What to say when the player finds a good solution |
| `common_error` | What to say when the player makes the most typical mistake |
| `alternate_valid` | What to say when the player finds a valid but non-ideal solution |
| `teaching_emphasis` | The core coaching point to emphasise regardless of outcome |

**Example**
```json
"feedback_hints": {
  "success": "You created a playable inside support angle and helped the ball carrier escape pressure.",
  "common_error": "You stayed too flat or too close, which reduced the value of the support option.",
  "alternate_valid": "This was still a workable support option even though it sat outside the best authored zone.",
  "teaching_emphasis": "Support should help the ball carrier escape pressure, not just stand nearby."
}
```

---

## Scenario Archetype

### `scenario_archetype`

A lightweight label that identifies the high-level tactical pattern of the scenario. Must be one of the values in the validated catalog below.

**Runtime classification: Authoring-only.** The archetype is validated by the Zod schema (must be a known catalog value) and cross-checked for consistency by the content lint layer (see `ARCHETYPE_CONSTRAINTS` in `src/scenarios/scenarioLint.ts`). It is not used by the evaluator or scoring pipeline at runtime.

**Valid archetype values**

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

**Example**
```json
"scenario_archetype": "interior_support_under_press"
```

---

## Authored Reasoning Alignment

### `correct_reasoning`

An explicit list of the reasoning options that are tactically correct for this scenario. When present, the evaluator uses this list directly to score the player's reasoning selection. When absent, the evaluator falls back to a tag-driven heuristic.

**Type**: array of enum strings

**Allowed values**: `create_passing_angle` | `provide_cover` | `enable_switch` | `support_under_pressure` | `maintain_width` | `restore_shape` | `break_pressure` | `occupy_depth`

**Runtime behaviour**:
- if the player selects any value in this list → reasoning bonus awarded
- if the player selects a value not in this list → no bonus
- if the field is absent → tag-driven heuristic applies as before

**Example**
```json
"correct_reasoning": ["create_passing_angle", "support_under_pressure"]
```

Scenarios where only one option is tactically correct:
```json
"correct_reasoning": ["provide_cover"]
```

---

## Minimum Recommended Metadata

Not every scenario needs all optional fields. A reasonable minimum for new scenarios:

```json
{
  "line_group": "midfield",
  "primary_concept": "support",
  "situation": "build_out_under_press",
  "teaching_point": "Short sentence describing the key coaching point."
}
```

Full metadata (including curriculum, archetype, and feedback hints) should be added when:
- creating a scenario intended for a specific learning progression
- creating a scenario as part of a themed pack or curriculum group
- wanting richer authored feedback

---

## Content Lint

The content lint layer (`src/scenarios/scenarioLint.ts`) enforces authoring quality rules that are not expressible in the Zod schema:

- **Errors** (blocking — must be fixed):
  - Missing required semantic fields (`line_group`, `primary_concept`, `situation`, `teaching_point`, `feedback_hints.success`, `feedback_hints.common_error`)
  - Regions using raw geometry instead of semantic wrappers
  - `target_player` not found in teammates
  - Duplicate entity IDs
  - `scenario_archetype` inconsistent with `line_group`, `primary_concept`, or `phase` per `ARCHETYPE_CONSTRAINTS`

- **Warnings** (advisory — review but not blocking):
  - Entity role not in `CANONICAL_ROLES` vocabulary
  - Missing `feedback_hints.teaching_emphasis`
  - Missing `target_role_family`, `field_zone`, `scenario_archetype`, or `secondary_concepts`
  - `pressure.forced_side` missing with high-intensity directional pressure
  - `recommended_after` missing when `learning_stage > 1`

Run with:
```bash
npm run lint-content           # via vitest (errors fail, warnings are advisory)
npx tsx scripts/lint-scenarios.ts     # standalone CLI with detailed output
npx tsx scripts/lint-scenarios.ts --strict  # exit 1 on warnings too
```

---

## Validation Rules

| Field | Validation |
|---|---|
| `line_group` | must be a valid enum value when present |
| `primary_concept` | must be a valid enum value when present |
| `secondary_concepts` | each element must be a valid `primary_concept` enum value |
| `target_role_family` | must be a valid enum value when present |
| `situation` | must be a valid enum value when present |
| `field_zone` | must be a valid enum value when present |
| `game_state` | must be a valid enum value when present |
| `forced_side` | must be a valid enum value when present |
| `teaching_point` | any string when present |
| `curriculum_group` | any string when present |
| `learning_stage` | positive integer when present |
| `prerequisites` | array of strings when present |
| `recommended_after` | array of strings when present |
| `feedback_hints` | object with known string fields only (strict) |
| `scenario_archetype` | must be a valid enum value when present |
| `correct_reasoning` | array of valid `ReasoningOption` enum values when present |
| `primary_presser_id` | any string when present |
| `blocked_lane` | any string when present |
| `trap_zone` | any string when present |

Unknown fields will be rejected by the schema validator (strict mode).

---

## Related Documents

- [specifications/scenario-schema-definition.md](scenario-schema-definition.md) — core scenario schema
- [guides/scenario-authoring-guide.md](../guides/scenario-authoring-guide.md) — authoring workflow
- [specifications/feedback-generation-spec.md](feedback-generation-spec.md) — feedback pipeline
- [specifications/progression-system-spec.md](progression-system-spec.md) — progression and unlock logic
- [process/proposed-schema-extensions-and-roadmap.md](../process/proposed-schema-extensions-and-roadmap.md) — design rationale and phased roadmap
