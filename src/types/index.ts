export type Point = { x: number; y: number };

export type Entity = {
  id: string;
  role: string;
  team: 'home' | 'away';
  x: number;
  y: number;
};

export type CircleRegion = { x: number; y: number; r: number };

export type TaggedCircleRegion = { type: 'circle'; x: number; y: number; r: number };
export type RectangleRegion = { type: 'rectangle'; x: number; y: number; width: number; height: number; rotation?: number };
export type PolygonRegion = { type: 'polygon'; vertices: Point[] };
export type LaneRegion = { type: 'lane'; x1: number; y1: number; x2: number; y2: number; width: number };

/** Union of all supported geometric region primitives (no semantic metadata). */
export type TacticalRegionGeometry =
  | CircleRegion
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
 */
export type SemanticRegion = {
  label?: string;
  purpose?: SemanticRegionPurpose;
  reference_frame?: ReferenceFrame;
  /** Required only when `reference_frame === 'entity'`. */
  reference_entity_id?: string;
  notes?: string;
  geometry: TacticalRegionGeometry;
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
  scenario_archetype?: string;
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

export type ReasoningOption = 'create_passing_angle' | 'provide_cover' | 'enable_switch' | 'support_under_pressure';
