import { z } from 'zod';

export const PointSchema = z.object({
  x: z.number(),
  y: z.number(),
}).strict();

export const EntitySchema = z.object({
  id: z.string(),
  role: z.string(),
  team: z.enum(['home', 'away']),
  x: z.number(),
  y: z.number(),
}).strict();

export const CircleRegionSchema = z.object({
  x: z.number(),
  y: z.number(),
  r: z.number().positive(),
}).strict();

export const PressureDirectionSchema = z.enum(['inside_out', 'outside_in', 'central', 'none']);
export const PressureIntensitySchema = z.enum(['low', 'medium', 'high']);

export const PressureSchema = z.object({
  direction: PressureDirectionSchema,
  intensity: PressureIntensitySchema,
}).strict();

export const ConstraintThresholdsSchema = z.object({
  support: z.number().optional(),
  passing_lane: z.number().optional(),
  spacing: z.number().optional(),
  pressure_relief: z.number().optional(),
  width_depth: z.number().optional(),
  cover: z.number().optional(),
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
  ideal_regions: z.array(CircleRegionSchema),
  acceptable_regions: z.array(CircleRegionSchema),
  weight_profile: z.string(),
  constraint_thresholds: ConstraintThresholdsSchema,
  difficulty: z.number().int().min(1).max(5),
  tags: z.array(z.string()),
}).strict();

export const WeightProfileWeightsSchema = z.object({
  support: z.number().min(0).max(1).optional(),
  passing_lane: z.number().min(0).max(1).optional(),
  spacing: z.number().min(0).max(1).optional(),
  pressure_relief: z.number().min(0).max(1).optional(),
  width_depth: z.number().min(0).max(1).optional(),
  cover: z.number().min(0).max(1).optional(),
  region_fit: z.number().min(0).max(1).optional(),
  reasoning_bonus: z.number().min(0).max(1).optional(),
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
