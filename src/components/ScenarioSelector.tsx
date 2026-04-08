
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
  /** When true, renders mobile-optimized cards with reduced density */
  isMobile?: boolean;
}

function DifficultyStars({ difficulty, size }: { difficulty: number; size?: string }) {
  return (
    <span style={{ color: '#f1c40f', fontSize: size ?? '0.75rem' }}>
      {'★'.repeat(difficulty)}{'☆'.repeat(5 - difficulty)}
    </span>
  );
}

/** Format tag names: build_out → "Build-out" */
function formatTag(tag: string): string {
  return tag.replace(/_/g, '-').replace(/^\w/, c => c.toUpperCase());
}

export default function ScenarioSelector({ packs, scenarios, progress, scenarioStates, selectedId, onSelect, onPackExpand, isMobile }: ScenarioSelectorProps) {
  // Trigger lazy loading for all visible packs when the selector mounts or packs change
  useEffect(() => {
    if (!onPackExpand) return;
    for (const pack of packs) {
      onPackExpand(pack.id);
    }
  }, [packs, onPackExpand]);

  return (
    <div style={{ overflowY: 'auto', maxHeight: isMobile ? undefined : '70vh' }}>
      {packs.map(pack => (
        <div key={pack.id} style={{ marginBottom: isMobile ? '20px' : '16px' }}>
          <div style={{ fontWeight: 'bold', color: '#aaa', fontSize: '0.85rem', marginBottom: isMobile ? '10px' : '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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

            if (isMobile) {
              /* ── Mobile card: increased size, reduced density ── */
              return (
                <button
                  key={scenario.scenario_id}
                  onClick={() => !isLocked && onSelect(scenario.scenario_id)}
                  disabled={isLocked}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                    padding: '14px 16px',
                    marginBottom: '8px',
                    borderRadius: '10px',
                    border: '2px solid transparent',
                    background: isLocked ? '#1a1a2e' : '#16213e',
                    cursor: isLocked ? 'not-allowed' : 'pointer',
                    opacity: isLocked ? 0.5 : 1,
                    textAlign: 'left',
                    color: '#e0e0e0',
                  }}
                >
                  {/* Row 1: Title + state icon */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>{scenario.title}</span>
                    {state === 'COMPLETED' && <span style={{ color: '#27ae60', fontSize: '1rem' }}>✓</span>}
                    {isLocked && <span style={{ fontSize: '1rem' }}>🔒</span>}
                  </div>
                  {/* Row 2: Category line */}
                  <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '4px' }}>
                    {formatTag(scenario.phase)}
                  </div>
                  {/* Row 3: Stars or best score */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                    <DifficultyStars difficulty={scenario.difficulty} size="0.85rem" />
                    {rec && <span style={{ fontSize: '0.8rem', color: '#3498db', fontWeight: 'bold' }}>Best: {rec.best_score}</span>}
                  </div>
                </button>
              );
            }

            /* ── Desktop card (unchanged) ── */
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
                  {formatTag(scenario.phase)} · {scenario.tags.map(formatTag).join(', ')}
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
