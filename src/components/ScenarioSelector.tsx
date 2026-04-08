
import { useEffect } from 'react';
import type { Scenario, ScenarioPack, ProgressRecord, ScenarioState } from '../types';

interface ScenarioSelectorProps {
  packs: ScenarioPack[];
  scenarios: Record<string, Scenario>;
  progress: Record<string, ProgressRecord>;
  scenarioStates: Record<string, ScenarioState>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPackExpand?: (packId: string) => void;
}

function DifficultyStars({ difficulty }: { difficulty: number }) {
  return (
    <span style={{ color: '#f1c40f', fontSize: '0.75rem' }}>
      {'★'.repeat(difficulty)}{'☆'.repeat(5 - difficulty)}
    </span>
  );
}

export default function ScenarioSelector({ packs, scenarios, progress, scenarioStates, selectedId, onSelect, onPackExpand }: ScenarioSelectorProps) {
  // Trigger lazy loading for all visible packs when the selector mounts or packs change
  useEffect(() => {
    if (!onPackExpand) return;
    for (const pack of packs) {
      onPackExpand(pack.id);
    }
  }, [packs, onPackExpand]);

  return (
    <div style={{ overflowY: 'auto', maxHeight: '70vh' }}>
      {packs.map(pack => (
        <div key={pack.id} style={{ marginBottom: '16px' }}>
          <div style={{ fontWeight: 'bold', color: '#aaa', fontSize: '0.85rem', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {pack.title}
          </div>
          {pack.scenarios.map(path => {
            const id = path.split('/').pop()?.replace('.json', '') ?? path;
            const scenario = Object.values(scenarios).find(s => s.scenario_id === id || path.includes(s.scenario_id));
            if (!scenario) return null;
            const state = scenarioStates[scenario.scenario_id] ?? 'AVAILABLE';
            const rec = progress[scenario.scenario_id];
            const isSelected = selectedId === scenario.scenario_id;
            const isLocked = state === 'LOCKED';

            return (
              <button
                key={scenario.scenario_id}
                onClick={() => !isLocked && onSelect(scenario.scenario_id)}
                disabled={isLocked}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  width: '100%',
                  padding: '10px 12px',
                  marginBottom: '6px',
                  borderRadius: '6px',
                  border: isSelected ? '2px solid #3498db' : '2px solid transparent',
                  background: isSelected ? '#1a3a5c' : (isLocked ? '#1a1a2e' : '#16213e'),
                  cursor: isLocked ? 'not-allowed' : 'pointer',
                  opacity: isLocked ? 0.5 : 1,
                  textAlign: 'left',
                  color: '#e0e0e0',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{scenario.title}</span>
                  {state === 'COMPLETED' && <span style={{ color: '#27ae60', fontSize: '0.8rem' }}>✓</span>}
                  {isLocked && <span style={{ color: '#aaa', fontSize: '0.8rem' }}>🔒</span>}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <DifficultyStars difficulty={scenario.difficulty} />
                  {rec && <span style={{ fontSize: '0.75rem', color: '#aaa' }}>Best: {rec.best_score}</span>}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '2px' }}>
                  {scenario.phase.charAt(0).toUpperCase() + scenario.phase.slice(1)} · {scenario.tags.join(', ')}
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
