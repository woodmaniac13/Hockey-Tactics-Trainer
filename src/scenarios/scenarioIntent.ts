/**
 * ScenarioIntent — LLM-friendly pre-schema for semantic scenario authoring.
 *
 * The `ScenarioIntent` type is a lightweight input format that lets an LLM
 * describe a scenario entirely in symbolic/semantic terms — **no coordinates
 * required**. The `intentToScenario()` function then resolves the intent into
 * a draft `Scenario` with real coordinates by looking up `position_hint`
 * anchors and `named_zone` geometries from `src/utils/pitchConstants.ts`.
 *
 * ## Workflow
 *
 * 1. LLM generates a `ScenarioIntent` JSON (no x/y values needed).
 * 2. Run `npx tsx scripts/generate-scenario-from-intent.ts <intent.json>`.
 * 3. The script outputs a draft `Scenario` JSON with resolved coordinates.
 * 4. Run `npx tsx scripts/lint-scenarios.ts` and fix any warnings.
 * 5. Review/adjust the draft and add it to `public/scenarios/`.
 *
 * ## Key differences from full Scenario schema
 *
 * - Entities have `position_hint` instead of raw `x`, `y`.
 * - Regions have `named_zone` or `offset_hint` instead of raw geometry.
 * - No `scenario_id`, `version`, `weight_profile`, etc. — boilerplate filled
 *   by `intentToScenario()`.
 */

import { z } from 'zod';
import {
  LineGroupSchema,
  PrimaryConceptSchema,
  SituationSchema,
  FieldZoneSchema,
  GameStateSchema,
  ScenarioArchetypeSchema,
  FeedbackHintsSchema,
  SemanticRegionPurposeSchema,
  PressureDirectionSchema,
  PressureIntensitySchema,
  PressureForcedSideSchema,
  ConsequenceFrameSchema,
} from './scenarioSchema';
import type { Scenario, Entity, SemanticRegion } from '../types';
import {
  CANONICAL_POSITION_ANCHORS,
  NAMED_PITCH_ZONES,
} from '../utils/pitchConstants';

// ── ScenarioIntent Zod schemas ────────────────────────────────────────────────

/** An entity described by role and semantic position rather than raw coordinates. */
export const IntentEntitySchema = z.object({
  id: z.string(),
  role: z.string().regex(/^[A-Z0-9_]+$/),
  team: z.enum(['home', 'away']),
  /** Key from CANONICAL_POSITION_ANCHORS in src/utils/pitchConstants.ts. */
  position_hint: z.string(),
  is_target: z.boolean().optional(),
  is_ball_carrier: z.boolean().optional(),
}).strict();

/** A region described by named zone or relative offset rather than raw geometry. */
export const IntentRegionSchema = z.object({
  label: z.string(),
  purpose: SemanticRegionPurposeSchema,
  /**
   * Key from NAMED_PITCH_ZONES. When provided, geometry is resolved
   * from the named-zone lookup. Takes precedence over offset_hint.
   */
  named_zone: z.string().optional(),
  /**
   * Reference frame for relative placement. Accepts:
   *   "ball", "target_player", an entity id, or "pitch" (absolute).
   * Defaults to "pitch".
   */
  reference: z.string().optional(),
  /**
   * Directional offset hint for ball/entity-relative regions.
   * Describes the tactical offset in natural language.
   * Used as documentation — intentToScenario() still requires named_zone
   * or a default fallback region for actual geometry.
   *
   * Examples: "inside_left", "forward_right", "diagonal_back_left"
   */
  offset_hint: z.string().optional(),
  notes: z.string().optional(),
}).strict().superRefine((region, ctx) => {
  if (!region.named_zone && !region.offset_hint) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['named_zone'],
      message: 'Intent region must have either "named_zone" or "offset_hint"',
    });
  }
});

/** Pressure described purely by semantics — no coordinates needed. */
export const IntentPressureSchema = z.object({
  direction: PressureDirectionSchema,
  intensity: PressureIntensitySchema,
  forced_side: PressureForcedSideSchema.optional(),
  blocked_lane: z.string().optional(),
  trap_zone: z.string().optional(),
}).strict();

/**
 * LLM-authored scenario intent — semantic description before coordinate resolution.
 *
 * Fill in all semantic metadata first; `intentToScenario()` handles coordinates.
 */
export const ScenarioIntentSchema = z.object({
  // ── Required semantic identity ─────────────────────────────────────────────
  /** Human-readable working title (will become scenario title in draft). */
  title: z.string(),
  /** Short description of the scenario for the player. */
  description: z.string(),
  /** Scenario archetype — determines allowed field zones, concepts, etc. */
  scenario_archetype: ScenarioArchetypeSchema,
  /** Phase of play. */
  phase: z.enum(['attack', 'defence', 'transition']),
  /** Line group the scenario targets. */
  line_group: LineGroupSchema,
  /** Primary tactical concept. */
  primary_concept: PrimaryConceptSchema,
  /** Tactical situation context. */
  situation: SituationSchema,
  /** Primary field zone. */
  field_zone: FieldZoneSchema,
  /** Game state. */
  game_state: GameStateSchema,
  /** Difficulty 1–5. */
  difficulty: z.number().int().min(1).max(5),
  /** Short coaching point describing the ideal outcome. */
  teaching_point: z.string(),
  /** Coaching language hooks for feedback. */
  feedback_hints: FeedbackHintsSchema,
  /** Reasoning options that are tactically correct. */
  correct_reasoning: z.array(z.enum([
    'create_passing_angle',
    'provide_cover',
    'enable_switch',
    'support_under_pressure',
    'maintain_width',
    'restore_shape',
    'break_pressure',
    'occupy_depth',
  ])).optional(),

  // ── Symbolic player layout ─────────────────────────────────────────────────
  /**
   * Entities including the target player.
   * Each entity must have a `position_hint` key from CANONICAL_POSITION_ANCHORS.
   * Mark exactly one entity with `is_target: true` to designate the target player.
   * Optionally mark one entity with `is_ball_carrier: true`; if absent, the
   * ball is placed at the ball-carrier entity's anchor (or field_zone centroid).
   */
  entities: z.array(IntentEntitySchema).min(2),

  // ── Symbolic region descriptions ───────────────────────────────────────────
  /**
   * Ideal regions (target player should be here for full score).
   * Use named_zone for well-known positions; offset_hint for relative descriptions.
   */
  ideal_zones: z.array(IntentRegionSchema).min(1),
  /**
   * Acceptable regions (partial score if target player is here).
   */
  acceptable_zones: z.array(IntentRegionSchema).optional(),

  // ── Pressure semantics ─────────────────────────────────────────────────────
  pressure: IntentPressureSchema,

  // ── Optional curriculum metadata ──────────────────────────────────────────
  curriculum_group: z.string().optional(),
  learning_stage: z.number().int().positive().optional(),
  secondary_concepts: z.array(PrimaryConceptSchema).optional(),
  target_role_family: z.enum(['back', 'midfield', 'forward']).optional(),

  // ── Optional consequence frame ─────────────────────────────────────────────
  /**
   * Authored one-step tactical consequence shown on the board after submission.
   * Same structure as `ConsequenceFrame` in the full Scenario schema — entity IDs
   * referenced in `arrows` and `entity_shifts` must match the `entities` array above.
   * The converter copies this field verbatim into the output Scenario.
   */
  consequence_frame: ConsequenceFrameSchema.optional(),
}).strict();

// ── TypeScript types ──────────────────────────────────────────────────────────

export type IntentEntity = z.infer<typeof IntentEntitySchema>;
export type IntentRegion = z.infer<typeof IntentRegionSchema>;
export type IntentPressure = z.infer<typeof IntentPressureSchema>;
export type ScenarioIntent = z.infer<typeof ScenarioIntentSchema>;

// ── Intent-to-Scenario converter ─────────────────────────────────────────────

/**
 * Resolves a ScenarioIntent into a draft Scenario with real coordinates.
 *
 * Resolution logic:
 *   - Entity coordinates: looked up from CANONICAL_POSITION_ANCHORS by position_hint.
 *   - Region geometry: looked up from NAMED_PITCH_ZONES by named_zone.
 *     Regions with only offset_hint and no named_zone receive a default 10-unit
 *     circle at the target player's resolved position as a placeholder.
 *   - Ball position: set to the ball_carrier entity's coordinates, or the first
 *     non-GK entity's position if no ball_carrier is marked.
 *   - Boilerplate: version=1, team_orientation, weight_profile defaults filled in.
 *
 * @throws Error if the target player entity cannot be found in the intent.
 * @throws Error if any position_hint is not in CANONICAL_POSITION_ANCHORS.
 */
export function intentToScenario(
  intent: ScenarioIntent,
  options?: {
    /** Override the auto-generated scenario_id. Defaults to "DRAFT_<title-slug>". */
    scenario_id?: string;
    /** Weight profile to use. Defaults to mapping based on phase. */
    weight_profile?: string;
  },
): Scenario {
  // ── Resolve entity coordinates ───────────────────────────────────────────
  const targetEntity = intent.entities.find(e => e.is_target);
  if (!targetEntity) {
    throw new Error(
      `ScenarioIntent "${intent.title}": no entity has is_target=true — ` +
        `mark the player being trained with is_target: true`,
    );
  }

  const resolvedEntities: Array<Entity & { _isBallCarrier?: boolean }> = intent.entities.map(e => {
    const anchor = CANONICAL_POSITION_ANCHORS[e.position_hint];
    if (!anchor) {
      throw new Error(
        `ScenarioIntent "${intent.title}": entity "${e.id}" has unknown position_hint ` +
          `"${e.position_hint}" — add to CANONICAL_POSITION_ANCHORS in pitchConstants.ts`,
      );
    }
    return {
      id: e.id,
      role: e.role,
      team: e.team,
      x: anchor.x,
      y: anchor.y,
      position_hint: e.position_hint,
      _isBallCarrier: e.is_ball_carrier,
    };
  });

  // ── Resolve ball position ────────────────────────────────────────────────
  const ballCarrier =
    resolvedEntities.find(e => e._isBallCarrier) ??
    resolvedEntities.find(e => e.team === 'home' && e.role !== 'GK') ??
    resolvedEntities[0]!;

  const ball = { x: ballCarrier.x, y: ballCarrier.y };

  // ── Separate teammates and opponents ─────────────────────────────────────
  const teammates: Entity[] = resolvedEntities
    .filter(e => e.team === 'home')
    .map(({ _isBallCarrier: _, ...e }) => e);

  const opponents: Entity[] = resolvedEntities
    .filter(e => e.team === 'away')
    .map(({ _isBallCarrier: _, ...e }) => e);

  // ── Resolve region geometries ────────────────────────────────────────────
  function resolveIntentRegions(zones: typeof intent.ideal_zones): SemanticRegion[] {
    return zones.map(zone => {
      const referenceFrame = zone.reference === 'ball' ? 'ball'
        : zone.reference === 'target_player' ? 'target_player'
        : zone.reference === 'pitch' || !zone.reference ? 'pitch'
        : 'entity';

      const referenceEntityId =
        referenceFrame === 'entity' && zone.reference !== 'ball' && zone.reference !== 'target_player'
          ? zone.reference
          : undefined;

      if (zone.named_zone) {
        const namedGeo = NAMED_PITCH_ZONES[zone.named_zone];
        if (namedGeo) {
          return {
            label: zone.label,
            purpose: zone.purpose,
            reference_frame: referenceFrame === 'pitch' ? undefined : referenceFrame,
            reference_entity_id: referenceEntityId,
            named_zone: zone.named_zone,
            notes: zone.notes ?? (zone.offset_hint ? `Offset hint: ${zone.offset_hint}` : undefined),
          } satisfies SemanticRegion;
        }
      }

      // Fallback: placeholder 10-unit circle at the target player's anchor
      const targetAnchor = CANONICAL_POSITION_ANCHORS[targetEntity!.position_hint] ?? { x: 50, y: 50 };
      return {
        label: zone.label,
        purpose: zone.purpose,
        reference_frame: referenceFrame === 'pitch' ? undefined : referenceFrame,
        reference_entity_id: referenceEntityId,
        notes: zone.notes ?? `PLACEHOLDER — offset_hint: "${zone.offset_hint ?? 'not specified'}". Replace with actual geometry.`,
        geometry: { type: 'circle', x: targetAnchor.x, y: targetAnchor.y, r: 10 },
      } satisfies SemanticRegion;
    });
  }

  const idealRegions = resolveIntentRegions(intent.ideal_zones);
  const acceptableRegions = resolveIntentRegions(intent.acceptable_zones ?? []);

  // ── Build scenario_id ────────────────────────────────────────────────────
  const scenarioId =
    options?.scenario_id ??
    `DRAFT_${intent.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`;

  // ── Default weight profile by phase ─────────────────────────────────────
  const defaultWeightProfiles: Record<string, string> = {
    attack: 'attack_v1',
    defence: 'defence_v1',
    transition: 'transition_v1',
  };
  const weightProfile =
    options?.weight_profile ?? defaultWeightProfiles[intent.phase] ?? 'default_v1';

  // ── Derive tags from concept/situation ──────────────────────────────────
  const tags = [
    intent.primary_concept,
    intent.situation,
    intent.phase,
    ...(intent.secondary_concepts ?? []),
  ].filter((t, i, arr) => arr.indexOf(t) === i); // deduplicate

  // ── Assemble draft scenario ──────────────────────────────────────────────
  const scenario: Scenario = {
    scenario_id: scenarioId,
    version: 1,
    title: intent.title,
    description: intent.description,
    phase: intent.phase,
    team_orientation: 'home_attacks_positive_x',
    target_player: targetEntity.id,
    ball,
    teammates,
    opponents,
    pressure: intent.pressure,
    ideal_regions: idealRegions,
    acceptable_regions: acceptableRegions,
    weight_profile: weightProfile,
    constraint_thresholds: {},
    difficulty: intent.difficulty,
    tags,
    // Semantic metadata
    line_group: intent.line_group,
    primary_concept: intent.primary_concept,
    secondary_concepts: intent.secondary_concepts,
    teaching_point: intent.teaching_point,
    target_role_family: intent.target_role_family,
    situation: intent.situation,
    field_zone: intent.field_zone,
    game_state: intent.game_state,
    scenario_archetype: intent.scenario_archetype,
    feedback_hints: intent.feedback_hints,
    correct_reasoning: intent.correct_reasoning,
    curriculum_group: intent.curriculum_group,
    learning_stage: intent.learning_stage,
    consequence_frame: intent.consequence_frame,
  };

  return scenario;
}
