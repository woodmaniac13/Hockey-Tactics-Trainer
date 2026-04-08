
import type { FeedbackResult, ResultType } from '../types';

interface FeedbackPanelProps {
  feedback: FeedbackResult;
  onRetry: () => void;
  onNext: () => void;
}

const RESULT_COLORS: Record<ResultType, string> = {
  IDEAL: '#27ae60',
  VALID: '#2980b9',
  ALTERNATE_VALID: '#8e44ad',
  PARTIAL: '#e67e22',
  INVALID: '#e74c3c',
  ERROR: '#7f8c8d',
};

export default function FeedbackPanel({ feedback, onRetry, onNext }: FeedbackPanelProps) {
  const color = RESULT_COLORS[feedback.result_type];

  return (
    <div style={{ padding: '16px', background: '#16213e', borderRadius: '8px', border: `2px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <div style={{
          fontSize: '2rem',
          fontWeight: 'bold',
          color,
        }}>
          {feedback.score}
        </div>
        <div>
          <div style={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: '4px',
            background: color,
            color: '#fff',
            fontSize: '0.8rem',
            fontWeight: 'bold',
            marginBottom: '4px',
          }}>
            {feedback.result_type}
          </div>
          <div style={{ fontSize: '0.95rem', color: '#ccc' }}>{feedback.summary}</div>
        </div>
      </div>

      {feedback.positives.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontWeight: 'bold', color: '#27ae60', marginBottom: '6px' }}>✓ Strengths</div>
          {feedback.positives.map((p, i) => (
            <div key={i} style={{ color: '#aed6ae', paddingLeft: '8px', marginBottom: '3px' }}>✓ {p}</div>
          ))}
        </div>
      )}

      {feedback.improvements.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontWeight: 'bold', color: '#e67e22', marginBottom: '6px' }}>▲ Improvements</div>
          {feedback.improvements.map((imp, i) => (
            <div key={i} style={{ color: '#f0b97a', paddingLeft: '8px', marginBottom: '3px' }}>▲ {imp}</div>
          ))}
        </div>
      )}

      {feedback.tactical_explanation && (
        <div style={{ marginBottom: '12px', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', color: '#ccc', fontSize: '0.9rem' }}>
          <div style={{ fontWeight: 'bold', color: '#aaa', marginBottom: '4px' }}>Tactical Context</div>
          {feedback.tactical_explanation}
        </div>
      )}

      {feedback.reasoning_feedback && (
        <div style={{ marginBottom: '12px', color: '#aaa', fontSize: '0.875rem' }}>
          <em>{feedback.reasoning_feedback}</em>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
        <button
          onClick={onRetry}
          style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', background: '#2c3e50', color: '#fff', fontWeight: 'bold' }}
        >
          ↺ Retry
        </button>
        <button
          onClick={onNext}
          style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', background: color, color: '#fff', fontWeight: 'bold' }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
