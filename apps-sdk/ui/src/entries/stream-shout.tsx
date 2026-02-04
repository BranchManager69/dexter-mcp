import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/stream-shout.css';

import { createRoot } from 'react-dom/client';
import { useOpenAIGlobal } from '../sdk';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Shout = {
  id?: string;
  message?: string;
  alias?: string;
  user_id?: string;
  created_at?: string;
  expires_at?: string;
};

type ShoutPayload = {
  // For stream_public_shout (submission)
  shout?: Shout;
  success?: boolean;
  
  // For stream_shout_feed (list)
  shouts?: Shout[];
  fetched?: number;
  
  error?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatTime(timestamp?: string): string {
  if (!timestamp) return '';
  try {
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  } catch {
    return '';
  }
}

function formatExpiry(timestamp?: string): string {
  if (!timestamp) return '';
  try {
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = date.getTime() - now;
    if (diff <= 0) return 'expired';
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m left`;
    const hours = Math.floor(mins / 60);
    return `${hours}h left`;
  } catch {
    return '';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Single Shout Card
// ─────────────────────────────────────────────────────────────────────────────

function ShoutCard({ shout, isNew = false }: { shout: Shout; isNew?: boolean }) {
  return (
    <div className={`shout-card ${isNew ? 'shout-card--new' : ''}`}>
      <div className="shout-card__header">
        <span className="shout-card__alias">{shout.alias || 'Anonymous'}</span>
        <span className="shout-card__time">{formatTime(shout.created_at)}</span>
      </div>
      <p className="shout-card__message">{shout.message}</p>
      {shout.expires_at && (
        <span className="shout-card__expiry">{formatExpiry(shout.expires_at)}</span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

function StreamShout() {
  const toolOutput = useOpenAIGlobal('toolOutput') as ShoutPayload | null;

  if (!toolOutput) {
    return (
      <div className="stream-container">
        <div className="stream-loading">
          <div className="stream-loading__spinner" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (toolOutput.error) {
    return (
      <div className="stream-container">
        <div className="stream-error">{toolOutput.error}</div>
      </div>
    );
  }

  // Submission result (single shout)
  if (toolOutput.shout) {
    return (
      <div className="stream-container">
        <div className="stream-card">
          <div className="stream-header">
            <div className="stream-header-left">
              <span className="stream-icon">📣</span>
              <span className="stream-title">Shout Submitted</span>
            </div>
            <span className="stream-badge stream-badge--success">✓ Queued</span>
          </div>
          <ShoutCard shout={toolOutput.shout} isNew={true} />
          <div className="stream-note">
            Your shout will appear on the live stream overlay.
          </div>
        </div>
      </div>
    );
  }

  // Feed result (list of shouts)
  const shouts = toolOutput.shouts || [];
  
  if (shouts.length === 0) {
    return (
      <div className="stream-container">
        <div className="stream-card">
          <div className="stream-header">
            <div className="stream-header-left">
              <span className="stream-icon">📣</span>
              <span className="stream-title">Stream Shouts</span>
            </div>
          </div>
          <div className="stream-empty">No shouts in queue right now.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="stream-container">
      <div className="stream-card">
        <div className="stream-header">
          <div className="stream-header-left">
            <span className="stream-icon">📣</span>
            <span className="stream-title">Stream Shouts</span>
          </div>
          <span className="stream-count">{shouts.length} in queue</span>
        </div>
        <div className="stream-feed">
          {shouts.map((shout, idx) => (
            <ShoutCard key={shout.id || idx} shout={shout} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mount
// ─────────────────────────────────────────────────────────────────────────────

const root = document.getElementById('stream-shout-root');
if (root) {
  createRoot(root).render(<StreamShout />);
}

export default StreamShout;
