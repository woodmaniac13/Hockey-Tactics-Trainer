import { z } from 'zod';

export const PointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const EntitySchema = z.object({
  id: z.string(),
  role: z.string(),
  team: z.enum(['home', 'away']),
  x: z.number(),
  y: z.number(),
});

export const CircleRegionSchema = z.object({
  x: z.number(),
  y: z.number(),
  r: z.number().positive(),
});

export const PressureDirectionSchema = z.enum(['inside_out', 'outside_in', 'central', 'none']);
export const PressureIntensitySchema = z.enum(['low', 'medium', 'high']);

export const PressureSchema = z.object({
  direction: PressureDirectionSchema,
  intensity: PressureIntensitySchema,
});

export const ConstraintThresholdsSchema = z.object({
  support: z.number().optional(),
  passing_lane: z.number().optional(),
  spacing: z.number().optional(),
  pressure_relief: z.number().optional(),
  width_depth: z.number().optional(),
  cover: z.number().optional(),
});

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
  ideal_regions: z.array(CircleRegionSchema),
  acceptable_regions: z.array(CircleRegionSchema),
  weight_profile: z.string(),
  constraint_thresholds: ConstraintThresholdsSchema,
  difficulty: z.number().int().min(1).max(5),
  tags: z.array(z.string()),
});

export const WeightProfileWeightsSchema = z.object({
  support: z.number().optional(),
  passing_lane: z.number().optional(),
  spacing: z.number().optional(),
  pressure_relief: z.number().optional(),
  width_depth: z.number().optional(),
  cover: z.number().optional(),
  region_fit: z.number().optional(),
  reasoning_bonus: z.number().optional(),
});

export const WeightProfileComponentConfigSchema = z.object({
  distance_to_ball: z.object({
    optimal_min: z.number(),
    optimal_max: z.number(),
  }).optional(),
  spacing: z.object({
    min_distance: z.number(),
  }).optional(),
  passing_lane: z.object({
    block_threshold: z.number(),
  }).optional(),
});

export const WeightProfileSchema = z.object({
  profile_id: z.string(),
  version: z.number().int().positive(),
  description: z.string().optional(),
  weights: WeightProfileWeightsSchema,
  component_config: WeightProfileComponentConfigSchema.optional(),
});

export const ScenarioPackSchema = z.object({
  id: z.string(),
  title: z.string(),
  scenarios: z.array(z.string()),
});

export const ScenarioPackManifestSchema = z.object({
  packs: z.array(ScenarioPackSchema),
});
