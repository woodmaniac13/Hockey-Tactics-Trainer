/**
 * LLM scenario generation — typed input brief and pipeline state types.
 *
 * A `ScenarioGenerationBrief` is the typed input supplied by a user or script
 * to initiate the two-pass generation pipeline. It is injected into Pass A
 * prompt templates to constrain the generated scenario.
 *
 * The pipeline is two-pass:
 *   Pass A — generate core scenario JSON (no consequence_frame).
 *   Pass B — generate consequence_frame from the accepted Pass A scenario.
 *
 * If validation or linting fails after either pass, a repair loop is invoked.
 */

import type {
  ScenarioArchetype,
  FieldZone,
  LineGroup,
  TargetRoleFamily,
  PrimaryConceptVocab,
  Scenario,
  ConsequenceFrame,
} from '../types';

/** Typed input that drives the two-pass LLM generation pipeline. */
export type ScenarioGenerationBrief = {
  /** Archetype that constrains phase, line_group, and allowed concepts. */
  scenario_archetype: ScenarioArchetype;
  /** Phase of play this scenario takes place in. */
  phase: 'attack' | 'defence' | 'transition';
  /** Target difficulty on a 1–5 scale. */
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** Primary field zone where the scenario takes place. */
  field_zone: FieldZone;
  /** Line group the scenario targets (back/midfield/forward). */
  line_group: LineGroup;
  /** Role family of the target player. */
  target_role_family: TargetRoleFamily;
  /** Primary tactical concept being taught. */
  primary_concept: PrimaryConceptVocab;
  /** Additional tactical concepts covered by the scenario. */
  secondary_concepts?: PrimaryConceptVocab[];
  /** Learning stage within the curriculum group (small integer ≥ 1). */
  learning_stage?: number;
  /** Named curriculum group this scenario belongs to. */
  curriculum_group?: string;
  /**
   * Optional natural-language seed for the title.
   * The model should use this as a starting point for the scenario title.
   */
  title_seed?: string;
};

/** Repair mode — whether the repair pass is fixing a full scenario or a consequence frame. */
export type RepairMode = 'scenario' | 'consequence_frame';

/** Options for controlling the generation pipeline behaviour. */
export type GenerationOptions = {
  /**
   * Maximum number of repair loop attempts before the pipeline gives up.
   * Defaults to 2.
   */
  maxRepairAttempts?: number;
};

/**
 * Mutable state object tracked throughout the two-pass generation pipeline.
 *
 * Callers may inspect intermediate state for debugging or logging.
 */
export type GenerationPipelineState = {
  brief: ScenarioGenerationBrief;
  /** Raw string returned by the model after Pass A (before parsing). */
  passARawOutput: string | null;
  /** Accepted Pass A scenario (validated and linted). Null until accepted. */
  acceptedScenario: Scenario | null;
  /** Raw string returned by the model after Pass B (before parsing). */
  passBRawOutput: string | null;
  /** Accepted consequence frame (validated and linted). Null until accepted. */
  acceptedConsequenceFrame: ConsequenceFrame | null;
  /** Final merged scenario. Null until both passes are accepted. */
  finalScenario: Scenario | null;
  /** All schema/lint errors encountered across passes and repair attempts. */
  errors: string[];
  /** All lint warnings encountered across passes and repair attempts. */
  warnings: string[];
  /** Total number of repair attempts made across all passes. */
  repairAttempts: number;
};

/**
 * Function signature for a model call.
 *
 * The pipeline does not call any model directly — callers supply this function
 * when invoking `runGenerationPipeline()`. This decouples the pipeline from
 * any specific model provider and makes it easy to unit-test with mock functions.
 *
 * @param systemPrompt - The system prompt string to send to the model.
 * @param userPrompt   - The user prompt string to send to the model.
 * @returns The model's text response (expected to be a JSON string).
 */
export type ModelCallFn = (systemPrompt: string, userPrompt: string) => Promise<string>;
