import { useState, useEffect } from 'react';
import type { Scenario, WeightProfile, ScenarioPack } from './types';
import TrainingPage from './pages/TrainingPage';
import { loadManifest, loadScenario, loadAllWeightProfiles } from './scenarios/scenarioLoader';

export default function App() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenarioMap, setScenarioMap] = useState<Record<string, Scenario>>({});
  const [weightProfiles, setWeightProfiles] = useState<Record<string, WeightProfile>>({});
  const [packs, setPacks] = useState<ScenarioPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAll() {
      try {
        const [manifest, profiles] = await Promise.all([
          loadManifest(),
          loadAllWeightProfiles(),
        ]);
        setPacks(manifest.packs);
        setWeightProfiles(profiles);

        const loadedScenarios: Scenario[] = [];
        for (const pack of manifest.packs) {
          for (const path of pack.scenarios) {
            const sc = await loadScenario(path);
            if (sc) loadedScenarios.push(sc);
          }
        }
        setScenarios(loadedScenarios);
        const map: Record<string, Scenario> = {};
        for (const sc of loadedScenarios) map[sc.scenario_id] = sc;
        setScenarioMap(map);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    }
    void loadAll();
  }, []);

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
      scenarios={scenarios}
      scenarioMap={scenarioMap}
      weightProfiles={weightProfiles}
      packs={packs}
    />
  );
}
