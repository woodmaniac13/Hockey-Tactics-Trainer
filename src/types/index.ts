export type Point = { x: number; y: number };

export type Entity = {
  id: string;
  role: string;
  team: 'home' | 'away';
  x: number;
  y: number;
};

export type CircleRegion = { x: number; y: number; r: number };

export type PressureDirection = 'inside_out' | 'outside_in' | 'central' | 'none';
export type PressureIntensity = 'low' | 'medium' | 'high';

export type Pressure = {
  direction: PressureDirection;
  intensity: PressureIntensity;
};

export type ConstraintThresholds = {
  support?: number;
  passing_lane?: number;
  spacing?: number;
  pressure_relief?: number;
  width_depth?: number;
  cover?: number;
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
  ideal_regions: CircleRegion[];
  acceptable_regions: CircleRegion[];
  weight_profile: string;
  constraint_thresholds: ConstraintThresholds;
  difficulty: number;
  tags: string[];
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
  scenarios: string[];
};

export type ScenarioPackManifest = {
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
  reasoning?: string;
  timestamp: number;
};

export type AppSettings = {
  show_overlays: boolean;
  enable_reasoning_prompt: boolean;
  debug_mode: boolean;
};

export type ScenarioState = 'LOCKED' | 'AVAILABLE' | 'COMPLETED';

export type ReasoningOption = 'create_passing_angle' | 'provide_cover' | 'enable_switch' | 'support_under_pressure';
