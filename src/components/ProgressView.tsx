
import type { Scenario, ProgressRecord } from '../types';
import { exportData, importData, resetAll } from '../storage/storage';
import { getWeaknessTag, getRecommendedScenario } from '../progression/progression';

interface ProgressViewProps {
  scenarios: Scenario[];
  progress: Record<string, ProgressRecord>;
  onSelectScenario: (id: string) => void;
  onProgressChange: () => void;
}

export default function ProgressView({ scenarios, progress, onSelectScenario, onProgressChange }: ProgressViewProps) {
  const completed = scenarios.filter(s => progress[s.scenario_id]?.best_score >= 80).length;
  const total = scenarios.length;

  const tagMap: Record<string, { total: number; count: number }> = {};
  for (const s of scenarios) {
    const rec = progress[s.scenario_id];
    if (!rec) continue;
    for (const tag of s.tags) {
      if (!tagMap[tag]) tagMap[tag] = { total: 0, count: 0 };
      tagMap[tag].total += rec.best_score;
      tagMap[tag].count++;
    }
  }

  const weakTag = getWeaknessTag(progress, scenarios);
  const recommended = getRecommendedScenario(progress, scenarios);

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fhtt-progress.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const result = importData(reader.result as string);
        if (result) {
          onProgressChange();
          alert('Progress imported successfully!');
        } else {
          alert('Import failed. Invalid file format.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleReset = () => {
    if (confirm('Reset all progress? This cannot be undone.')) {
      resetAll();
      onProgressChange();
    }
  };

  return (
    <div style={{ padding: '16px', background: '#16213e', borderRadius: '8px' }}>
      <div style={{ fontWeight: 'bold', marginBottom: '16px', fontSize: '1.1rem' }}>Progress</div>

      <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px' }}>
        <div style={{ color: '#aaa', fontSize: '0.85rem', marginBottom: '8px' }}>Overall Completion</div>
        <div style={{ fontWeight: 'bold', fontSize: '1.5rem', color: '#27ae60' }}>{completed}/{total}</div>
        <div style={{ marginTop: '8px', height: '6px', background: '#2c3e50', borderRadius: '3px' }}>
          <div style={{ height: '100%', borderRadius: '3px', background: '#27ae60', width: `${total > 0 ? (completed / total) * 100 : 0}%` }} />
        </div>
      </div>

      {Object.keys(tagMap).length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ color: '#aaa', fontSize: '0.85rem', marginBottom: '8px' }}>Performance by Tag</div>
          {Object.entries(tagMap).map(([tag, data]) => {
            const avg = Math.round(data.total / data.count);
            return (
              <div key={tag} style={{ marginBottom: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#ccc', marginBottom: '2px' }}>
                  <span>{tag}</span>
                  <span style={{ color: weakTag === tag ? '#e74c3c' : '#aaa' }}>{avg}</span>
                </div>
                <div style={{ height: '4px', background: '#2c3e50', borderRadius: '2px' }}>
                  <div style={{ height: '100%', borderRadius: '2px', background: weakTag === tag ? '#e74c3c' : '#3498db', width: `${avg}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {recommended && (
        <div style={{ marginBottom: '16px', padding: '10px', background: 'rgba(52,152,219,0.1)', borderRadius: '6px', border: '1px solid rgba(52,152,219,0.3)' }}>
          <div style={{ color: '#aaa', fontSize: '0.8rem', marginBottom: '4px' }}>Recommended</div>
          <button
            onClick={() => onSelectScenario(recommended.scenario_id)}
            style={{ color: '#3498db', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold', padding: 0 }}
          >
            {recommended.title} →
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button onClick={handleExport} style={{ flex: 1, padding: '7px 10px', borderRadius: '6px', border: 'none', background: '#2c3e50', color: '#ccc', cursor: 'pointer', fontSize: '0.85rem' }}>
          Export
        </button>
        <button onClick={handleImport} style={{ flex: 1, padding: '7px 10px', borderRadius: '6px', border: 'none', background: '#2c3e50', color: '#ccc', cursor: 'pointer', fontSize: '0.85rem' }}>
          Import
        </button>
        <button onClick={handleReset} style={{ flex: 1, padding: '7px 10px', borderRadius: '6px', border: 'none', background: '#4a1010', color: '#e74c3c', cursor: 'pointer', fontSize: '0.85rem' }}>
          Reset
        </button>
      </div>
    </div>
  );
}
