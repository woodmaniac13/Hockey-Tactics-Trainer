/**
 * Generated-content validation — stricter validation mode for LLM-generated scenarios.
 *
 * Standard validation pipeline:
 *   1. `ScenarioSchema.safeParse()` — structural and type validation (Zod).
 *   2. `lintScenario()` — content consistency and tactical coherence checks.
 *   3. `lintGeneratedScenario()` (this module) — additional strictness for generated content.
 *
 * Generated scenarios are held to a stricter standard than hand-authored scenarios
 * because they may omit optional-but-strongly-expected fields or produce trivial
 * consequence branches that add no board value.
 *
 * All generated-content issues are returned as structured errors and warnings
 * rather than thrown exceptions, so the repair loop can consume them.
 */

import type { Scenario, OutcomePreview } from '../types';

export type GeneratedLintResult = {
  /** Blocking issues — the scenario must be repaired before it can be accepted. */
  errors: string[];
  /** Advisory issues — the scenario is usable but should be improved. */
  warnings: string[];
};

// ── Consequence type polarity ─────────────────────────────────────────────────

/** Consequence types that are semantically negative (failure outcomes). */
const NEGATIVE_CONSEQUENCE_TYPES = new Set([
  'pass_blocked',
  'pressure_maintained',
  'shape_broken',
  'cover_lost',
  'lane_closed',
  'triangle_broken',
  'width_lost',
]);

/** Consequence types that are semantically positive (success outcomes). */
const POSITIVE_CONSEQUENCE_TYPES = new Set([
  'pass_opened',
  'pressure_broken',
  'shape_restored',
  'cover_gained',
  'lane_opened',
  'triangle_formed',
  'width_gained',
  'depth_created',
]);

// ── Overly generic explanation phrases ───────────────────────────────────────

/**
 * Fragments that indicate an unhelpfully generic consequence explanation.
 * Matched case-insensitively.
 */
const GENERIC_EXPLANATION_FRAGMENTS = [
  'good position',
  'well positioned',
  'correct position',
  'wrong position',
  'bad position',
  'moves to a better',
  'moves to a good',
];

function isGenericExplanation(explanation: string): boolean {
  const lower = explanation.toLowerCase();
  return GENERIC_EXPLANATION_FRAGMENTS.some(fragment => lower.includes(fragment));
}

// ── Visual primitive presence check ──────────────────────────────────────────

/**
 * Returns true if the outcome preview contains at least one visual board primitive.
 * Generated consequence branches must not be annotation-only (consequence_type + explanation).
 */
function hasBoardPrimitive(outcome: OutcomePreview): boolean {
  return !!(
    (outcome.arrows && outcome.arrows.length > 0) ||
    (outcome.entity_shifts && outcome.entity_shifts.length > 0) ||
    (outcome.pass_option_states && outcome.pass_option_states.length > 0) ||
    outcome.lane_highlight ||
    outcome.pressure_result ||
    outcome.shape_result
  );
}

// ── Board clutter check ───────────────────────────────────────────────────────

/** Heuristic total primitive count (arrows + shifts + pass states) that risks cluttering the board. */
const BOARD_CLUTTER_TOTAL_THRESHOLD = 5;

function isBoardCluttered(outcome: OutcomePreview): boolean {
  const arrowCount = outcome.arrows?.length ?? 0;
  const shiftCount = outcome.entity_shifts?.length ?? 0;
  const passCount = outcome.pass_option_states?.length ?? 0;
  return arrowCount + shiftCount + passCount > BOARD_CLUTTER_TOTAL_THRESHOLD;
}

// ── Main generated-content lint function ─────────────────────────────────────

/** Options for `lintGeneratedScenario`. */
export type GeneratedLintOptions = {
  /**
   * Whether to require `consequence_frame` as an error when absent.
   *
   * Set to `false` when validating a Pass A output (before Pass B has generated
   * the consequence frame). Set to `true` (or leave at default) when validating
   * the final merged scenario.
   *
   * Defaults to `true`.
   */
  requireConsequenceFrame?: boolean;
};

/**
 * Applies stricter validation rules to a generated scenario.
 *
 * This function supplements `lintScenario()` — it should be called after the
 * standard schema parse and content lint have both passed without blocking errors.
 *
 * @param scenario - A structurally valid scenario (Zod parse must have succeeded).
 * @param options  - Controls which generated-content rules are enforced.
 * @returns `{ errors, warnings }` specific to generated-content requirements.
 */
export function lintGeneratedScenario(
  scenario: Scenario,
  options: GeneratedLintOptions = {},
): GeneratedLintResult {
  const { requireConsequenceFrame = true } = options;
  const errors: string[] = [];
  const warnings: string[] = [];
  const id = scenario.scenario_id;

  // ── Required fields for generated scenarios (treated as errors) ──────────

  if (!scenario.scenario_archetype) {
    errors.push(`[${id}] Generated scenario must include scenario_archetype`);
  }

  if (!scenario.field_zone) {
    errors.push(`[${id}] Generated scenario must include field_zone`);
  }

  if (!scenario.target_role_family) {
    errors.push(`[${id}] Generated scenario must include target_role_family`);
  }

  if (!scenario.consequence_frame && requireConsequenceFrame) {
    errors.push(
      `[${id}] Generated scenario must include consequence_frame — ` +
        `run Pass B to generate it before accepting`,
    );
  }

  // ── Feedback hint bullet arrays (required for generated content) ──────────

  const hints = scenario.feedback_hints;
  if (!hints?.success_points || hints.success_points.length === 0) {
    errors.push(
      `[${id}] Generated scenario must include feedback_hints.success_points ` +
        `(≥1 scenario-specific coaching bullet for IDEAL/VALID outcomes)`,
    );
  }

  if (!hints?.error_points || hints.error_points.length === 0) {
    errors.push(
      `[${id}] Generated scenario must include feedback_hints.error_points ` +
        `(≥1 scenario-specific coaching bullet for PARTIAL/INVALID outcomes)`,
    );
  }

  if (!hints?.alternate_points || hints.alternate_points.length === 0) {
    warnings.push(
      `[${id}] Generated scenario should include feedback_hints.alternate_points ` +
        `(coaching bullets for ALTERNATE_VALID outcomes)`,
    );
  }

  // ── Strongly expected fields (treated as warnings for generated content) ─

  if (!scenario.correct_reasoning || scenario.correct_reasoning.length === 0) {
    warnings.push(
      `[${id}] Generated scenario should include correct_reasoning — ` +
        `the evaluator falls back to tag-driven heuristics without it`,
    );
  }

  if (!scenario.secondary_concepts || scenario.secondary_concepts.length === 0) {
    warnings.push(
      `[${id}] Generated scenario should include secondary_concepts — ` +
        `helps with curriculum coverage analysis and filtering`,
    );
  }

  // ── Consequence frame checks ───────────────────────────────────────────────

  if (scenario.consequence_frame) {
    const { on_success, on_failure } = scenario.consequence_frame;

    // Each branch present must contain at least one board-visible primitive.
    if (on_success && !hasBoardPrimitive(on_success)) {
      errors.push(
        `[${id}] consequence_frame.on_success must contain at least one visual primitive ` +
          `(arrows, entity_shifts, pass_option_states, lane_highlight, pressure_result, or shape_result)`,
      );
    }

    if (on_failure && !hasBoardPrimitive(on_failure)) {
      errors.push(
        `[${id}] consequence_frame.on_failure must contain at least one visual primitive ` +
          `(arrows, entity_shifts, pass_option_states, lane_highlight, pressure_result, or shape_result)`,
      );
    }

    // Success branch with a negative consequence type is likely wrong.
    if (on_success && NEGATIVE_CONSEQUENCE_TYPES.has(on_success.consequence_type)) {
      warnings.push(
        `[${id}] consequence_frame.on_success.consequence_type is ` +
          `"${on_success.consequence_type}" which is a negative outcome type — ` +
          `verify this is correct for the success branch`,
      );
    }

    // Failure branch with a positive consequence type is likely wrong.
    if (on_failure && POSITIVE_CONSEQUENCE_TYPES.has(on_failure.consequence_type)) {
      warnings.push(
        `[${id}] consequence_frame.on_failure.consequence_type is ` +
          `"${on_failure.consequence_type}" which is a positive outcome type — ` +
          `verify this is correct for the failure branch`,
      );
    }

    // Overly generic explanations.
    if (on_success && isGenericExplanation(on_success.explanation)) {
      warnings.push(
        `[${id}] consequence_frame.on_success.explanation appears generic — ` +
          `replace with a specific tactical coaching sentence tied to this scenario`,
      );
    }

    if (on_failure && isGenericExplanation(on_failure.explanation)) {
      warnings.push(
        `[${id}] consequence_frame.on_failure.explanation appears generic — ` +
          `replace with a specific tactical coaching sentence tied to this scenario`,
      );
    }

    // Board clutter risk.
    if (on_success && isBoardCluttered(on_success)) {
      warnings.push(
        `[${id}] consequence_frame.on_success has too many visual primitives — ` +
          `reduce arrows, entity_shifts, and pass_option_states to avoid board clutter`,
      );
    }

    if (on_failure && isBoardCluttered(on_failure)) {
      warnings.push(
        `[${id}] consequence_frame.on_failure has too many visual primitives — ` +
          `reduce arrows, entity_shifts, and pass_option_states to avoid board clutter`,
      );
    }
  }

  return { errors, warnings };
}
