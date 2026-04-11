import { z } from 'zod';

export const PointSchema = z.object({
  x: z.number(),
  y: z.number(),
}).strict();

export const EntitySchema = z.object({
  id: z.string(),
  // Roles must use uppercase alphanumeric characters only (e.g. "GK", "CM", "FW").
  // The content lint layer additionally checks against a canonical vocabulary list.
  role: z.string().regex(/^[A-Z0-9_]+$/, 'Entity role must use uppercase alphanumeric characters (e.g. "GK", "CM", "FW")'),
  team: z.enum(['home', 'away']),
  x: z.number(),
  y: z.number(),
  // Optional semantic position hint — must be a key in CANONICAL_POSITION_ANCHORS.
  // The content lint layer warns when actual (x, y) deviates >15 units from the anchor.
  position_hint: z.string().optional(),
}).strict();

// All region primitives require a `type` discriminator — no legacy untagged format.
export const TaggedCircleRegionSchema = z.object({
  type: z.literal('circle'),
  x: z.number(),
  y: z.number(),
  r: z.number().positive(),
}).strict();

export const RectangleRegionSchema = z.object({
  type: z.literal('rectangle'),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  rotation: z.number().optional(),
}).strict();

export const PolygonRegionSchema = z.object({
  type: z.literal('polygon'),
  vertices: z.array(PointSchema).min(3),
}).strict();

export const LaneRegionSchema = z.object({
  type: z.literal('lane'),
  x1: z.number(),
  y1: z.number(),
  x2: z.number(),
  y2: z.number(),
  width: z.number().positive(),
}).strict();

/**
 * Geometry-only union — all supported region primitives.
 * Every region must carry a `type` discriminator.
 * Used as the inner `geometry` field of a semantic region wrapper.
 */
export const TacticalRegionGeometrySchema = z.discriminatedUnion('type', [
  TaggedCircleRegionSchema,   // { type: "circle", x, y, r }
  RectangleRegionSchema,      // { type: "rectangle", x, y, width, height, rotation? }
  PolygonRegionSchema,        // { type: "polygon", vertices: [...] }
  LaneRegionSchema,           // { type: "lane", x1, y1, x2, y2, width }
]);

/** Reference frame options for semantic region resolution. */
export const ReferenceFrameSchema = z.enum(['pitch', 'ball', 'target_player', 'entity']);

/** Controlled vocabulary of tactical purposes a semantic region can serve. */
export const SemanticRegionPurposeSchema = z.enum([
  'primary_support_option',
  'secondary_support_option',
  'passing_lane_support',
  'pressure_relief',
  'switch_option',
  'width_hold',
  'depth_hold',
  'defensive_cover',
  'central_protection',
  'recovery_run',
  'press_trigger',
  'screening_position',
  'custom',
]);

/**
 * Semantic region wrapper — pairs tactical metadata with a geometric shape.
 *
 * Either `geometry` or `named_zone` must be provided:
 *   - `geometry`: explicit coordinate-based shape.
 *   - `named_zone`: a key from `NAMED_PITCH_ZONES` in `src/utils/pitchConstants.ts`.
 *     When `named_zone` is present and `geometry` is absent, the system resolves
 *     the geometry automatically from the named-zone lookup table.
 *   - When both are provided, `geometry` takes precedence.
 *
 * Validates reference-frame/entity-id consistency at parse time.
 */
export const SemanticRegionSchema = z.object({
  label: z.string().optional(),
  purpose: SemanticRegionPurposeSchema.optional(),
  reference_frame: ReferenceFrameSchema.optional(),
  reference_entity_id: z.string().optional(),
  notes: z.string().optional(),
  named_zone: z.string().optional(),
  geometry: TacticalRegionGeometrySchema.optional(),
}).strict().superRefine((region, ctx) => {
  // Either geometry or named_zone must be present.
  if (!region.geometry && !region.named_zone) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['geometry'],
      message: 'A semantic region must have either "geometry" or "named_zone"',
    });
  }
  const frame = region.reference_frame ?? 'pitch';
  if (frame === 'entity' && !region.reference_entity_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['reference_entity_id'],
      message: 'reference_entity_id is required when reference_frame is "entity"',
    });
  }
  if (frame !== 'entity' && region.reference_entity_id !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['reference_entity_id'],
      message: 'reference_entity_id is only valid when reference_frame is "entity"',
    });
  }
});

/**
 * Tactical region — accepts either a raw typed geometry primitive or a semantic wrapper.
 */
export const TacticalRegionSchema = z.union([
  TacticalRegionGeometrySchema,  // raw geometry (tagged primitives only)
  SemanticRegionSchema,          // semantic wrapper { label?, purpose?, reference_frame?, geometry }
]);

export const PressureDirectionSchema = z.enum(['inside_out', 'outside_in', 'central', 'none']);
export const PressureIntensitySchema = z.enum(['low', 'medium', 'high']);
export const PressureForcedSideSchema = z.enum(['inside', 'outside', 'sideline', 'baseline', 'none']);

export const PressureSchema = z.object({
  direction: PressureDirectionSchema,
  intensity: PressureIntensitySchema,
  primary_presser_id: z.string().optional(),
  forced_side: PressureForcedSideSchema.optional(),
  blocked_lane: z.string().optional(),
  trap_zone: z.string().optional(),
}).strict();

export const ConstraintThresholdsSchema = z.object({
  support: z.number().min(0).max(1).optional(),
  passing_lane: z.number().min(0).max(1).optional(),
  spacing: z.number().min(0).max(1).optional(),
  pressure_relief: z.number().min(0).max(1).optional(),
  width_depth: z.number().min(0).max(1).optional(),
  cover: z.number().min(0).max(1).optional(),
}).strict();

/** Controlled vocabulary for tactical line groups. */
export const LineGroupSchema = z.enum(['back', 'midfield', 'forward']);

/** Controlled vocabulary for primary tactical concepts. */
export const PrimaryConceptSchema = z.enum([
  'support',
  'cover',
  'transfer',
  'spacing',
  'pressure_response',
  'width_depth',
  'recovery_shape',
  'pressing_angle',
]);

/** Controlled vocabulary for target role families. */
export const TargetRoleFamilySchema = z.enum(['back', 'midfield', 'forward']);

/** Controlled vocabulary for tactical situations. */
export const SituationSchema = z.enum([
  'build_out_under_press',
  'settled_attack',
  'defensive_shape',
  'high_press',
  'recovery_defence',
  'counter_attack',
  'sideline_trap',
  'free_hit_shape',
  'circle_entry_support',
]);

/** Controlled vocabulary for field zones. */
export const FieldZoneSchema = z.enum([
  'defensive_third_left',
  'defensive_third_central',
  'defensive_third_right',
  'middle_third_left',
  'middle_third_central',
  'middle_third_right',
  'attacking_third_left',
  'attacking_third_central',
  'attacking_third_right',
  'circle_edge_left',
  'circle_edge_central',
  'circle_edge_right',
]);

/** Controlled vocabulary for game states. */
export const GameStateSchema = z.enum(['open_play', 'restart', 'turnover', 'counter', 'set_press']);

/** Authored coaching language hooks for scenario-specific feedback. */
export const FeedbackHintsSchema = z.object({
  success: z.string().optional(),
  common_error: z.string().optional(),
  alternate_valid: z.string().optional(),
  teaching_emphasis: z.string().optional(),
  success_points: z.array(z.string()).optional(),
  error_points: z.array(z.string()).optional(),
  alternate_points: z.array(z.string()).optional(),
}).strict();

/** Typed catalog of scenario archetypes for authoring consistency and AI generation. */
export const ScenarioArchetypeSchema = z.enum([
  'back_outlet_support',
  'fullback_escape_option',
  'midfield_triangle_restore',
  'interior_support_under_press',
  'forward_width_hold',
  'forward_press_angle',
  'help_side_cover',
  'central_recovery_cover',
  'sideline_trap_support',
  'weak_side_balance',
]);

/** Controlled vocabulary for entity spatial/tactical relationship types. */
export const EntityRelationshipTypeSchema = z.enum([
  'goal_side_of',
  'supporting_behind',
  'screening',
  'pressing',
  'tracking_runner',
  'providing_width',
]);

/** Authored spatial/tactical relationship between two entities (authoring-only). */
export const EntityRelationshipSchema = z.object({
  entity_id: z.string(),
  relationship: EntityRelationshipTypeSchema,
  relative_to: z.string(),
  notes: z.string().optional(),
}).strict();

/** Controlled vocabulary for arrow styles used in consequence overlays. */
export const ArrowStyleSchema = z.enum(['pass', 'run', 'pressure', 'cover_shift']);

/** A single board arrow for a consequence overlay. */
export const ArrowSchema = z.object({
  style: ArrowStyleSchema,
  from_entity_id: z.string().optional(),
  to_entity_id: z.string().optional(),
  from_point: PointSchema.optional(),
  to_point: PointSchema.optional(),
  label: z.string().optional(),
}).strict();

/** An entity visually shifting to a future ghost position in the consequence frame. */
export const EntityShiftSchema = z.object({
  entity_id: z.string(),
  to_x: z.number().min(0).max(100),
  to_y: z.number().min(0).max(100),
  label: z.string().optional(),
}).strict();

/** State of a passing option between two entities after the move. */
export const PassOptionStateSchema = z.object({
  from_entity_id: z.string(),
  to_entity_id: z.string(),
  state: z.enum(['open', 'blocked', 'risky']),
  label: z.string().optional(),
}).strict();

/** Controlled vocabulary of tactical consequence types. */
export const ConsequenceTypeSchema = z.enum([
  'pass_opened',
  'pass_blocked',
  'pressure_broken',
  'pressure_maintained',
  'shape_restored',
  'shape_broken',
  'cover_gained',
  'cover_lost',
  'lane_opened',
  'lane_closed',
  'triangle_formed',
  'triangle_broken',
  'width_gained',
  'width_lost',
  'depth_created',
  'overloaded_zone',
]);

/**
 * Authored one-step tactical consequence for board overlay and feedback display.
 * `consequence_type` and `explanation` are required; all other fields are optional.
 */
export const OutcomePreviewSchema = z.object({
  consequence_type: ConsequenceTypeSchema,
  explanation: z.string().min(1),
  arrows: z.array(ArrowSchema).optional(),
  entity_shifts: z.array(EntityShiftSchema).optional(),
  pass_option_states: z.array(PassOptionStateSchema).optional(),
  lane_highlight: z.object({
    label: z.string(),
    state: z.enum(['open', 'blocked']),
    geometry: TacticalRegionGeometrySchema,
  }).strict().optional(),
  pressure_result: z.enum(['broken', 'maintained', 'intensified']).optional(),
  shape_result: z.enum(['triangle_formed', 'line_restored', 'overloaded', 'exposed']).optional(),
}).strict();

/**
 * Consequence frame for a scenario — contains an optional success and failure branch.
 * `on_success` → shown for IDEAL/VALID/ALTERNATE_VALID; `on_failure` → PARTIAL/INVALID.
 */
export const ConsequenceFrameSchema = z.object({
  on_success: OutcomePreviewSchema.optional(),
  on_failure: OutcomePreviewSchema.optional(),
}).strict();

export const ScenarioSchema = z.object({
  scenario_id: z.string(),
  version: z.number().int().positive(),
  title: z.string(),
  description: z.string(),
  phase: z.enum(['attack', 'defence', 'transition']),
  team_orientation: z.literal('home_attacks_positive_x'),
  target_player: z.string(),
  ball: PointSchema,
  teammates: z.array(EntitySchema),
  opponents: z.array(EntitySchema),
  pressure: PressureSchema,
  ideal_regions: z.array(TacticalRegionSchema),
  acceptable_regions: z.array(TacticalRegionSchema),
  weight_profile: z.string(),
  constraint_thresholds: ConstraintThresholdsSchema,
  difficulty: z.number().int().min(1).max(5),
  tags: z.array(z.string()),
  // ── Tactical semantics (optional) ─────────────────────────────────────
  line_group: LineGroupSchema.optional(),
  primary_concept: PrimaryConceptSchema.optional(),
  secondary_concepts: z.array(PrimaryConceptSchema).optional(),
  teaching_point: z.string().optional(),
  // ── Role and tactical context (optional) ──────────────────────────────
  target_role_family: TargetRoleFamilySchema.optional(),
  situation: SituationSchema.optional(),
  field_zone: FieldZoneSchema.optional(),
  game_state: GameStateSchema.optional(),
  // ── Curriculum and progression (optional) ──────────────────────────────
  curriculum_group: z.string().optional(),
  learning_stage: z.number().int().positive().optional(),
  prerequisites: z.array(z.string()).optional(),
  recommended_after: z.array(z.string()).optional(),
  // ── Authored feedback hints (optional) ────────────────────────────────
  feedback_hints: FeedbackHintsSchema.optional(),
  // ── Scenario archetype (optional) ──────────────────────────────────────
  scenario_archetype: ScenarioArchetypeSchema.optional(),
  // ── Authored reasoning alignment (optional) ───────────────────────────
  /**
   * The reasoning options that are tactically correct for this scenario.
   * When present the evaluator uses this list directly instead of inferring
   * alignment from tags. Falls back to the tag-driven heuristic when absent.
   */
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
  // ── Entity relationship annotations (optional, authoring-only) ────────
  /**
   * Declared spatial/tactical relationships between entities.
   * Authoring-only — not evaluated or scored at runtime.
   * The content lint layer cross-checks declared relationships against actual
   * entity coordinates and warns on geometric inconsistencies.
   */
  entity_relationships: z.array(EntityRelationshipSchema).optional(),
  // ── Authored tactical consequence (optional) ────────────────────────────
  /**
   * Describes the one-step tactical outcome after the correct or incorrect move.
   * Not evaluated — used only for board overlay and feedback display.
   * `on_success` → shown for IDEAL/VALID/ALTERNATE_VALID; `on_failure` → PARTIAL/INVALID.
   */
  consequence_frame: ConsequenceFrameSchema.optional(),
}).strict();

export const WeightProfileWeightsSchema = z.object({
  support: z.number().min(0).optional(),
  passing_lane: z.number().min(0).optional(),
  spacing: z.number().min(0).optional(),
  pressure_relief: z.number().min(0).optional(),
  width_depth: z.number().min(0).optional(),
  cover: z.number().min(0).optional(),
  region_fit: z.number().min(0).optional(),
  reasoning_bonus: z.number().min(0).optional(),
}).strict();

export const WeightProfileComponentConfigSchema = z.object({
  distance_to_ball: z.object({
    optimal_min: z.number(),
    optimal_max: z.number(),
  }).strict().optional(),
  spacing: z.object({
    min_distance: z.number(),
  }).strict().optional(),
  passing_lane: z.object({
    block_threshold: z.number(),
  }).strict().optional(),
}).strict();

// The keys in WeightProfileWeightsSchema that contribute to scoring (excluding reasoning_bonus)
const SCORING_WEIGHT_KEYS = ['support', 'passing_lane', 'spacing', 'pressure_relief', 'width_depth', 'cover', 'region_fit'] as const;

export const WeightProfileSchema = z.object({
  profile_id: z.string(),
  version: z.number().int().positive(),
  description: z.string().optional(),
  weights: WeightProfileWeightsSchema,
  component_config: WeightProfileComponentConfigSchema.optional(),
}).strict().superRefine((profile, ctx) => {
  const weights = profile.weights;
  const sum = SCORING_WEIGHT_KEYS.reduce((acc, key) => acc + (weights[key] ?? 0), 0);
  if (sum === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['weights'],
      message: 'Weight profile must define at least one non-zero component weight',
    });
  }
});

export const ScenarioPackSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  order: z.number().int(),
  scenarios: z.array(z.string()),
}).strict();

export const ScenarioPackManifestSchema = z.object({
  version: z.number().int().positive(),
  packs: z.array(ScenarioPackSchema),
}).strict().superRefine((manifest, ctx) => {
  const seenPackIds = new Map<string, number>();
  const seenScenarioPaths = new Map<string, { packIndex: number; scenarioIndex: number }>();

  manifest.packs.forEach((pack, packIndex) => {
    const priorPackIndex = seenPackIds.get(pack.id);
    if (priorPackIndex !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['packs', packIndex, 'id'],
        message: `Duplicate scenario pack id "${pack.id}" also used at packs[${priorPackIndex}].id`,
      });
    } else {
      seenPackIds.set(pack.id, packIndex);
    }

    const seenPackScenarioPaths = new Map<string, number>();
    pack.scenarios.forEach((scenarioPath, scenarioIndex) => {
      const priorScenarioIndex = seenPackScenarioPaths.get(scenarioPath);
      if (priorScenarioIndex !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['packs', packIndex, 'scenarios', scenarioIndex],
          message: `Duplicate scenario path "${scenarioPath}" within pack "${pack.id}"`,
        });
      } else {
        seenPackScenarioPaths.set(scenarioPath, scenarioIndex);
      }

      const priorOccurrence = seenScenarioPaths.get(scenarioPath);
      if (priorOccurrence !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['packs', packIndex, 'scenarios', scenarioIndex],
          message: `Scenario path "${scenarioPath}" is already referenced at packs[${priorOccurrence.packIndex}].scenarios[${priorOccurrence.scenarioIndex}]`,
        });
      } else {
        seenScenarioPaths.set(scenarioPath, { packIndex, scenarioIndex });
      }
    });
  });
});

/**
 * Weights manifest — data-driven list of all available weight profile IDs.
 *
 * Stored at /public/weights/weights-manifest.json.
 * Replaces the hardcoded profile list in the loader so that adding a new profile
 * only requires adding the JSON file and updating the manifest — no code change needed.
 */
export const WeightsManifestSchema = z.object({
  version: z.number().int().positive(),
  profiles: z.array(z.string()).min(1),
}).strict();
