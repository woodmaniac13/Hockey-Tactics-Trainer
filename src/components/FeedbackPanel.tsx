
import type { FeedbackResult, ResultType, OutcomePreview } from '../types';

interface FeedbackPanelProps {
  feedback: FeedbackResult;
  onRetry: () => void;
  onNext: () => void;
  /** When true, hides the inline action buttons (mobile uses a sticky bar instead) */
  isMobile?: boolean;
  /**
   * Authored consequence to surface as "What happens next" below the teaching point.
   * Shown when the scenario includes a `consequence_frame` and an evaluation was submitted.
   */
  outcomePreview?: OutcomePreview | null;
}

const RESULT_COLORS: Record<ResultType, string> = {
  IDEAL: '#27ae60',
  VALID: '#2980b9',
  ALTERNATE_VALID: '#8e44ad',
  PARTIAL: '#e67e22',
  INVALID: '#e74c3c',
  ERROR: '#7f8c8d',
};

export default function FeedbackPanel({ feedback, onRetry, onNext, isMobile, outcomePreview }: FeedbackPanelProps) {
  const color = RESULT_COLORS[feedback.result_type];

  return (
    <div style={{ padding: isMobile ? '12px' : '16px', background: '#16213e', borderRadius: '8px', border: `2px solid ${color}` }}>
      {/* Score card */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <div style={{
          fontSize: isMobile ? '2.5rem' : '2rem',
          fontWeight: 'bold',
          color,
          lineHeight: 1,
        }}>
          {feedback.score}
        </div>
        <div>
          <div style={{
            display: 'inline-block',
            padding: '2px 10px',
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
        <div style={{ marginBottom: '10px' }}>
          <div style={{ fontWeight: 'bold', color: '#27ae60', marginBottom: '4px', fontSize: isMobile ? '0.85rem' : undefined }}>✓ Strengths</div>
          {feedback.positives.map((p, i) => (
            <div key={i} style={{ color: '#aed6ae', paddingLeft: '8px', marginBottom: '3px', fontSize: isMobile ? '0.85rem' : undefined }}>✓ {p}</div>
          ))}
        </div>
      )}

      {feedback.improvements.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <div style={{ fontWeight: 'bold', color: '#e67e22', marginBottom: '4px', fontSize: isMobile ? '0.85rem' : undefined }}>▲ Improvements</div>
          {feedback.improvements.map((imp, i) => (
            <div key={i} style={{ color: '#f0b97a', paddingLeft: '8px', marginBottom: '3px', fontSize: isMobile ? '0.85rem' : undefined }}>▲ {imp}</div>
          ))}
        </div>
      )}

      {feedback.tactical_explanation && (
        <div style={{ marginBottom: '10px', padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', color: '#ccc', fontSize: isMobile ? '0.8rem' : '0.9rem' }}>
          <div style={{ fontWeight: 'bold', color: '#aaa', marginBottom: '4px' }}>Tactical Context</div>
          {feedback.tactical_explanation}
        </div>
      )}

      {feedback.reasoning_feedback && (
        <div style={{ marginBottom: '10px', color: '#aaa', fontSize: '0.875rem' }}>
          <em>{feedback.reasoning_feedback}</em>
        </div>
      )}

      {feedback.teaching_emphasis && (
        <div style={{ marginBottom: '10px', padding: '8px 10px', background: 'rgba(52, 152, 219, 0.12)', borderLeft: '3px solid #3498db', borderRadius: '4px', color: '#a8d4f5', fontSize: isMobile ? '0.8rem' : '0.875rem' }}>
          <div style={{ fontWeight: 'bold', color: '#3498db', marginBottom: '3px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📌 Coaching Point</div>
          {feedback.teaching_emphasis}
        </div>
      )}

      {outcomePreview && (
        <div style={{ marginBottom: '10px', padding: '8px 10px', background: 'rgba(39, 174, 96, 0.1)', borderLeft: '3px solid #27ae60', borderRadius: '4px', fontSize: isMobile ? '0.8rem' : '0.875rem' }}>
          <div style={{ fontWeight: 'bold', color: '#27ae60', marginBottom: '3px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>⚡ What happens next</div>
          <div style={{ color: '#aed6ae' }}>{outcomePreview.explanation}</div>
        </div>
      )}

      {/* On mobile, actions are in the sticky bottom bar; on desktop, show inline */}
      {!isMobile && (
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
      )}
    </div>
  );
}
