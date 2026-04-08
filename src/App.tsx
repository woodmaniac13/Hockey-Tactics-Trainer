import { useState, useEffect, useCallback, useRef } from 'react';
import type { Scenario, WeightProfile, ScenarioPack } from './types';
import TrainingPage from './pages/TrainingPage';
import { loadManifest, loadScenario, loadAllWeightProfiles } from './scenarios/scenarioLoader';

export default function App() {
  const [scenarioMap, setScenarioMap] = useState<Record<string, Scenario>>({});
  const [weightProfiles, setWeightProfiles] = useState<Record<string, WeightProfile>>({});
  const [packs, setPacks] = useState<ScenarioPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Track which pack IDs have been loaded using a ref to avoid stale closure issues
  const loadedPackIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    async function loadInitial() {
      try {
        const [manifest, profiles] = await Promise.all([
          loadManifest(),
          loadAllWeightProfiles(),
        ]);
        setPacks(manifest.packs);
        setWeightProfiles(profiles);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    }
    void loadInitial();
  }, []);

  const loadPackScenarios = useCallback(async (packId: string) => {
    if (loadedPackIdsRef.current.has(packId)) return;
    // Mark as loading immediately to prevent duplicate concurrent loads
    loadedPackIdsRef.current.add(packId);

    const pack = packs.find(p => p.id === packId);
    if (!pack) return;

    const loaded: Scenario[] = [];
    for (const path of pack.scenarios) {
      const sc = await loadScenario(path);
      if (sc) loaded.push(sc);
    }

    if (loaded.length > 0) {
      setScenarioMap(prev => {
        const next = { ...prev };
        for (const sc of loaded) next[sc.scenario_id] = sc;
        return next;
      });
    }
  }, [packs]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1a1a2e', color: '#e0e0e0' }}>
        <div>Loading scenarios...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1a1a2e', color: '#e74c3c' }}>
        <div>Error loading app: {error}</div>
      </div>
    );
  }

  return (
    <TrainingPage
      scenarioMap={scenarioMap}
      weightProfiles={weightProfiles}
      packs={packs}
      onLoadPack={loadPackScenarios}
    />
  );
}
