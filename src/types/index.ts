export type Point = { x: number; y: number };

export type Entity = {
  id: string;
  role: string;
  team: 'home' | 'away';
  x: number;
  y: number;
  /**
   * Optional semantic hint naming the standard tactical position this entity occupies.
   * Must be a key from `CANONICAL_POSITION_ANCHORS` in `src/utils/pitchConstants.ts`.
   * The content lint layer warns when the actual (x, y) deviates more than 15 units
   * from the anchor centroid, helping catch LLM-generated coordinate errors.
   */
  position_hint?: string;
};

export type TaggedCircleRegion = { type: 'circle'; x: number; y: number; r: number };
export type RectangleRegion = { type: 'rectangle'; x: number; y: number; width: number; height: number; rotation?: number };
export type PolygonRegion = { type: 'polygon'; vertices: Point[] };
export type LaneRegion = { type: 'lane'; x1: number; y1: number; x2: number; y2: number; width: number };

/** Union of all supported geometric region primitives. All regions must carry a type discriminator. */
export type TacticalRegionGeometry =
  | TaggedCircleRegion
  | RectangleRegion
  | PolygonRegion
  | LaneRegion;

/** Reference frame for resolving a semantic region into pitch-space geometry. */
export type ReferenceFrame = 'pitch' | 'ball' | 'target_player' | 'entity';

/** Controlled vocabulary of tactical purposes a region can serve. */
export type SemanticRegionPurpose =
  | 'primary_support_option'
  | 'secondary_support_option'
  | 'passing_lane_support'
  | 'pressure_relief'
  | 'switch_option'
  | 'width_hold'
  | 'depth_hold'
  | 'defensive_cover'
  | 'central_protection'
  | 'recovery_run'
  | 'press_trigger'
  | 'screening_position'
  | 'custom';

/**
 * Semantic wrapper that pairs tactical metadata with a geometric shape.
 * `reference_frame` defaults to `'pitch'` when omitted.
 *
 * Either `geometry` or `named_zone` must be provided:
 *   - `geometry`: explicit coordinate-based shape (circle, rectangle, polygon, lane)
 *   - `named_zone`: key from `NAMED_PITCH_ZONES` in `src/utils/pitchConstants.ts`
 *     — the geometry is resolved automatically; no coordinates required.
 *
 * Using `named_zone` is the preferred approach for LLM-generated scenarios because
 * it avoids the need to specify absolute pitch coordinates.
 */
export type SemanticRegion = {
  label?: string;
  purpose?: SemanticRegionPurpose;
  reference_frame?: ReferenceFrame;
  /** Required only when `reference_frame === 'entity'`. */
  reference_entity_id?: string;
  notes?: string;
  /**
   * Named zone key from `NAMED_PITCH_ZONES`. When present without `geometry`,
   * the system resolves coordinates from the named-zone lookup table.
   * When both `named_zone` and `geometry` are present, `geometry` takes precedence.
   */
  named_zone?: string;
  /** Explicit geometry. Required unless `named_zone` is provided. */
  geometry?: TacticalRegionGeometry;
};

/** Union of all supported tactical region forms — raw geometry or semantic wrapper. */
export type TacticalRegion = TacticalRegionGeometry | SemanticRegion;

export type PressureDirection = 'inside_out' | 'outside_in' | 'central' | 'none';
export type PressureIntensity = 'low' | 'medium' | 'high';
export type PressureForcedSide = 'inside' | 'outside' | 'sideline' | 'baseline' | 'none';

export type Pressure = {
  direction: PressureDirection;
  intensity: PressureIntensity;
  /** ID of the entity applying the primary press (optional). */
  primary_presser_id?: string;
  /** Which side the ball carrier is being forced toward (optional). */
  forced_side?: PressureForcedSide;
  /** Authored label for the passing lane blocked by pressure (optional). */
  blocked_lane?: string;
  /** Authored label for the intended trap area (optional). */
  trap_zone?: string;
};

export type ConstraintThresholds = {
  support?: number;
  passing_lane?: number;
  spacing?: number;
  pressure_relief?: number;
  width_depth?: number;
  cover?: number;
};

/** Tactical line group the scenario targets. */
export type LineGroup = 'back' | 'midfield' | 'forward';

/** Primary tactical concept being taught. */
export type PrimaryConceptVocab =
  | 'support'
  | 'cover'
  | 'transfer'
  | 'spacing'
  | 'pressure_response'
  | 'width_depth'
  | 'recovery_shape'
  | 'pressing_angle';

/** Role family context for the target player. */
export type TargetRoleFamily = 'back' | 'midfield' | 'forward';

/** Tactical situation context. */
export type SituationVocab =
  | 'build_out_under_press'
  | 'settled_attack'
  | 'defensive_shape'
  | 'high_press'
  | 'recovery_defence'
  | 'counter_attack'
  | 'sideline_trap'
  | 'free_hit_shape'
  | 'circle_entry_support';

/** Field zone where the scenario primarily takes place. */
export type FieldZone =
  | 'defensive_third_left'
  | 'defensive_third_central'
  | 'defensive_third_right'
  | 'middle_third_left'
  | 'middle_third_central'
  | 'middle_third_right'
  | 'attacking_third_left'
  | 'attacking_third_central'
  | 'attacking_third_right'
  | 'circle_edge_left'
  | 'circle_edge_central'
  | 'circle_edge_right';

/** Game state at the time of the scenario. */
export type GameState = 'open_play' | 'restart' | 'turnover' | 'counter' | 'set_press';

/** Authored coaching language hooks for scenario-specific feedback. */
export type FeedbackHints = {
  success?: string;
  common_error?: string;
  alternate_valid?: string;
  teaching_emphasis?: string;
  /** Authored per-bullet strengths shown for IDEAL/VALID results. */
  success_points?: string[];
  /** Authored per-bullet failures shown for PARTIAL/INVALID results. */
  error_points?: string[];
  /** Authored per-bullet notes shown for ALTERNATE_VALID results. */
  alternate_points?: string[];
};

/** Typed catalog of scenario archetypes for authoring consistency and AI generation. */
export type ScenarioArchetype =
  | 'back_outlet_support'
  | 'fullback_escape_option'
  | 'midfield_triangle_restore'
  | 'interior_support_under_press'
  | 'forward_width_hold'
  | 'forward_press_angle'
  | 'help_side_cover'
  | 'central_recovery_cover'
  | 'sideline_trap_support'
  | 'weak_side_balance';

/**
 * Authoring-only spatial or tactical relationship between two entities.
 *
 * Added to a scenario as `entity_relationships` to document the intended
 * positioning logic. Not used by the evaluator or scoring pipeline.
 *
 * Benefits for LLM generation:
 *   - LLMs can reason about player layouts relationally ("cb2 is goal_side_of
 *     the opposing forward") and derive coordinates from those relationships
 *     using `CANONICAL_POSITION_ANCHORS` as a starting point.
 *   - The content lint layer cross-checks declared relationships against actual
 *     entity coordinates and warns when they are geometrically inconsistent.
 */
export type EntityRelationshipType =
  | 'goal_side_of'      // entity is positioned closer to own goal than relative_to
  | 'supporting_behind' // entity is behind relative_to (lower x than relative_to)
  | 'screening'         // entity is positioned to block a passing lane to relative_to
  | 'pressing'          // entity is actively closing down relative_to
  | 'tracking_runner'   // entity is marking relative_to in a run
  | 'providing_width';  // entity is on the wide flank relative to relative_to

export type EntityRelationship = {
  /** ID of the entity whose position is being described. */
  entity_id: string;
  /** The spatial or tactical role this entity plays relative to the reference. */
  relationship: EntityRelationshipType;
  /** Entity ID of the reference entity, or `"ball"` for ball-relative positioning. */
  relative_to: string;
  /** Optional authored note explaining the tactical intent. */
  notes?: string;
};

export type Scenario = {
  scenario_id: string;
  version: number;
  title: string;
  description: string;
  phase: 'attack' | 'defence' | 'transition';
  team_orientation: 'home_attacks_positive_x';
  target_player: string;
  ball: Point;
  teammates: Entity[];
  opponents: Entity[];
  pressure: Pressure;
  ideal_regions: TacticalRegion[];
  acceptable_regions: TacticalRegion[];
  weight_profile: string;
  constraint_thresholds: ConstraintThresholds;
  difficulty: number;
  tags: string[];
  // ── Tactical semantics (optional) ───────────────────────────────────────
  /** Line group the scenario targets. */
  line_group?: LineGroup;
  /** Primary tactical concept being taught. */
  primary_concept?: PrimaryConceptVocab;
  /** Additional concepts covered by the scenario. */
  secondary_concepts?: PrimaryConceptVocab[];
  /** Short authored coaching point describing the ideal outcome. */
  teaching_point?: string;
  // ── Role and tactical context (optional) ────────────────────────────────
  /** Role family of the target player. */
  target_role_family?: TargetRoleFamily;
  /** Tactical situation context. */
  situation?: SituationVocab;
  /** Primary field zone. */
  field_zone?: FieldZone;
  /** Game state at the time of the scenario. */
  game_state?: GameState;
  // ── Curriculum and progression (optional) ────────────────────────────────
  /** Named curriculum group this scenario belongs to. */
  curriculum_group?: string;
  /** Learning stage within the curriculum group (small integer). */
  learning_stage?: number;
  /** Scenario IDs that should be completed before this one. */
  prerequisites?: string[];
  /** Scenario IDs that work well as follow-ups (soft sequencing). */
  recommended_after?: string[];
  // ── Authored feedback hints (optional) ──────────────────────────────────
  /** Authored coaching language hooks for scenario-specific feedback. */
  feedback_hints?: FeedbackHints;
  // ── Scenario archetype (optional) ────────────────────────────────────────
  /** Lightweight archetype label for authoring consistency and LLM generation. */
  scenario_archetype?: ScenarioArchetype;
  // ── Authored reasoning alignment (optional) ──────────────────────────────
  /**
   * The reasoning options that are tactically correct for this scenario.
   * When present the evaluator uses this list directly instead of inferring
   * alignment from tags. Falls back to the tag-driven heuristic when absent.
   */
  correct_reasoning?: ReasoningOption[];
  // ── Entity relationship annotations (optional, authoring-only) ───────────
  /**
   * Declared spatial/tactical relationships between entities.
   * Authoring-only — not used by the evaluator or scoring pipeline.
   * The content lint layer cross-checks declared relationships against actual
   * entity coordinates and emits warnings on geometric inconsistencies.
   */
  entity_relationships?: EntityRelationship[];
  // ── Authored tactical consequence (optional) ─────────────────────────────
  /**
   * Describes the one-step tactical outcome that follows the correct (or incorrect)
   * positioning decision. Not evaluated — used only for board overlay and feedback display.
   *
   * `on_success` is shown for IDEAL/VALID/ALTERNATE_VALID results.
   * `on_failure` is shown for PARTIAL/INVALID results.
   */
  consequence_frame?: ConsequenceFrame;
};

export type ComponentScores = {
  support: number;
  passing_lane: number;
  spacing: number;
  pressure_relief: number;
  width_depth: number;
  cover: number;
  region_fit: number;
  reasoning_bonus: number;
};

export type ResultType = 'IDEAL' | 'VALID' | 'ALTERNATE_VALID' | 'PARTIAL' | 'INVALID' | 'ERROR';

export type EvaluationResult = {
  score: number;
  result_type: ResultType;
  component_scores: ComponentScores;
  constraints_passed: boolean;
  region_fit_score: number;
  failed_constraints: string[];
};

export type FeedbackResult = {
  score: number;
  result_type: ResultType;
  summary: string;
  positives: string[];
  improvements: string[];
  tactical_explanation: string;
  reasoning_feedback: string;
  /** Authored coaching emphasis surfaced from `feedback_hints.teaching_emphasis`. */
  teaching_emphasis?: string;
};

export type WeightProfileWeights = {
  support?: number;
  passing_lane?: number;
  spacing?: number;
  pressure_relief?: number;
  width_depth?: number;
  cover?: number;
  region_fit?: number;
  reasoning_bonus?: number;
};

export type WeightProfileComponentConfig = {
  distance_to_ball?: { optimal_min: number; optimal_max: number };
  spacing?: { min_distance: number };
  passing_lane?: { block_threshold: number };
};

export type WeightProfile = {
  profile_id: string;
  version: number;
  description?: string;
  weights: WeightProfileWeights;
  component_config?: WeightProfileComponentConfig;
};

export type ScenarioPack = {
  id: string;
  title: string;
  description: string;
  order: number;
  scenarios: string[];
};

export type ScenarioPackManifest = {
  version: number;
  packs: ScenarioPack[];
};

export type ProgressRecord = {
  version: number;
  best_score: number;
  last_score: number;
  attempt_count: number;
  last_played: number;
};

export type AttemptRecord = {
  version: number;
  score: number;
  result_type: ResultType;
  position: Point;
  reasoning?: ReasoningOption;
  timestamp: number;
};

export type AppSettings = {
  show_overlays: boolean;
  enable_reasoning_prompt: boolean;
  debug_mode: boolean;
};

export type ScenarioState = 'LOCKED' | 'AVAILABLE' | 'COMPLETED';

export type ReasoningOption =
  | 'create_passing_angle'
  | 'provide_cover'
  | 'enable_switch'
  | 'support_under_pressure'
  | 'maintain_width'
  | 'restore_shape'
  | 'break_pressure'
  | 'occupy_depth';

// ── Consequence-Based Tactical Feedback Types ─────────────────────────────────

/** Visual style for an arrow drawn on the board in a consequence overlay. */
export type ArrowStyle = 'pass' | 'run' | 'pressure' | 'cover_shift';

/**
 * A single arrow drawn on the board as part of a tactical consequence overlay.
 * Endpoints are resolved from entity IDs (or 'ball') or explicit pitch-space points.
 * At least one of `from_entity_id`/`from_point` and one of `to_entity_id`/`to_point`
 * should be provided so the arrow can be rendered.
 */
export type Arrow = {
  style: ArrowStyle;
  /** Entity ID of the source, or `'ball'` for the ball position. */
  from_entity_id?: string;
  /** Entity ID of the target, or `'ball'` for the ball position. */
  to_entity_id?: string;
  /** Explicit pitch-space source point (0–100 range) used when no entity anchor exists. */
  from_point?: Point;
  /** Explicit pitch-space target point (0–100 range) used when no entity anchor exists. */
  to_point?: Point;
  /** Optional short label displayed near the arrow midpoint (suppressed on small screens). */
  label?: string;
};

/** An entity visually shifting to a new "ghost" position in the consequence frame. */
export type EntityShift = {
  /** ID of the entity whose future position is being illustrated. */
  entity_id: string;
  /** Target x coordinate in pitch space (0–100). */
  to_x: number;
  /** Target y coordinate in pitch space (0–100). */
  to_y: number;
  /** Optional short label shown near the ghost position. */
  label?: string;
};

/** State of a passing option between two entities after the consequence. */
export type PassOptionState = {
  /** ID of the entity with the ball (or `'ball'` for the ball itself). */
  from_entity_id: string;
  /** ID of the potential receiving entity. */
  to_entity_id: string;
  /** Whether the pass is clear, blocked, or risky after the move. */
  state: 'open' | 'blocked' | 'risky';
  /** Optional coaching label for this lane. */
  label?: string;
};

/**
 * Controlled vocabulary of tactical consequence types.
 * Anchors each authored outcome to a known tactical pattern, preventing LLM drift.
 * Positive types (e.g. `pass_opened`) suit `on_success`; negative types (`pass_blocked`)
 * suit `on_failure`. The lint layer warns when a negative type appears on `on_success`.
 */
export type ConsequenceType =
  | 'pass_opened'
  | 'pass_blocked'
  | 'pressure_broken'
  | 'pressure_maintained'
  | 'shape_restored'
  | 'shape_broken'
  | 'cover_gained'
  | 'cover_lost'
  | 'lane_opened'
  | 'lane_closed'
  | 'triangle_formed'
  | 'triangle_broken'
  | 'width_gained'
  | 'width_lost'
  | 'depth_created'
  | 'overloaded_zone';

/**
 * Authored one-step tactical consequence shown on the board after submission.
 *
 * `consequence_type` and `explanation` are required — they form the minimal authored
 * consequence. All other fields are optional enrichment layers (arrows, ghost positions,
 * lane highlights, pressure/shape results) that progressively enhance the board overlay.
 *
 * LLM authoring guidance:
 *   - Start with only `consequence_type` + `explanation`.
 *   - Add `arrows` (max 3) only when they directly illustrate the consequence.
 *   - Add `entity_shifts` (max 2) only for the most tactically significant next movement.
 *   - Use entity IDs from the scenario — the lint layer validates them.
 */
export type OutcomePreview = {
  /** Required — constrained enum anchoring the consequence to a known tactical pattern. */
  consequence_type: ConsequenceType;
  /** Required — one coaching sentence (max ~200 chars) tied to the tactical concept. */
  explanation: string;
  /** Optional — arrows drawn on the board (pass/run/pressure/cover_shift). Max 3. */
  arrows?: Arrow[];
  /** Optional — entities shown at a future "ghost" position. Max 2. */
  entity_shifts?: EntityShift[];
  /** Optional — pass lane states between entities (open/blocked/risky). */
  pass_option_states?: PassOptionState[];
  /** Optional — an explicit lane geometry highlighted as open or blocked. */
  lane_highlight?: {
    label: string;
    state: 'open' | 'blocked';
    /** Pitch-space geometry defining the highlighted lane shape. */
    geometry: TacticalRegionGeometry;
  };
  /** Optional — summary of how pressure changes after the move. */
  pressure_result?: 'broken' | 'maintained' | 'intensified';
  /** Optional — summary of how team shape changes after the move. */
  shape_result?: 'triangle_formed' | 'line_restored' | 'overloaded' | 'exposed';
};

/**
 * Authored consequence frame for a scenario.
 *
 * `on_success` is shown when the evaluation result is IDEAL, VALID, or ALTERNATE_VALID.
 * `on_failure` is shown when the result is PARTIAL or INVALID.
 * Both branches are optional — a scenario can have one, both, or neither.
 */
export type ConsequenceFrame = {
  /** Shown after a correct or near-correct answer (IDEAL / VALID / ALTERNATE_VALID). */
  on_success?: OutcomePreview;
  /** Shown after an incorrect answer (PARTIAL / INVALID). */
  on_failure?: OutcomePreview;
};
