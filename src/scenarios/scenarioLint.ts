import type { Scenario, TacticalRegion, ScenarioArchetype, LineGroup, PrimaryConceptVocab } from '../types';
import { isSemanticRegion } from '../utils/regions';

/**
 * Canonical vocabulary of accepted entity role abbreviations.
 *
 * The Zod schema only requires roles to use uppercase alphanumeric characters.
 * This list defines the expected set for authored scenarios. The content lint
 * layer emits a warning when a role is absent from this list so that drift is
 * caught without breaking schema validation.
 *
 * Add new entries here if a legitimate role abbreviation is missing.
 */
export const CANONICAL_ROLES = [
  'GK',  // goalkeeper
  'CB',  // centre-back
  'RB',  // right-back
  'LB',  // left-back
  'MF',  // midfielder
  'DM',  // defensive midfielder
  'CM',  // central midfielder
  'AM',  // attacking midfielder
  'RW',  // right wing
  'LW',  // left wing
  'FW',  // forward / winger
  'CF',  // centre forward
  'SS',  // second striker
  'WG',  // winger (alternate abbreviation)
  'DF',  // defender (generic)
  'F',   // forward (abbreviated)
] as const;

export type CanonicalRole = (typeof CANONICAL_ROLES)[number];

// ── Archetype consistency constraints ─────────────────────────────────────────

type ArchetypeConstraint = {
  /** If set, the scenario phase must be one of these values. */
  allowed_phases?: Array<'attack' | 'defence' | 'transition'>;
  /** If set and `line_group` is present in the scenario, line_group must be one of these. */
  allowed_line_groups?: LineGroup[];
  /** If set and `primary_concept` is present in the scenario, primary_concept must be one of these. */
  allowed_primary_concepts?: PrimaryConceptVocab[];
};

/**
 * Consistency constraints for each scenario archetype.
 *
 * Constraints are only applied when the relevant field is also present in the
 * scenario. A missing `line_group` or `primary_concept` is caught separately
 * by the missing-field check; it does not trigger an archetype consistency error.
 *
 * These constraints exist to catch copy-paste errors and guide LLM generation.
 * They are designed to be broad enough to allow legitimate variation while
 * flagging clear mismatches (e.g. a forward archetype on a back player).
 */
export const ARCHETYPE_CONSTRAINTS: Record<ScenarioArchetype, ArchetypeConstraint> = {
  back_outlet_support: {
    // Midfield or back player providing an outlet option to the back line.
    // Applies in attack (including build-out under press).
    allowed_phases: ['attack'],
    allowed_primary_concepts: ['support', 'pressure_response'],
  },
  fullback_escape_option: {
    // A fullback creating an escape route under pressure.
    allowed_phases: ['attack'],
    allowed_line_groups: ['back'],
  },
  midfield_triangle_restore: {
    // Midfield player reconnecting the team's passing triangle.
    allowed_line_groups: ['midfield'],
    allowed_phases: ['attack', 'transition'],
    allowed_primary_concepts: ['support', 'transfer', 'spacing'],
  },
  interior_support_under_press: {
    // Interior player supporting the ball carrier under press.
    // Not restricted to a line group — could be back, mid, or forward.
    allowed_primary_concepts: ['support', 'pressure_response'],
  },
  forward_width_hold: {
    // Forward maintaining width to stretch the opposition.
    allowed_phases: ['attack'],
    allowed_line_groups: ['forward'],
    allowed_primary_concepts: ['width_depth', 'support'],
  },
  forward_press_angle: {
    // Forward positioning to apply a pressing angle.
    allowed_phases: ['attack'],
    allowed_line_groups: ['forward'],
    allowed_primary_concepts: ['pressing_angle', 'pressure_response'],
  },
  help_side_cover: {
    // Player on the help side covering a central channel.
    allowed_phases: ['defence'],
    allowed_primary_concepts: ['cover', 'spacing'],
  },
  central_recovery_cover: {
    // Central player recovering into a covering shape.
    allowed_phases: ['defence', 'transition'],
    allowed_primary_concepts: ['cover', 'recovery_shape'],
  },
  sideline_trap_support: {
    // Support player assisting a sideline trap structure.
    // No strict phase or line_group constraint — can apply to various lines.
    allowed_primary_concepts: ['pressing_angle', 'pressure_response', 'support', 'spacing'],
  },
  weak_side_balance: {
    // Weak-side player balancing the team shape.
    allowed_primary_concepts: ['width_depth', 'spacing', 'cover'],
  },
};

// ── LintResult type ───────────────────────────────────────────────────────────

export type LintResult = {
  /** Blocking findings — scenarios with errors must be corrected before authoring is complete. */
  errors: string[];
  /** Advisory findings — should be reviewed but do not block acceptance. */
  warnings: string[];
};

// ── Internal helpers ──────────────────────────────────────────────────────────

function isRawGeometry(region: TacticalRegion): boolean {
  return !isSemanticRegion(region);
}

// ── Main lint function ────────────────────────────────────────────────────────

/**
 * Validates the tactical content and semantic quality of a parsed scenario.
 *
 * This is a content-level check that runs after schema validation. It enforces
 * authoring conventions that the Zod schema cannot express — cross-field
 * consistency, completeness for LLM-generation quality, and region format
 * requirements.
 *
 * **Errors** are blocking: authored scenarios are not considered complete until
 * all errors are resolved.
 *
 * **Warnings** are advisory: they indicate missing optional fields that improve
 * authoring quality and LLM generation consistency, but do not prevent use.
 */
export function lintScenario(scenario: Scenario): LintResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const id = scenario.scenario_id;

  // ── Error checks ─────────────────────────────────────────────────────────

  // Required semantic fields for authored scenarios
  if (!scenario.line_group) {
    errors.push(`[${id}] Missing required semantic field: line_group`);
  }
  if (!scenario.primary_concept) {
    errors.push(`[${id}] Missing required semantic field: primary_concept`);
  }
  if (!scenario.situation) {
    errors.push(`[${id}] Missing required semantic field: situation`);
  }
  if (!scenario.teaching_point) {
    errors.push(`[${id}] Missing required semantic field: teaching_point`);
  }

  // Required feedback hints
  if (!scenario.feedback_hints?.success) {
    errors.push(`[${id}] Missing required feedback hint: feedback_hints.success`);
  }
  if (!scenario.feedback_hints?.common_error) {
    errors.push(`[${id}] Missing required feedback hint: feedback_hints.common_error`);
  }

  // All regions must use the semantic wrapper format — raw geometry is not
  // accepted in authored scenarios (it is valid only in tests/internal use).
  const allRegions = [...scenario.ideal_regions, ...scenario.acceptable_regions];
  const rawCount = allRegions.filter(isRawGeometry).length;
  if (rawCount > 0) {
    errors.push(
      `[${id}] ${rawCount} region(s) use raw geometry instead of a semantic wrapper — ` +
        `use { label?, purpose?, reference_frame?, geometry } format for authored regions`,
    );
  }

  // target_player must match exactly one teammate
  const teammateIds = new Set(scenario.teammates.map(t => t.id));
  if (!teammateIds.has(scenario.target_player)) {
    errors.push(
      `[${id}] target_player "${scenario.target_player}" not found in teammates`,
    );
  }

  // No duplicate entity IDs across teammates + opponents
  const allEntityIds = [...scenario.teammates, ...scenario.opponents].map(e => e.id);
  const seenIds = new Set<string>();
  const duplicateIds: string[] = [];
  for (const eid of allEntityIds) {
    if (seenIds.has(eid)) duplicateIds.push(eid);
    seenIds.add(eid);
  }
  if (duplicateIds.length > 0) {
    errors.push(`[${id}] Duplicate entity IDs: ${duplicateIds.join(', ')}`);
  }

  // Archetype consistency: cross-check against phase, line_group, primary_concept
  if (scenario.scenario_archetype) {
    const constraint = ARCHETYPE_CONSTRAINTS[scenario.scenario_archetype];

    if (
      constraint.allowed_phases &&
      !constraint.allowed_phases.includes(scenario.phase)
    ) {
      errors.push(
        `[${id}] scenario_archetype "${scenario.scenario_archetype}" requires phase ` +
          `to be one of [${constraint.allowed_phases.join(', ')}], but got "${scenario.phase}"`,
      );
    }

    if (
      constraint.allowed_line_groups &&
      scenario.line_group &&
      !constraint.allowed_line_groups.includes(scenario.line_group)
    ) {
      errors.push(
        `[${id}] scenario_archetype "${scenario.scenario_archetype}" requires line_group ` +
          `to be one of [${constraint.allowed_line_groups.join(', ')}], but got "${scenario.line_group}"`,
      );
    }

    if (
      constraint.allowed_primary_concepts &&
      scenario.primary_concept &&
      !constraint.allowed_primary_concepts.includes(scenario.primary_concept)
    ) {
      errors.push(
        `[${id}] scenario_archetype "${scenario.scenario_archetype}" requires primary_concept ` +
          `to be one of [${constraint.allowed_primary_concepts.join(', ')}], but got "${scenario.primary_concept}"`,
      );
    }
  }

  // ── Warning checks ────────────────────────────────────────────────────────

  // Entity roles not in canonical vocabulary
  const allEntities = [...scenario.teammates, ...scenario.opponents];
  const nonCanonical = allEntities.filter(
    e => !(CANONICAL_ROLES as readonly string[]).includes(e.role),
  );
  if (nonCanonical.length > 0) {
    warnings.push(
      `[${id}] Entity role(s) outside canonical vocabulary: ` +
        `${nonCanonical.map(e => `${e.id}:"${e.role}"`).join(', ')} — ` +
        `add to CANONICAL_ROLES in scenarioLint.ts if intentional`,
    );
  }

  // Recommended optional fields
  if (!scenario.feedback_hints?.teaching_emphasis) {
    warnings.push(
      `[${id}] feedback_hints.teaching_emphasis is not set — ` +
        `consider adding a coaching emphasis point shown after every attempt`,
    );
  }
  if (!scenario.target_role_family) {
    warnings.push(
      `[${id}] target_role_family is not set — ` +
        `helps with content filtering and LLM generation context`,
    );
  }
  if (!scenario.field_zone) {
    warnings.push(
      `[${id}] field_zone is not set — ` +
        `helps with content coverage analysis and scenario filtering`,
    );
  }
  if (!scenario.scenario_archetype) {
    warnings.push(
      `[${id}] scenario_archetype is not set — ` +
        `helps with authoring consistency and LLM generation prompts`,
    );
  }
  if (!scenario.secondary_concepts || scenario.secondary_concepts.length === 0) {
    warnings.push(
      `[${id}] secondary_concepts is not set — ` +
        `consider documenting additional tactical concepts covered by this scenario`,
    );
  }

  // forced_side suggested when pressure is high-intensity with a clear direction
  if (
    scenario.pressure.intensity === 'high' &&
    scenario.pressure.direction !== 'none' &&
    !scenario.pressure.forced_side
  ) {
    warnings.push(
      `[${id}] pressure.forced_side is not set despite high-intensity directional pressure — ` +
        `consider documenting which side the ball carrier is being forced toward`,
    );
  }

  // recommended_after suggested for scenarios beyond the first learning stage
  if (
    scenario.learning_stage !== undefined &&
    scenario.learning_stage > 1 &&
    !scenario.recommended_after
  ) {
    warnings.push(
      `[${id}] recommended_after is not set but learning_stage is ${scenario.learning_stage} — ` +
        `consider listing follow-up scenarios to guide progression`,
    );
  }

  return { errors, warnings };
}
