# Scenario Marking Roadmap

## Process rule

For scenario-marking and schema evolution, this project follows a documentation-first process.
Before implementation changes are made, the repository documentation must be updated to reflect revised requirements, de-scoped items, target behavior, and intended implementation direction.
Code changes must then follow that documentation update.
These changes are not considered complete unless both steps occur: documentation first, implementation second.

---

## 1. Current status

The repository currently implements:

- **Circle-only tactical regions** — `ideal_regions` and `acceptable_regions` are defined as `{ x, y, r }` circles in the scenario schema and evaluated using a simple distance check in the evaluator.
- **Hardcoded weight profiles** — a small set of named profiles (`build_out_v1`, `defence_v1`, `transition_v1`) are referenced by string in each scenario; loading logic resolves these by name with no data-driven discovery.
- **Angle-only support scoring** — the support component measures the angle between the player-to-ball vector and the pressure vector; distance and pressure context are not included.
- **Global tag-driven reasoning bonus** — the reasoning bonus is awarded by matching a player's reasoning selection against scenario tags; there is no scenario-authored alignment.
- **Schema validation via Zod** — scenarios are validated at load time and rejected if required fields are missing or malformed.
- **Static scenario JSON content** — scenarios are committed as JSON files under `/public/scenarios/` and lazy-loaded via the content manifest.

---

## 2. De-scoped items

At the current stage of the project, the following are **not** active requirements.
They should not be presented as current priorities in repository documentation or implementation.

- **Scenario-version backward compatibility for historical score comparability** — the `version` field in scenarios is retained for content management, but ensuring that scores from old attempts remain numerically comparable across scenario revisions is not required now. Scores may change when scenarios or weight profiles are updated; this is acceptable.
- **Client/server parity or reconciliation behavior** — there is no server-side evaluation; evaluation runs entirely in the browser.
- **Server-authoritative evaluation** — not an active requirement at this stage.
- **Coach preview tooling as a current milestone** — a visual scenario editor or authoring UI is a future possibility, not a near-term deliverable.

These may be revisited in a later phase, but they are not being worked on now.

---

## 3. Priority changes

The following are the current near-term priorities, in order of importance.

### 3.1 Richer tactical region model (high priority)

The project should move beyond circle-only placement regions so that scenarios can express tactical intent more precisely and so that AI/LLM systems can generate scenario content more reliably.

Circles are a reasonable primitive but are insufficient alone for expressive tactical authoring.

### 3.2 Weight-profile robustness and maintainability

The current weight-profile system relies on a hardcoded list of profile names and minimal validation.
The project should move toward a more data-driven, validated, and maintainable system.

### 3.3 Improved support scoring

Support scoring should be improved to include more than angle alone, so that it better reflects tactical intent.

### 3.4 Reasoning bonus improvement

Reasoning bonus behavior should be improved where practical to reduce reliance on a simple global tag lookup.

**Status**: Implemented. Scenarios now carry an optional `correct_reasoning` field that lists the tactically correct reasoning options for that scenario. When present, the evaluator uses this list directly. When absent, the tag-driven heuristic is used as a fallback. All existing scenarios have been updated with authored reasoning values.

### 3.5 Weight normalization and validation

Weight validation and normalization behavior should be explicitly defined and improved.

### 3.6 Pressure intensity use (lower priority)

The `intensity` field in the pressure object is captured in the schema but not yet used in evaluation.
Its use should be investigated as a lower-priority future refinement.

### 3.7 Feedback generation (low priority)

Current feedback is acceptable.
Limited expansion using composed or piecewise text is acceptable if needed, but this is not a top priority relative to schema and evaluator work.

---

## 4. Target design

This section defines the intended behavior for each area before implementation begins.

### 4.1 Tactical region model

**Current behavior:** regions are circle-only, defined as `{ x, y, r }`.

**Target behavior:** the region model should support multiple primitives so that scenarios can describe tactical areas more expressively, and so that AI/LLM-generated scenario content remains stable and structured.

Intended region family:

| Type | Description |
|---|---|
| `circle` | center point and radius — current primitive, remains valid |
| `rectangle` | axis-aligned bounding box or rotated rectangle |
| `polygon` | arbitrary convex or concave polygon defined by vertex list |
| `lane` / `corridor` | a directional band defined by a spine and width |
| named / labeled areas | optional semantic labels attached to any primitive |

Design principles:

- Circles remain a valid and acceptable primitive; they are not being removed.
- The project is moving toward richer, more expressive tactical region types.
- The schema must remain machine-authorable and validator-friendly so that AI/LLM systems can generate content reliably.
- Authoring complexity should not be unnecessarily high for human authors.

The schema change must be **additive and backward-compatible** with existing circle-only scenarios.
Existing scenarios with circle regions must continue to validate and evaluate correctly.

### 4.2 Weight-profile system

**Current behavior:** profiles are named strings; a small set of hardcoded profiles is loaded; validation checks only for a non-zero weight sum.

**Target behavior:**

- Profile handling should be **data-driven** — profiles are discovered and loaded from a manifest or directory scan rather than a hardcoded list in implementation code.
- **Validation** should be stronger than requiring a non-zero total:
  - individual weights must be non-negative; weights above `1.0` are allowed for un-normalized (raw) profiles and will be normalized at evaluation time
  - weights should be validated against a known component list
  - unknown components should produce a warning
- **Normalization behavior** should be explicitly defined. The project currently prefers **soft normalization**:
  - authored profiles may specify raw (un-normalized) weights
  - the evaluator normalizes weights at evaluation time if the sum is not 1.0
  - a warning or log is emitted when normalization is applied
  - strict rejection of non-normalized profiles is not required
- Profiles should support clear **tactical archetypes** (build-out, defensive shape, transition, etc.) and be designed to be readable and maintainable.

### 4.3 Support scoring

**Current behavior:** support is scored using angle only — the angle between the player-to-ball vector and a perpendicular to the pressure vector.

**Target behavior:** support scoring should include:

| Factor | Description |
|---|---|
| Support angle | current angle-based component — retained |
| Distance-to-ball band | a band-based score rewarding positions within a tactically appropriate distance range |
| Pressure context | the pressure direction and intensity should influence the scoring logic |
| Pressure intensity (future) | optional lower-priority future influence on scoring thresholds |

The current implementation is simpler than this target.
The intent is to improve it incrementally, beginning with distance-to-ball band integration.

### 4.4 Reasoning bonus

**Current behavior:** the reasoning bonus maps a player's selected reasoning tag against scenario tags using a global tag-driven lookup.

**Target direction:**

- Improve beyond a simple global tag-driven mapping where practical.
- The preferred long-term direction is toward **scenario-authored reasoning alignment** — scenarios explicitly define which reasoning options are correct, rather than relying on tag matching alone.
- This work is **secondary** to region-model and weight-profile improvements.
- Incremental improvements within the current tag-driven approach are acceptable in the short term.

**Implemented:** Scenarios now carry an optional `correct_reasoning` field (array of `ReasoningOption` values). When present, the evaluator uses this array directly for alignment scoring. When absent, the tag-driven heuristic applies as a fallback. All existing public scenarios have been updated with authored `correct_reasoning` values.

---

## 5. Implementation order

For all areas in scope, the required order is:

1. **Documentation update** — this document and any related docs must define the revised requirements and target design before code changes begin.
2. **Code update** — implementation changes follow the documented target.

A change is only complete when both steps have occurred.

### Likely affected files (code phase)

| Area | Files |
|---|---|
| Scenario schema | `src/scenarios/scenarioSchema.ts`, scenario JSON content |
| Evaluator | `src/evaluation/evaluator.ts` |
| Weight-profile loading | `src/scenarios/scenarioLoader.ts`, `src/scenarios/scenarioSchema.ts`, weight profile JSON assets |

---

## 6. Acceptance criteria

### Documentation acceptance

- [x] Repository documentation removes the de-scoped requirements listed in section 2.
- [x] Repository documentation records the revised priorities from section 3.
- [x] Repository documentation defines the intended target design from section 4 before implementation.
- [x] Repository documentation states that documentation must precede code changes in this area.

### Code acceptance (to be verified after implementation)

- [x] The implementation follows the documented target direction.
- [x] The code no longer contradicts the updated documentation.
- [x] Changed schema, evaluator, or weight-profile behavior aligns with the documented intent.
- [x] Existing circle-only scenarios continue to validate and evaluate correctly.

### Process acceptance

- [x] Documentation is updated before code changes are made.
- [x] Both documentation and code updates occur.
