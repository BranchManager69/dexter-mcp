import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/feedback.css';

import { createRoot } from 'react-dom/client';
import { useOpenAIGlobal } from '../sdk';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type FeedbackPayload = {
  id?: string;
  feedback_id?: string;
  status?: 'submitted' | 'received' | 'acknowledged' | 'resolved';
  type?: 'bug' | 'feature' | 'general' | 'praise' | 'complaint';
  message?: string;
  category?: string;
  submittedAt?: string;
  submitted_at?: string;
  ticketUrl?: string;
  ticket_url?: string;
  referenceId?: string;
  reference_id?: string;
  error?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getTypeIcon(type?: string): string {
  switch (type) {
    case 'bug': return '🐛';
    case 'feature': return '💡';
    case 'praise': return '⭐';
    case 'complaint': return '⚠️';
    default: return '📝';
  }
}

function getTypeLabel(type?: string): string {
  switch (type) {
    case 'bug': return 'Bug Report';
    case 'feature': return 'Feature Request';
    case 'praise': return 'Positive Feedback';
    case 'complaint': return 'Complaint';
    default: return 'General Feedback';
  }
}

function formatTimestamp(ts?: string): string {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

function Feedback() {
  const toolOutput = useOpenAIGlobal('toolOutput') as FeedbackPayload | null;

  if (!toolOutput) {
    return (
      <div className="feedback-container">
        <div className="feedback-loading">
          <div className="feedback-loading__spinner" />
          <span>Submitting feedback...</span>
        </div>
      </div>
    );
  }

  if (toolOutput.error) {
    return (
      <div className="feedback-container">
        <div className="feedback-error">{toolOutput.error}</div>
      </div>
    );
  }

  const id = toolOutput.id || toolOutput.feedback_id;
  const submitted = toolOutput.submittedAt || toolOutput.submitted_at;
  const ticketUrl = toolOutput.ticketUrl || toolOutput.ticket_url;
  const refId = toolOutput.referenceId || toolOutput.reference_id;

  return (
    <div className="feedback-container">
      <div className="feedback-card">
        {/* Header */}
        <div className="feedback-header">
          <div className="feedback-header-left">
            <span className="feedback-icon">{getTypeIcon(toolOutput.type)}</span>
            <span className="feedback-title">{getTypeLabel(toolOutput.type)}</span>
          </div>
          <span className="feedback-badge feedback-badge--success">✓ Submitted</span>
        </div>

        {/* Message Preview */}
        {toolOutput.message && (
          <div className="feedback-message">
            <span className="feedback-message__label">YOUR FEEDBACK</span>
            <p className="feedback-message__text">
              {toolOutput.message.length > 200 
                ? `${toolOutput.message.slice(0, 200)}...` 
                : toolOutput.message}
            </p>
          </div>
        )}

        {/* Details */}
        <div className="feedback-details">
          {id && (
            <div className="feedback-detail">
              <span className="feedback-detail__label">Feedback ID</span>
              <span className="feedback-detail__value">{id}</span>
            </div>
          )}
          {refId && (
            <div className="feedback-detail">
              <span className="feedback-detail__label">Reference</span>
              <span className="feedback-detail__value">{refId}</span>
            </div>
          )}
          {toolOutput.category && (
            <div className="feedback-detail">
              <span className="feedback-detail__label">Category</span>
              <span className="feedback-detail__value">{toolOutput.category}</span>
            </div>
          )}
          {submitted && (
            <div className="feedback-detail">
              <span className="feedback-detail__label">Submitted</span>
              <span className="feedback-detail__value">{formatTimestamp(submitted)}</span>
            </div>
          )}
        </div>

        {/* Ticket Link */}
        {ticketUrl && (
          <a 
            href={ticketUrl} 
            target="_blank" 
            rel="noreferrer"
            className="feedback-link"
          >
            View Ticket ↗
          </a>
        )}

        {/* Thank You */}
        <div className="feedback-note">
          Thank you for your feedback! We'll review it and get back to you if needed.
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mount
// ─────────────────────────────────────────────────────────────────────────────

const root = document.getElementById('feedback-root');
if (root) {
  createRoot(root).render(<Feedback />);
}

export default Feedback;
