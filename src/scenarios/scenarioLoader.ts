import type { Scenario, WeightProfile, ScenarioPackManifest } from '../types';
import { ScenarioSchema, WeightProfileSchema, ScenarioPackManifestSchema } from './scenarioSchema';

const BASE_URL = '/Hockey-Tactics-Trainer';
const WEIGHT_PROFILES_DIR = `${BASE_URL}/weights`;

export async function loadManifest(): Promise<ScenarioPackManifest> {
  const response = await fetch(`${BASE_URL}/scenario-packs.json`);
  if (!response.ok) throw new Error(`Failed to load manifest: ${response.status}`);
  const data: unknown = await response.json();
  return ScenarioPackManifestSchema.parse(data);
}

export async function loadScenario(path: string): Promise<Scenario | null> {
  try {
    const response = await fetch(path);
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

export async function loadAllWeightProfiles(): Promise<Record<string, WeightProfile>> {
  const profileIds = ['build_out_v1', 'defence_v1', 'attack_v1', 'transition_v1'];
  const results: Record<string, WeightProfile> = {};
  await Promise.all(
    profileIds.map(async id => {
      const profile = await loadWeightProfile(id);
      if (profile) results[profile.profile_id] = profile;
    }),
  );
  return results;
}
