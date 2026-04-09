# Schema Extensions and Roadmap

## Purpose

This document describes the evolution of the Hockey Tactics Trainer scenario model to improve:
- tactical realism
- scenario quality
- authoring consistency
- feedback specificity
- curriculum design
- AI-assisted scenario generation

The Phase 1 schema extension is complete. The system now enforces the strict tagged-region format, full semantic metadata, and typed archetype validation. All legacy compatibility shims have been removed.

This document describes what has been completed and what is planned for the remaining phases.

---

## Current Strengths

The current scenario system already provides:
- strict required fields for authored scenarios
- deterministic evaluator behavior
- support for multiple valid solutions
- flexible region definitions
- phase-aware weight profiles
- static hosting compatibility
- schema validation at load time

These remain the foundation. All phases build on this core, not around it.

---

## Problem Statement

The current schema describes board state well, but it does not describe tactical meaning richly enough.

Examples of information that is currently implicit rather than explicit:
- whether the scenario is for a back, midfielder, or forward
- the primary tactical concept being taught
- the intended coaching point
- whether pressure is coming from a specific presser or as a team effect
- whether the scenario is build-out, press, recovery, trap support, or weak-side shape
- how the scenario fits into a progression pathway
- what scenario-specific feedback should say

As a result:
- scenario authoring can drift
- feedback can feel generic
- scenarios can be tactically valid but semantically thin
- AI-generated scenarios may be structurally valid but educationally inconsistent
- progression systems have limited semantic information to work with

---

## Design Goals

Any schema evolution must preserve the project's existing strengths while actively removing legacy constraints.

### Goals
- enforce strict tagged-region format (no untyped legacy regions)
- keep JSON authoring simple
- improve scenario semantics by requiring key metadata at authoring time
- validate archetypes against a typed catalog
- improve AI generation quality
- improve future tooling and QA
- enable curriculum-aware progression

### Non-goals
- no move to dynamic scripting
- no requirement for backend services
- no replacement of the existing evaluator pipeline

### Retired goals (removed to unblock progress)

The following goals were appropriate during early MVP development but now actively limit the project. They have been retired:

- ~~remain backward compatible~~ — the legacy untagged circle region format has been removed. All regions must use the typed format (`{ "type": "circle", ... }`). Existing scenarios have been upgraded.
- ~~no breaking changes to current scenario loading~~ — the schema now enforces strict typed regions and validates archetype values. Scenarios that do not conform must be updated.
- ~~allow incremental adoption~~ — all authored scenarios are expected to carry the full semantic metadata model.

---

## Proposed Schema Extensions

### Overview

The proposal adds optional fields in six areas:
1. tactical semantics
2. role and line-group context
3. richer pressure description
4. curriculum and progression metadata
5. authored feedback hooks
6. scenario archetype

All new fields are optional.

---

### 1. Tactical Semantics

**Problem**

The current schema includes `title`, `description`, and `tags`, but these are too loose to serve as the canonical tactical meaning of the scenario.

**Proposal**

Add optional semantic fields:

```json
{
  "line_group": "midfield",
  "primary_concept": "support",
  "secondary_concepts": ["spacing", "pressure_relief"],
  "teaching_point": "Offer inside support at a safe angle to help the ball carrier escape pressure."
}
```

**Allowed values**

`line_group`: `back` | `midfield` | `forward`

`primary_concept`: `support` | `cover` | `transfer` | `spacing` | `pressure_response` | `width_depth` | `recovery_shape` | `pressing_angle`

`secondary_concepts`: Array of concept strings from the same controlled vocabulary.

**Benefits**
- clearer scenario intent
- easier filtering and progression grouping
- better AI generation prompts
- easier review of scenario balance across the library
- more specific feedback mapping

---

### 2. Role and Tactical Context Metadata

**Problem**

Roles exist only as freeform entity strings. The schema does not explicitly describe the tactical context of the scenario, only the player layout.

**Proposal**

Add optional context metadata:

```json
{
  "target_role_family": "midfield",
  "situation": "build_out_under_press",
  "field_zone": "middle_third_right",
  "game_state": "open_play"
}
```

**Allowed values**

`target_role_family`: `back` | `midfield` | `forward`

`situation`: `build_out_under_press` | `settled_attack` | `defensive_shape` | `high_press` | `recovery_defence` | `counter_attack` | `sideline_trap` | `free_hit_shape` | `circle_entry_support`

`field_zone`: `defensive_third_left` | `defensive_third_central` | `defensive_third_right` | `middle_third_left` | `middle_third_central` | `middle_third_right` | `attacking_third_left` | `attacking_third_central` | `attacking_third_right` | `circle_edge_left` | `circle_edge_central` | `circle_edge_right`

`game_state`: `open_play` | `restart` | `turnover` | `counter` | `set_press`

**Benefits**
- helps group scenarios into meaningful tactical families
- improves progression design
- improves future analytics and content coverage review
- allows better authoring dashboards and LLM instructions

---

### 3. Richer Pressure Model

**Problem**

The current `pressure` object contains only `direction` and `intensity`. That is enough for MVP scoring, but not enough for richer hockey teaching.

**Proposal**

Extend the existing `pressure` object with optional detail fields:

```json
{
  "pressure": {
    "direction": "outside_in",
    "intensity": "high",
    "primary_presser_id": "F1",
    "forced_side": "sideline",
    "blocked_lane": "central_return",
    "trap_zone": "right_touchline"
  }
}
```

**New optional fields**

| Field | Description |
|---|---|
| `primary_presser_id` | Entity ID of the main presser |
| `forced_side` | `inside` \| `outside` \| `sideline` \| `baseline` \| `none` |
| `blocked_lane` | Freeform authored label for the blocked passing lane |
| `trap_zone` | Optional authored label for the intended trap area |

**Benefits**
- clarifies intended tactical reading
- supports more specific feedback later
- improves AI-generated scenarios
- gives future evaluators richer context without breaking current logic

---

### 4. Curriculum and Progression Metadata

**Problem**

Current scenario progression relies mainly on `difficulty`, `tags`, and broader content organization. That is not enough to build a strong teaching sequence.

**Proposal**

Add optional curriculum fields:

```json
{
  "curriculum_group": "midfield_support",
  "learning_stage": 2,
  "prerequisites": ["CM_SUPPORT_BASIC_01"],
  "recommended_after": ["CM_SUPPORT_PRESSURE_02"]
}
```

**Proposed fields**

| Field | Type | Description |
|---|---|---|
| `curriculum_group` | string | Named group, e.g. `back_build_out`, `midfield_support` |
| `learning_stage` | integer | Step within the curriculum group |
| `prerequisites` | string[] | Scenario IDs to complete first |
| `recommended_after` | string[] | Scenario IDs for soft follow-up sequencing |

**Benefits**
- stronger learning progression
- better unlock logic in future
- easier guided training packs
- helps avoid random or uneven scenario ordering

---

### 5. Authored Feedback Hooks

**Problem**

The evaluator and feedback system generate structured output, but the scenario schema does not currently provide scenario-specific coaching language hooks.

**Proposal**

Add optional `feedback_hints`:

```json
{
  "feedback_hints": {
    "success": "You created a safe inside support angle and preserved the triangle around the ball.",
    "common_error": "You became too flat with the ball carrier and were easier to screen out.",
    "alternate_valid": "This was still a playable support line even though it sat outside the authored ideal region.",
    "teaching_emphasis": "Support should help the ball carrier escape pressure, not just stand nearby."
  }
}
```

**Benefits**
- more human coaching language
- less generic feedback
- better role-specific learning
- better authored experience without changing the evaluator

If absent, feedback generation continues using current system behavior.

---

### 6. Tactical Archetype Metadata

**Problem**

Weight profiles exist, but they are broad phase-level profiles rather than specific scenario archetypes.

**Proposal**

Add a lightweight optional field:

```json
{
  "scenario_archetype": "midfield_triangle_restore"
}
```

**Example archetypes**
- `back_outlet_support`
- `fullback_escape_option`
- `midfield_triangle_restore`
- `interior_support_under_press`
- `forward_width_hold`
- `forward_press_angle`
- `help_side_cover`
- `central_recovery_cover`
- `sideline_trap_support`
- `weak_side_balance`

**Benefits**
- stronger authoring consistency
- better LLM generation
- better content QA
- future path to archetype-specific validation and templates

---

### 7. Future Relationship Constraints (Phase 3+)

Many real hockey decisions depend on explicit relationships, not just generic support or region fit.

Examples:
- be goal-side of a runner
- form a triangle with two teammates
- stay inside the passing lane to the striker
- support behind the line of pressure

**Recommendation**

Treat this as Phase 3 or later. Reserve a future optional `relationship_hints` field. It should not be part of the first schema rollout.

---

## Proposed Extended Scenario Example

```json
{
  "scenario_id": "CM_SUPPORT_INSIDE_01",
  "version": 2,
  "title": "CM offers inside support under outside pressure",
  "description": "Move the CM to support the ball carrier safely and keep the shape connected.",
  "phase": "attack",
  "team_orientation": "home_attacks_positive_x",

  "target_player": "CM1",

  "ball": { "x": 58, "y": 68 },

  "teammates": [
    { "id": "GK1", "role": "GK", "team": "home", "x": 10, "y": 50 },
    { "id": "CB1", "role": "CB", "team": "home", "x": 52, "y": 66 },
    { "id": "RB1", "role": "RB", "team": "home", "x": 63, "y": 78 },
    { "id": "CM1", "role": "CM", "team": "home", "x": 50, "y": 58 },
    { "id": "LW1", "role": "LW", "team": "home", "x": 74, "y": 40 }
  ],

  "opponents": [
    { "id": "F1", "role": "F", "team": "away", "x": 61, "y": 67 },
    { "id": "F2", "role": "F", "team": "away", "x": 66, "y": 73 },
    { "id": "CMA1", "role": "CM", "team": "away", "x": 57, "y": 57 }
  ],

  "pressure": {
    "direction": "outside_in",
    "intensity": "medium",
    "primary_presser_id": "F1",
    "forced_side": "inside",
    "blocked_lane": "line_pass"
  },

  "ideal_regions": [
    { "type": "polygon", "vertices": [
      { "x": 49, "y": 60 },
      { "x": 55, "y": 58 },
      { "x": 58, "y": 64 },
      { "x": 51, "y": 66 }
    ]}
  ],

  "acceptable_regions": [
    { "type": "rectangle", "x": 46, "y": 58, "width": 14, "height": 12 }
  ],

  "weight_profile": "attack_v1",

  "constraint_thresholds": {
    "support": 0.65,
    "passing_lane": 0.60,
    "spacing": 0.50,
    "pressure_relief": 0.55
  },

  "difficulty": 3,
  "tags": ["support", "midfield", "attack", "pressure"],

  "line_group": "midfield",
  "primary_concept": "support",
  "secondary_concepts": ["spacing", "pressure_response"],
  "teaching_point": "Offer an inside passing angle without becoming flat or crowding the nearest support.",

  "target_role_family": "midfield",
  "situation": "build_out_under_press",
  "field_zone": "middle_third_right",
  "game_state": "open_play",

  "curriculum_group": "midfield_support",
  "learning_stage": 2,
  "prerequisites": ["CM_SUPPORT_BASIC_01"],

  "scenario_archetype": "interior_support_under_press",

  "feedback_hints": {
    "success": "You created a playable inside support angle and helped the ball carrier escape pressure.",
    "common_error": "You stayed too flat or too close, which reduced the value of the support option.",
    "alternate_valid": "This was still a workable support option even though it sat outside the best authored zone."
  }
}
```

---

## Validation Strategy

### Phase 1 validation approach

All new fields are optional and validated only when present.

Current required fields remain unchanged.

New fields validate against controlled vocabularies where practical:
- `line_group`
- `primary_concept`
- `secondary_concepts`
- `target_role_family`
- `situation`
- `field_zone`
- `game_state`
- `forced_side`

Freeform fields remain lightly constrained (string type only):
- `teaching_point`
- `feedback_hints.*`
- `blocked_lane`
- `trap_zone`
- `curriculum_group`
- `scenario_archetype`

---

## Roadmap

### Phase 0 — Documentation and content planning

**Goals**
- define the semantic layer
- agree on controlled vocabularies
- avoid premature evaluator changes

**Deliverables**
- this document
- updated scenario authoring guide
- semantic metadata specification
- initial tactical archetype list

Estimated impact: low engineering cost, high content value.

---

### Phase 1 — Schema extension and legacy removal ✅ (complete)

**Goals**
- add optional semantic metadata fields
- add typed archetype catalog with enum validation
- remove legacy untagged circle region format
- upgrade all existing scenarios to strict format

**Changes**
- extended scenario TypeScript types (all semantic fields, `ScenarioArchetype` union)
- extended Zod schema (archetype enum, strict validation throughout)
- removed `CircleRegion` (untagged) from `TacticalRegionGeometry`; removed `CircleRegionSchema` from `TacticalRegionGeometrySchema`
- removed legacy circle branches from evaluator, board renderer
- upgraded all public scenarios (S01–S06) to tagged format with full semantic metadata
- updated docs and templates

**Success criteria**
- all scenarios validate against the strict schema ✓
- new scenarios carry full semantic metadata ✓
- legacy scenarios have been upgraded ✓

---

### Phase 2 — UI and content tooling support ✅ (complete)

**Goals**
- make semantic metadata visible and useful to the player
- improve authoring QA

**Changes**
- scenario detail panel shows semantic badges: line group, primary concept, situation, difficulty, teaching point
- `ScenarioSelector` supports filtering by line group, primary concept, and situation
- `TrainingPage` manages active filter state and passes it into the selector

---

### Phase 3 — Feedback enrichment ✅ (complete)

**Goals**
- improve coaching quality without replacing current evaluator logic

**Changes**
- `feedback_hints.success` surfaces on IDEAL / VALID results
- `feedback_hints.common_error` surfaces on PARTIAL / INVALID results
- `feedback_hints.alternate_valid` surfaces on ALTERNATE_VALID results
- `feedback_hints.teaching_emphasis` is always shown when present as a dedicated coaching point
- `FeedbackResult` carries `teaching_emphasis` for rendering
- `FeedbackPanel` displays the teaching emphasis block

---

### Phase 4 — Archetype-aware authoring and generation ✅ (complete)

**Goals**
- strengthen scenario consistency
- improve AI scenario generation quality

**Changes**
- `ScenarioArchetype` TypeScript union type defined with all catalog entries
- `ScenarioArchetypeSchema` Zod enum validates authored archetype values
- `scenario_archetype` field in `ScenarioSchema` validates against the catalog
- all public scenarios carry an archetype value
- archetype values listed in scenario authoring guide

---

### Phase 5 — Relationship-aware scoring improvements

**Goals**
- support richer hockey semantics in scoring

**Potential additions**
- triangle reconstruction
- goal-side relationship
- line-of-pressure positioning
- weak-side balancing

**Recommendation**: do not start here. Only pursue after the metadata and tooling phases are stable.

---

## Recommended Priority Order

**Highest priority**
1. add optional semantic metadata
2. add optional curriculum metadata
3. add optional feedback hints
4. update docs and scenario templates

**Medium priority**
5. add UI filters and authoring diagnostics
6. define archetype catalog
7. create exemplar scenario packs using the new metadata

**Lower priority**
8. relationship-aware scoring
9. richer automated scenario QA maps and field heatmaps
10. evaluator logic expansion tied to new semantic fields

---

## Risks and Tradeoffs

### Risk: schema bloat

Adding too many fields may make authoring harder.

**Mitigation**: keep new fields optional; provide templates; use controlled vocabularies; document "minimum recommended" vs "advanced" authoring.

### Risk: metadata drift

Authors may use inconsistent naming.

**Mitigation**: validate enum-style fields; document canonical values; use templates and examples.

### Risk: evaluator and schema diverge

If new semantic fields are added but never used, they may become decorative only.

**Mitigation**: tie rollout to progression, feedback, filtering, and authoring QA; do not require evaluator changes immediately, but ensure UI and tooling consume the new fields early.

---

## Acceptance Criteria

This proposal is successful when:
- existing scenarios remain valid and unchanged
- new scenarios can carry richer tactical meaning
- authors can classify scenarios by role, concept, and situation
- the documentation clearly explains how to use the new fields
- scenario generation by LLMs becomes more consistent and educationally useful
- future progression and feedback work has a stronger data foundation
