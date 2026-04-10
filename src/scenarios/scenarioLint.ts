import type { Scenario, TacticalRegion, ScenarioArchetype, LineGroup, PrimaryConceptVocab, FieldZone, ConsequenceType } from '../types';
import { isSemanticRegion } from '../utils/regions';
import {
  CANONICAL_POSITION_ANCHORS,
  NAMED_PITCH_ZONES,
  isPointInZoneX,
  FIELD_ZONE_BOUNDS,
  pitchDistance,
} from '../utils/pitchConstants';

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
  /**
   * If set and `field_zone` is present in the scenario, the zone should be in this list.
   * Violations produce a **warning** (not an error) — zones are advisory for archetypes.
   */
  allowed_field_zones?: FieldZone[];
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
    allowed_field_zones: [
      'defensive_third_left', 'defensive_third_central', 'defensive_third_right',
      'middle_third_left', 'middle_third_central', 'middle_third_right',
    ],
  },
  fullback_escape_option: {
    // A fullback creating an escape route under pressure.
    allowed_phases: ['attack'],
    allowed_line_groups: ['back'],
    allowed_field_zones: [
      'defensive_third_left', 'defensive_third_central', 'defensive_third_right',
      'middle_third_left', 'middle_third_central', 'middle_third_right',
    ],
  },
  midfield_triangle_restore: {
    // Midfield player reconnecting the team's passing triangle.
    allowed_line_groups: ['midfield'],
    allowed_phases: ['attack', 'transition'],
    allowed_primary_concepts: ['support', 'transfer', 'spacing'],
    allowed_field_zones: [
      'defensive_third_left', 'defensive_third_central', 'defensive_third_right',
      'middle_third_left', 'middle_third_central', 'middle_third_right',
      'attacking_third_left', 'attacking_third_central', 'attacking_third_right',
    ],
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
    allowed_field_zones: [
      'attacking_third_left', 'attacking_third_central', 'attacking_third_right',
      'circle_edge_left', 'circle_edge_central', 'circle_edge_right',
      'middle_third_left', 'middle_third_central', 'middle_third_right',
    ],
  },
  forward_press_angle: {
    // Forward positioning to apply a pressing angle.
    allowed_phases: ['attack'],
    allowed_line_groups: ['forward'],
    allowed_primary_concepts: ['pressing_angle', 'pressure_response'],
    allowed_field_zones: [
      'defensive_third_left', 'defensive_third_central', 'defensive_third_right',
      'middle_third_left', 'middle_third_central', 'middle_third_right',
    ],
  },
  help_side_cover: {
    // Player on the help side covering a central channel.
    allowed_phases: ['defence'],
    allowed_primary_concepts: ['cover', 'spacing'],
    allowed_field_zones: [
      'defensive_third_left', 'defensive_third_central', 'defensive_third_right',
      'middle_third_left', 'middle_third_central', 'middle_third_right',
      'attacking_third_left', 'attacking_third_central', 'attacking_third_right',
    ],
  },
  central_recovery_cover: {
    // Central player recovering into a covering shape.
    allowed_phases: ['defence', 'transition'],
    allowed_primary_concepts: ['cover', 'recovery_shape'],
    allowed_field_zones: [
      'defensive_third_left', 'defensive_third_central', 'defensive_third_right',
      'middle_third_left', 'middle_third_central', 'middle_third_right',
    ],
  },
  sideline_trap_support: {
    // Support player assisting a sideline trap structure.
    // No strict phase or line_group constraint — can apply to various lines.
    allowed_primary_concepts: ['pressing_angle', 'pressure_response', 'support', 'spacing'],
    allowed_field_zones: [
      'defensive_third_left', 'defensive_third_right',
      'middle_third_left', 'middle_third_right',
      'attacking_third_left', 'attacking_third_right',
    ],
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

  // Phase B: field_zone vs. ball x-axis position (which third)
  // Mismatched thirds are the most common LLM coordinate error and are flagged
  // as a blocking error. The y-axis channel check is advisory (warning) below.
  if (scenario.field_zone) {
    const { x: bx } = scenario.ball;
    if (!isPointInZoneX(bx, scenario.field_zone)) {
      errors.push(
        `[${id}] field_zone "${scenario.field_zone}" declares x-bounds ` +
          `[${FIELD_ZONE_BOUNDS[scenario.field_zone].xMin}–${FIELD_ZONE_BOUNDS[scenario.field_zone].xMax}] ` +
          `but ball is at x=${bx} — check that the declared zone matches the ball position`,
      );
    }
  }

  // Phase D: named_zone references in regions must be known keys in NAMED_PITCH_ZONES
  const unknownNamedZones: string[] = [];
  for (const region of allRegions) {
    if (isSemanticRegion(region) && region.named_zone && !(region.named_zone in NAMED_PITCH_ZONES)) {
      unknownNamedZones.push(region.named_zone);
    }
  }
  if (unknownNamedZones.length > 0) {
    errors.push(
      `[${id}] Region(s) reference unknown named_zone(s): ${unknownNamedZones.map(z => `"${z}"`).join(', ')} — ` +
        `add to NAMED_PITCH_ZONES in src/utils/pitchConstants.ts`,
    );
  }

  // ── Warning checks ─────────────────────────────────────────────────────────

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

  // Phase B: entity spread — warn if all teammates are unrealistically clustered
  if (scenario.teammates.length >= 3) {
    let maxDist = 0;
    for (let i = 0; i < scenario.teammates.length; i++) {
      for (let j = i + 1; j < scenario.teammates.length; j++) {
        const d = pitchDistance(scenario.teammates[i]!, scenario.teammates[j]!);
        if (d > maxDist) maxDist = d;
      }
    }
    if (maxDist < 15) {
      warnings.push(
        `[${id}] All teammates are within ${maxDist.toFixed(1)} units of each other — ` +
          `consider spreading the team across the pitch for a realistic tactical layout`,
      );
    }
  }

  // Phase B: opponent reachability — warn if no opponent is within 40 units of the ball
  if (scenario.opponents.length > 0 && scenario.pressure.direction !== 'none') {
    const minOppDist = Math.min(
      ...scenario.opponents.map(o => pitchDistance(o, scenario.ball)),
    );
    if (minOppDist > 40) {
      warnings.push(
        `[${id}] pressure direction is "${scenario.pressure.direction}" but no opponent ` +
          `is within 40 units of the ball (nearest: ${minOppDist.toFixed(1)} units) — ` +
          `consider moving a pressing opponent closer to the ball`,
      );
    }
  }

  // Phase C: position_hint deviation — warn when entity's hint anchor is > 15 units from actual (x, y)
  for (const entity of allEntities) {
    if (entity.position_hint) {
      const anchor = CANONICAL_POSITION_ANCHORS[entity.position_hint];
      if (!anchor) {
        warnings.push(
          `[${id}] Entity "${entity.id}" has position_hint "${entity.position_hint}" ` +
            `which is not in CANONICAL_POSITION_ANCHORS — ` +
            `check the hint name or add it to src/utils/pitchConstants.ts`,
        );
      } else {
        const deviation = pitchDistance(entity, anchor);
        if (deviation > 15) {
          warnings.push(
            `[${id}] Entity "${entity.id}" position_hint "${entity.position_hint}" ` +
              `implies approximately (x:${anchor.x}, y:${anchor.y}) ` +
              `but entity is at (x:${entity.x}, y:${entity.y}) — ` +
              `deviation ${deviation.toFixed(1)} units exceeds the 15-unit threshold`,
          );
        }
      }
    }
  }

  // Phase B: archetype vs. field_zone cross-check (advisory)
  if (scenario.scenario_archetype && scenario.field_zone) {
    const constraint = ARCHETYPE_CONSTRAINTS[scenario.scenario_archetype];
    if (
      constraint.allowed_field_zones &&
      !constraint.allowed_field_zones.includes(scenario.field_zone)
    ) {
      warnings.push(
        `[${id}] scenario_archetype "${scenario.scenario_archetype}" typically appears in ` +
          `[${constraint.allowed_field_zones.join(', ')}] ` +
          `but field_zone is "${scenario.field_zone}" — ` +
          `verify this is intentional`,
      );
    }
  }

  // Phase E: ball-relative region usage nudge for build-out and counter-attack situations
  const relativeSituations = new Set<string>(['build_out_under_press', 'counter_attack']);
  if (scenario.situation && relativeSituations.has(scenario.situation)) {
    const semanticRegions = allRegions.filter(isSemanticRegion);
    const hasRelativeFrame = semanticRegions.some(
      r => r.reference_frame === 'ball' || r.reference_frame === 'target_player' || r.reference_frame === 'entity',
    );
    if (semanticRegions.length > 0 && !hasRelativeFrame) {
      warnings.push(
        `[${id}] situation "${scenario.situation}" uses only reference_frame:"pitch" regions — ` +
          `consider using reference_frame:"ball" or "target_player" for regions whose position ` +
          `is most naturally described relative to the ball carrier`,
      );
    }
  }

  // Phase H: entity_relationship geometric consistency checks
  if (scenario.entity_relationships && scenario.entity_relationships.length > 0) {
    const entityMap = new Map(
      [...scenario.teammates, ...scenario.opponents].map(e => [e.id, e]),
    );
    for (const rel of scenario.entity_relationships) {
      const entity = entityMap.get(rel.entity_id);
      if (!entity) {
        warnings.push(
          `[${id}] entity_relationship references unknown entity_id "${rel.entity_id}"`,
        );
        continue;
      }
      const refPos =
        rel.relative_to === 'ball'
          ? scenario.ball
          : entityMap.get(rel.relative_to);
      if (!refPos) {
        warnings.push(
          `[${id}] entity_relationship for "${rel.entity_id}" references unknown relative_to "${rel.relative_to}"`,
        );
        continue;
      }
      // goal_side_of: entity must have lower x than the reference (closer to own goal)
      if (rel.relationship === 'goal_side_of' && entity.x > refPos.x) {
        warnings.push(
          `[${id}] entity_relationship declares "${rel.entity_id}" is goal_side_of ` +
            `"${rel.relative_to}" but entity x=${entity.x} is ahead of reference x=${refPos.x} — ` +
            `goal_side positioning requires a lower x value`,
        );
      }
      // supporting_behind: entity must have lower x than the reference
      if (rel.relationship === 'supporting_behind' && entity.x >= refPos.x) {
        warnings.push(
          `[${id}] entity_relationship declares "${rel.entity_id}" is supporting_behind ` +
            `"${rel.relative_to}" but entity x=${entity.x} is not behind reference x=${refPos.x}`,
        );
      }
    }
  }

  // ── Consequence frame checks ──────────────────────────────────────────────

  if (scenario.consequence_frame) {
    // Build a set of valid entity IDs for cross-referencing arrow/shift/pass_option targets.
    // 'ball' is accepted as a pseudo-entity for arrow endpoints.
    const knownEntityIds = new Set(
      [...scenario.teammates, ...scenario.opponents].map(e => e.id),
    );
    knownEntityIds.add('ball');

    /**
     * Validate a single OutcomePreview branch (on_success or on_failure).
     * Populates `errors` and `warnings` from the outer closure.
     */
    const checkOutcome = (
      outcome: NonNullable<typeof scenario.consequence_frame>['on_success'],
      branch: 'on_success' | 'on_failure',
    ): void => {
      if (!outcome) return;

      // explanation length warning (verbose LLM output)
      if (outcome.explanation.length > 200) {
        warnings.push(
          `[${id}] consequence_frame.${branch}.explanation exceeds 200 characters ` +
            `(${outcome.explanation.length} chars) — keep consequence explanations concise`,
        );
      }

      // arrows: max 3, entity ID cross-check
      if (outcome.arrows) {
        if (outcome.arrows.length > 3) {
          warnings.push(
            `[${id}] consequence_frame.${branch}.arrows has ${outcome.arrows.length} entries — ` +
              `limit to 3 arrows to avoid board clutter`,
          );
        }
        for (const arrow of outcome.arrows) {
          if (arrow.from_entity_id && !knownEntityIds.has(arrow.from_entity_id)) {
            errors.push(
              `[${id}] consequence_frame.${branch}.arrows references unknown entity ` +
                `"${arrow.from_entity_id}" in from_entity_id`,
            );
          }
          if (arrow.to_entity_id && !knownEntityIds.has(arrow.to_entity_id)) {
            errors.push(
              `[${id}] consequence_frame.${branch}.arrows references unknown entity ` +
                `"${arrow.to_entity_id}" in to_entity_id`,
            );
          }
        }
      }

      // entity_shifts: max 2, entity ID cross-check
      if (outcome.entity_shifts) {
        if (outcome.entity_shifts.length > 2) {
          warnings.push(
            `[${id}] consequence_frame.${branch}.entity_shifts has ` +
              `${outcome.entity_shifts.length} entries — ` +
              `limit to 2 shifts to avoid over-simulation`,
          );
        }
        for (const shift of outcome.entity_shifts) {
          if (!knownEntityIds.has(shift.entity_id)) {
            errors.push(
              `[${id}] consequence_frame.${branch}.entity_shifts references unknown ` +
                `entity "${shift.entity_id}"`,
            );
          }
        }
      }

      // pass_option_states: entity ID cross-check
      if (outcome.pass_option_states) {
        for (const pos of outcome.pass_option_states) {
          if (!knownEntityIds.has(pos.from_entity_id)) {
            errors.push(
              `[${id}] consequence_frame.${branch}.pass_option_states references ` +
                `unknown entity "${pos.from_entity_id}" in from_entity_id`,
            );
          }
          if (!knownEntityIds.has(pos.to_entity_id)) {
            errors.push(
              `[${id}] consequence_frame.${branch}.pass_option_states references ` +
                `unknown entity "${pos.to_entity_id}" in to_entity_id`,
            );
          }
        }
      }
    };

    checkOutcome(scenario.consequence_frame.on_success, 'on_success');
    checkOutcome(scenario.consequence_frame.on_failure, 'on_failure');

    // on_success with a negative consequence_type is likely a copy-paste error.
    // These types describe outcomes where the defensive/neutral situation persists
    // or worsens — they belong on the on_failure branch, not on_success.
    const NEGATIVE_OUTCOME_TYPES: ReadonlySet<ConsequenceType> = new Set([
      'pass_blocked',
      'pressure_maintained',
      'shape_broken',
      'cover_lost',
      'lane_closed',
      'triangle_broken',
      'width_lost',
    ]);

    if (
      scenario.consequence_frame.on_success &&
      NEGATIVE_OUTCOME_TYPES.has(scenario.consequence_frame.on_success.consequence_type)
    ) {
      warnings.push(
        `[${id}] consequence_frame.on_success.consequence_type is ` +
          `"${scenario.consequence_frame.on_success.consequence_type}" — ` +
          `this is a negative outcome type; verify it is correct for the success branch`,
      );
    }

    // on_success with pressure_result: maintained is suspicious
    if (scenario.consequence_frame.on_success?.pressure_result === 'maintained') {
      warnings.push(
        `[${id}] consequence_frame.on_success.pressure_result is "maintained" — ` +
          `this suggests pressure was not broken by the correct move; verify this is intentional`,
      );
    }
  }

  return { errors, warnings };
}
