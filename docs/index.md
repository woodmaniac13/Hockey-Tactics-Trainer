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
| [guides/llm-scenario-generation-guide.md](guides/llm-scenario-generation-guide.md) | Complete reference for LLM-assisted scenario generation: pitch coordinate system, entity placement, region design, field zones, pressure modelling, consequence frames, and common LLM pitfalls. Include this document as system context when prompting an LLM. |
| [guides/deployment-guide.md](guides/deployment-guide.md) | How to build and deploy the app to GitHub Pages, including environment setup and CI/CD. |

---

## LLM Scenario Generation

| Document | Description |
|---|---|
| [guides/llm-scenario-generation-guide.md](guides/llm-scenario-generation-guide.md) | Full prompt reference for LLM-assisted scenario authoring (pitch coordinates, entity placement, regions, lint rules, consequence frames). |
| [llm_scenario_generation/pass_a_system_prompt.md](llm_scenario_generation/pass_a_system_prompt.md) | Pass A system prompt template — instructs the model to generate the core scenario JSON. |
| [llm_scenario_generation/pass_a_user_template.md](llm_scenario_generation/pass_a_user_template.md) | Pass A user prompt template — injects the generation brief placeholders. |
| [llm_scenario_generation/pass_b_system_prompt.md](llm_scenario_generation/pass_b_system_prompt.md) | Pass B system prompt template — instructs the model to generate the consequence frame. |
| [llm_scenario_generation/pass_b_user_template.md](llm_scenario_generation/pass_b_user_template.md) | Pass B user prompt template — injects the accepted scenario JSON. |
| [llm_scenario_generation/repair_system_prompt.md](llm_scenario_generation/repair_system_prompt.md) | Repair system prompt template — instructs the model to fix validation failures. |
| [llm_scenario_generation/repair_user_template.md](llm_scenario_generation/repair_user_template.md) | Repair user prompt template — injects the broken JSON and issue list. |

**Pipeline code:** `src/llm/generateScenario.ts` orchestrates the two-pass pipeline. See also `src/llm/promptTypes.ts` for the `ScenarioGenerationBrief` type, `src/llm/validateGeneratedScenario.ts` for generated-content lint rules, and `src/scenarios/scenarioIntent.ts` for the coordinate-free ScenarioIntent format.

**CLI scripts:**
- `npx tsx scripts/generate-scenario-from-intent.ts <intent.json>` — convert a ScenarioIntent to a draft Scenario
- `npx tsx scripts/scenario-coverage-report.ts` — generate a coverage matrix of existing scenario content
- `npx tsx scripts/lint-scenarios.ts` — lint all scenarios in `public/scenarios/`

---

## Process

| Document | Description |
|---|---|
| [process/proposed-schema-extensions-and-roadmap.md](process/proposed-schema-extensions-and-roadmap.md) | Proposal for extending scenario semantics with optional metadata for tactical concepts, role context, pressure detail, curriculum structure, and authored feedback, plus a phased implementation roadmap. Phases 1–6 are complete (including the LLM generation pipeline and consequence frame system). |
