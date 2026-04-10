# Documentation Index

Complete index of all Hockey Tactics Trainer documentation, organized by category.

---

## Design

| Document | Description |
|---|---|
| [design/design-document.md](design/design-document.md) | High-level product vision, goals, scope, non-goals, user flow, and architecture overview. Start here for a full understanding of the system. |

---

## Specifications

| Document | Description |
|---|---|
| [specifications/static-architecture-spec.md](specifications/static-architecture-spec.md) | Static-site architecture: module boundaries, data flow, component responsibilities, and deployment model. |
| [specifications/evaluation-engine-specification.md](specifications/evaluation-engine-specification.md) | The core evaluation pipeline: input validation, tactical component scoring (support angle + distance blend, passing lane, spacing, pressure relief, width/depth, cover), region scoring, weight normalization, and result classification. |
| [specifications/scenario-schema-definition.md](specifications/scenario-schema-definition.md) | Full scenario JSON schema: required fields, entity rules, polymorphic region types (legacy circle, tagged circle, rectangle, polygon, lane), constraint thresholds, and validation rules. |
| [specifications/scenario-semantic-metadata-spec.md](specifications/scenario-semantic-metadata-spec.md) | Optional semantic metadata fields for scenarios: tactical semantics, role context, pressure detail, curriculum/progression, authored feedback hooks, and scenario archetype. |
| [specifications/weight-profile-spec.md](specifications/weight-profile-spec.md) | Weight profile format, allowed components, runtime normalization behavior, data-driven loading via `weights-manifest.json`, and example profiles. |
| [specifications/content-manifest-specification.md](specifications/content-manifest-specification.md) | Scenario pack manifest format used to organize and load scenario content. |
| [specifications/data-model-and-persistence.md](specifications/data-model-and-persistence.md) | Client-side data model: progress records, attempt records, settings, and localStorage persistence strategy. |
| [specifications/feedback-generation-spec.md](specifications/feedback-generation-spec.md) | How feedback text is generated from component scores, result type, reasoning alignment, and optional authored `feedback_hints`. |
| [specifications/progression-system-spec.md](specifications/progression-system-spec.md) | Scenario unlock progression, difficulty tiers, and completion tracking. |

---

## Guides

| Document | Description |
|---|---|
| [guides/scenario-authoring-guide.md](guides/scenario-authoring-guide.md) | Step-by-step guide for creating, validating, testing, and committing new scenarios. Covers region design (all shapes), difficulty calibration, and common mistakes. |
| [guides/deployment-guide.md](guides/deployment-guide.md) | How to build and deploy the app to GitHub Pages, including environment setup and CI/CD. |

---

## Process

| Document | Description |
|---|---|
| [process/proposed-schema-extensions-and-roadmap.md](process/proposed-schema-extensions-and-roadmap.md) | Proposal for extending scenario semantics with optional metadata for tactical concepts, role context, pressure detail, curriculum structure, and authored feedback, plus a phased implementation roadmap. |
