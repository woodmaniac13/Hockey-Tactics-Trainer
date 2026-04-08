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

// Legacy circle region: backward-compatible format { x, y, r } with no type discriminator
export const CircleRegionSchema = z.object({
  x: z.number(),
  y: z.number(),
  r: z.number().positive(),
}).strict();

// Tagged region primitives (new format, each carries a `type` discriminator)
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
 * Tactical region — a discriminated union of all supported region primitives.
 *
 * The legacy circle format `{ x, y, r }` (no `type` field) is tried first so
 * that existing scenario files continue to validate without modification.
 */
export const TacticalRegionSchema = z.union([
  CircleRegionSchema,         // legacy: { x, y, r }
  TaggedCircleRegionSchema,   // { type: "circle", x, y, r }
  RectangleRegionSchema,      // { type: "rectangle", x, y, width, height, rotation? }
  PolygonRegionSchema,        // { type: "polygon", vertices: [...] }
  LaneRegionSchema,           // { type: "lane", x1, y1, x2, y2, width }
]);

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
  ideal_regions: z.array(TacticalRegionSchema),
  acceptable_regions: z.array(TacticalRegionSchema),
  weight_profile: z.string(),
  constraint_thresholds: ConstraintThresholdsSchema,
  difficulty: z.number().int().min(1).max(5),
  tags: z.array(z.string()),
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
