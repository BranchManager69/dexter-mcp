import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/shield.css';

import { createRoot } from 'react-dom/client';
import { useOpenAIGlobal } from '../sdk';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ShieldPayload = {
  id?: string;
  shield_id?: string;
  status?: 'pending' | 'active' | 'expired' | 'cancelled';
  type?: string;
  mint?: string;
  symbol?: string;
  coverage?: {
    amount?: number;
    currency?: string;
    percentage?: number;
  };
  premium?: {
    amount?: number;
    currency?: string;
  };
  expiresAt?: string;
  expires_at?: string;
  createdAt?: string;
  created_at?: string;
  protectedValue?: number;
  protected_value?: number;
  claimable?: boolean;
  error?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatMoney(value?: number, currency = 'USD'): string {
  if (!value || !Number.isFinite(value)) return '—';
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(timestamp?: string): string {
  if (!timestamp) return '—';
  try {
    return new Date(timestamp).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return '—';
  }
}

function getStatusClass(status?: string): string {
  switch (status) {
    case 'active': return 'shield-status--active';
    case 'pending': return 'shield-status--pending';
    case 'expired': return 'shield-status--expired';
    case 'cancelled': return 'shield-status--cancelled';
    default: return '';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

function Shield() {
  const toolOutput = useOpenAIGlobal('toolOutput') as ShieldPayload | null;

  if (!toolOutput) {
    return (
      <div className="shield-container">
        <div className="shield-loading">
          <div className="shield-loading__spinner" />
          <span>Creating shield...</span>
        </div>
      </div>
    );
  }

  if (toolOutput.error) {
    return (
      <div className="shield-container">
        <div className="shield-error">{toolOutput.error}</div>
      </div>
    );
  }

  const id = toolOutput.id || toolOutput.shield_id;
  const expires = toolOutput.expiresAt || toolOutput.expires_at;
  const created = toolOutput.createdAt || toolOutput.created_at;
  const protectedValue = toolOutput.protectedValue || toolOutput.protected_value;

  return (
    <div className="shield-container">
      <div className="shield-card">
        {/* Header */}
        <div className="shield-header">
          <div className="shield-header-left">
            <span className="shield-icon">🛡️</span>
            <span className="shield-title">Protection Shield</span>
          </div>
          {toolOutput.status && (
            <span className={`shield-badge ${getStatusClass(toolOutput.status)}`}>
              {toolOutput.status.toUpperCase()}
            </span>
          )}
        </div>

        {/* Token Info */}
        {toolOutput.symbol && (
          <div className="shield-token">
            <span className="shield-token__symbol">{toolOutput.symbol}</span>
            {toolOutput.type && <span className="shield-token__type">{toolOutput.type}</span>}
          </div>
        )}

        {/* Coverage Summary */}
        <div className="shield-coverage">
          <div className="shield-coverage__item">
            <span className="shield-coverage__label">Protected Value</span>
            <span className="shield-coverage__value">{formatMoney(protectedValue)}</span>
          </div>
          {toolOutput.coverage && (
            <div className="shield-coverage__item">
              <span className="shield-coverage__label">Coverage</span>
              <span className="shield-coverage__value">
                {toolOutput.coverage.percentage 
                  ? `${toolOutput.coverage.percentage}%` 
                  : formatMoney(toolOutput.coverage.amount)}
              </span>
            </div>
          )}
          {toolOutput.premium && (
            <div className="shield-coverage__item">
              <span className="shield-coverage__label">Premium</span>
              <span className="shield-coverage__value shield-coverage__value--premium">
                {formatMoney(toolOutput.premium.amount)}
              </span>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="shield-details">
          {id && (
            <div className="shield-detail">
              <span className="shield-detail__label">Shield ID</span>
              <span className="shield-detail__value">{id.slice(0, 8)}...{id.slice(-4)}</span>
            </div>
          )}
          {created && (
            <div className="shield-detail">
              <span className="shield-detail__label">Created</span>
              <span className="shield-detail__value">{formatDate(created)}</span>
            </div>
          )}
          {expires && (
            <div className="shield-detail">
              <span className="shield-detail__label">Expires</span>
              <span className="shield-detail__value">{formatDate(expires)}</span>
            </div>
          )}
        </div>

        {/* Claimable */}
        {toolOutput.claimable && (
          <div className="shield-claimable">
            ✓ This shield is claimable
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mount
// ─────────────────────────────────────────────────────────────────────────────

const root = document.getElementById('shield-root');
if (root) {
  createRoot(root).render(<Shield />);
}

export default Shield;
