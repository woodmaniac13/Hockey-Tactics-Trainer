import type { Scenario, WeightProfile, ScenarioPackManifest } from '../types';
import { ScenarioSchema, WeightProfileSchema, ScenarioPackManifestSchema, WeightsManifestSchema } from './scenarioSchema';

const BASE_URL = import.meta.env.BASE_URL;

function buildUrl(path: string): string {
  return `${BASE_URL}${path.replace(/^\/+/, '')}`;
}

const WEIGHT_PROFILES_DIR = buildUrl('weights');

export async function loadManifest(): Promise<ScenarioPackManifest> {
  const response = await fetch(buildUrl('scenario-packs.json'));
  if (!response.ok) throw new Error(`Failed to load manifest: ${response.status}`);
  const data: unknown = await response.json();
  return ScenarioPackManifestSchema.parse(data);
}

export async function loadScenario(path: string): Promise<Scenario | null> {
  try {
    const response = await fetch(buildUrl(path));
    if (!response.ok) return null;
    const data: unknown = await response.json();
    const result = ScenarioSchema.safeParse(data);
    if (!result.success) {
      console.warn('Scenario validation failed:', result.error.issues);
      return null;
    }
    return result.data;
  } catch (err) {
    console.warn('Failed to load scenario:', path, err);
    return null;
  }
}

export async function loadWeightProfile(profileId: string): Promise<WeightProfile | null> {
  try {
    const response = await fetch(`${WEIGHT_PROFILES_DIR}/${profileId}.json`);
    if (!response.ok) return null;
    const data: unknown = await response.json();
    const result = WeightProfileSchema.safeParse(data);
    if (!result.success) {
      console.warn('WeightProfile validation failed:', result.error.issues);
      return null;
    }
    return result.data;
  } catch (err) {
    console.warn('Failed to load weight profile:', profileId, err);
    return null;
  }
}

/**
 * Load all weight profiles listed in the weights manifest.
 *
 * The manifest (`/public/weights/weights-manifest.json`) is the data-driven
 * source of truth for available profiles. Adding a new profile only requires
 * adding the JSON file and updating the manifest — no code change is needed.
 *
 * Falls back to an empty object if the manifest cannot be loaded.
 */
export async function loadAllWeightProfiles(): Promise<Record<string, WeightProfile>> {
  let profileIds: string[];

  try {
    const response = await fetch(`${WEIGHT_PROFILES_DIR}/weights-manifest.json`);
    if (!response.ok) throw new Error(`Failed to load weights manifest: ${response.status}`);
    const data: unknown = await response.json();
    const manifest = WeightsManifestSchema.parse(data);
    profileIds = manifest.profiles;
  } catch (err) {
    console.warn('Failed to load weights manifest, falling back to empty profile set:', err);
    return {};
  }

  const results: Record<string, WeightProfile> = {};
  await Promise.all(
    profileIds.map(async id => {
      const profile = await loadWeightProfile(id);
      if (profile) results[profile.profile_id] = profile;
    }),
  );
  return results;
}
