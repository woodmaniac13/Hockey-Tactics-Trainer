# Scenario marking change sequence

## Status
Accepted working direction for upcoming scenario-marking and schema changes.

This document defines the required sequence for changes in this area of the project:

1. update repository documentation first
2. then implement the corresponding code changes
3. treat the work as incomplete unless both occur

This is a process and scope-control document. It exists to ensure that the repo records revised requirements and target behavior before implementation changes are made.

---

## Objective

For scenario-marking, schema evolution, and related evaluation work, the project follows a documentation-first process.

The repository documentation must be updated before code changes are made so that the repo clearly states:

- what is no longer a current requirement
- what is now a priority
- what target behavior is intended
- what implementation direction should follow

Code changes must then follow the documentation update.

Neither documentation-only nor code-only completion is sufficient.

---

## Required sequence

### Phase A — documentation update

Before implementation work begins, the repository documentation must be updated to:

- remove de-scoped requirements and expectations
- record the revised project priorities
- describe the intended target design for the next phase
- explain the planned implementation direction
- make clear that documentation precedes code changes in this area

### Phase B — code update

After the documentation has been updated, the corresponding code changes must be made.

### Completion rule

A change in this area is only complete when:

1. the documentation is updated first, and
2. the code is then updated to match the documented intent

---

## Scope

This documentation-first rule applies to:

- scenario schema
- evaluator / marking logic
- tactical region representation
- weight-profile system
- support scoring
- reasoning bonus behavior
- validation rules affecting authored scenarios
- related documentation describing scenario authoring or evaluation

---

## De-scoped items

The following are not current project requirements and should not be presented as such in repository documentation:

- scenario-version backward compatibility for historical score comparability
- preservation of comparable scores across scenario revisions
- client/server parity or reconciliation behavior
- server-authoritative evaluation
- coach preview tooling as a current milestone

These may be revisited later, but they are not active requirements for the current stage of the project.

---

## Current priorities

Repository documentation should clearly describe the following as current priorities.

### 1. Richer tactical region model

This is a high priority.

The project should move beyond circle-only placement regions so that scenarios can express tactical intent more precisely and so that AI/LLM systems can generate scenario content more reliably.

### 2. Weight-profile robustness and maintainability

This is a significant concern and should be investigated and improved.

The project should move toward a more data-driven, validated, maintainable weight-profile system rather than relying on hardcoded assumptions.

### 3. Improved support scoring

Support scoring should be improved where practical so that it better reflects tactical intent.

### 4. Reasoning bonus improvement

Reasoning bonus behavior should be improved where practical within the current state of development.

### 5. Weight normalization and validation

Weight validation and normalization behavior should be investigated and improved where practical.

### 6. Pressure intensity use

Pressure intensity should be addressed later as a lower-priority refinement.

### 7. Feedback generation

Current feedback is acceptable for now. Limited expansion using composed or piecewise text is acceptable if needed, but it is not a top priority relative to schema and evaluator work.

---

## Documentation requirements before code changes

Before code changes are made, the repository documentation should define the intended target behavior for the following areas.

### Tactical region model

The documentation should state that the current circle-only region model is being replaced or extended by a richer tactical region model intended to support:

- human scenario authoring
- AI/LLM scenario generation
- more expressive tactical meaning
- clearer future evaluation and feedback behavior

The documentation should describe the intended direction as supporting multiple region primitives, such as:

- circle
- rectangle
- polygon
- lane or corridor
- optional named or labeled tactical areas

The documentation should make clear that circles remain only one possible primitive, not the sole tactical representation.

### Weight-profile system

The documentation should define the intended direction for weight profiles:

- profile handling should be data-driven rather than hardcoded
- validation should be stronger than requiring only a non-zero total
- normalization behavior should be explicitly defined
- profile design should support tactical archetypes cleanly

At the current stage, the documentation should prefer a soft-normalization approach:

- allow authored raw weights
- normalize during evaluation
- validate and warn where practical

### Support scoring

The documentation should define support scoring as including more than angle alone.

The intended direction should include:

- support angle
- distance-to-ball band
- pressure context
- optional future influence from pressure intensity

The documentation should make clear that the current implementation is simpler than the intended target and is to be improved.

### Reasoning bonus

The documentation should describe the intended direction as improving beyond a simple global tag-driven mapping where practical.

The preferred direction is toward more explicit or scenario-authored alignment over time, while keeping this secondary to region-model and weight-profile improvements.

---

## Code changes that must follow the documentation update

After the documentation update, corresponding code changes should be made.

### Scenario schema changes

The schema should be updated to support a richer tactical region model.

Likely affected areas:

- `src/scenarios/scenarioSchema.ts`
- scenario JSON content
- evaluation code consuming region definitions

### Evaluator changes

The evaluator should then be updated to support:

- richer region-fit logic
- improved support scoring using distance-to-ball band
- optional light use of pressure intensity where practical
- improved reasoning alignment where practical

Likely affected area:

- `src/evaluation/evaluator.ts`

### Weight-profile changes

The weight-profile system should then be improved to support:

- non-hardcoded discovery or loading
- better validation
- defined normalization behavior

Likely affected areas:

- `src/scenarios/scenarioLoader.ts`
- `src/scenarios/scenarioSchema.ts`
- weight profile assets and manifests

---

## Process rule for repository work

For scenario-marking and schema evolution, implementation work should not be treated as complete unless the corresponding documentation update already exists.

The required order is:

1. documentation update
2. implementation update

Both are required.

---

## Acceptance criteria

A work item in this area is complete only if all of the following are true.

### Documentation acceptance

- repository documentation removes the de-scoped requirements listed above
- repository documentation records the revised priorities
- repository documentation defines intended target behavior before implementation
- repository documentation states that documentation must precede code changes in this area

### Code acceptance

- the implementation follows the documented target direction
- the code no longer contradicts the updated documentation
- changed schema, evaluator, or weight-profile behavior aligns with the documented intent

### Process acceptance

- documentation is updated before code changes are made
- both documentation and code updates occur

---

## Recommended wording for related docs

The following wording may be reused in other repository documents:

> For scenario-marking and schema evolution, this project follows a documentation-first process. Before implementation changes are made, the repository documentation must be updated to reflect revised requirements, de-scoped items, target behavior, and intended implementation direction. Code changes must then follow that documentation update. These changes are not considered complete unless both steps occur: documentation first, implementation second.

And:

> At the current stage of the project, historical scoring compatibility across scenario versions, client/server parity, and coach preview tooling are not active requirements. Current priority is improving tactical region expressiveness, weight-profile robustness, and support-scoring quality in ways that are reliable for both human authors and AI-generated scenarios.
