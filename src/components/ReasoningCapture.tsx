import { useState } from 'react';
import type { ReasoningOption } from '../types';

interface ReasoningCaptureProps {
  onSubmit: (reasoning: ReasoningOption | undefined) => void;
}

const OPTIONS: { value: ReasoningOption; label: string }[] = [
  { value: 'create_passing_angle', label: 'Create a passing angle' },
  { value: 'provide_cover', label: 'Provide cover' },
  { value: 'enable_switch', label: 'Enable a switch' },
  { value: 'support_under_pressure', label: 'Support under pressure' },
];

export default function ReasoningCapture({ onSubmit }: ReasoningCaptureProps) {
  const [selected, setSelected] = useState<ReasoningOption | null>(null);

  return (
    <div style={{ padding: '16px', background: '#16213e', borderRadius: '8px', border: '2px solid #2c3e50' }}>
      <div style={{ fontWeight: 'bold', marginBottom: '12px', color: '#e0e0e0' }}>
        Why did you position there?
      </div>
      {OPTIONS.map(opt => (
        <label
          key={opt.value}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px',
            marginBottom: '6px',
            borderRadius: '6px',
            cursor: 'pointer',
            background: selected === opt.value ? 'rgba(52, 152, 219, 0.2)' : 'transparent',
            border: selected === opt.value ? '1px solid #3498db' : '1px solid transparent',
          }}
        >
          <input
            type="radio"
            name="reasoning"
            value={opt.value}
            checked={selected === opt.value}
            onChange={() => setSelected(opt.value)}
          />
          <span style={{ color: '#ccc' }}>{opt.label}</span>
        </label>
      ))}
      <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
        <button
          onClick={() => onSubmit(undefined)}
          style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', background: '#2c3e50', color: '#aaa', cursor: 'pointer' }}
        >
          Skip
        </button>
        <button
          onClick={() => onSubmit(selected ?? undefined)}
          style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', background: '#3498db', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}
        >
          Confirm
        </button>
      </div>
    </div>
  );
}
