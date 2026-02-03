import '../styles/global.css';

import { createRoot } from 'react-dom/client';
import { useOpenAIGlobal } from '../sdk';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Diagnostics = {
  bearer_source?: string;
  has_token?: boolean;
  override_session?: string;
  detail?: string;
  wallets_cached?: number;
};

type AuthPayload = {
  wallet_address?: string;
  user_id?: string;
  source?: string;
  diagnostics?: Diagnostics;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function abbreviate(value: string, len = 8): string {
  if (value.length <= len * 2 + 3) return value;
  return `${value.slice(0, len)}…${value.slice(-4)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

function WalletAuth() {
  const toolOutput = useOpenAIGlobal('toolOutput') as AuthPayload | null;

  // Loading
  if (!toolOutput) {
    return (
      <div className="wallet-auth-container">
        <div className="wallet-auth-loading">
          <div className="wallet-auth-loading__spinner" />
          <span>Loading auth info...</span>
        </div>
      </div>
    );
  }

  const diagnostics = toolOutput.diagnostics ?? {};

  // Build diagnostic chips
  const chips: { label: string; value: string; tone?: 'neutral' | 'positive' | 'negative' | 'notice' }[] = [];
  if (toolOutput.source) chips.push({ label: 'Source', value: toolOutput.source });
  if (diagnostics.bearer_source) chips.push({ label: 'Bearer', value: diagnostics.bearer_source });
  if (diagnostics.override_session) chips.push({ label: 'Override', value: diagnostics.override_session, tone: 'notice' });
  if (diagnostics.wallets_cached !== undefined) chips.push({ label: 'Cached', value: String(diagnostics.wallets_cached) });
  if (diagnostics.has_token !== undefined) chips.push({ 
    label: 'Token', 
    value: diagnostics.has_token ? 'Present' : 'Missing', 
    tone: diagnostics.has_token ? 'positive' : 'negative' 
  });

  return (
    <div className="wallet-auth-container">
      <div className="wallet-auth-card">
        {/* Header */}
        <div className="wallet-auth-header">
          <span className="wallet-auth-title">Auth Diagnostics</span>
        </div>

        {/* Main Section */}
        <div className="wallet-auth-main">
          <div className="wallet-auth-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>

          <div className="wallet-auth-info">
            <span className="wallet-auth-label">Session Wallet</span>
            {toolOutput.wallet_address ? (
              <a
                href={`https://solscan.io/account/${toolOutput.wallet_address}`}
                target="_blank"
                rel="noreferrer"
                className="wallet-auth-address"
              >
                {toolOutput.wallet_address}
              </a>
            ) : (
              <span className="wallet-auth-no-wallet">No wallet bound to this session.</span>
            )}
          </div>
        </div>

        {/* User ID */}
        {toolOutput.user_id && (
          <div className="wallet-auth-user">
            <span className="wallet-auth-user-label">Supabase User</span>
            <span className="wallet-auth-user-id">{abbreviate(toolOutput.user_id, 8)}</span>
          </div>
        )}

        {/* Diagnostic Chips */}
        {chips.length > 0 && (
          <div className="wallet-auth-chips">
            {chips.map((chip, idx) => (
              <div
                key={`${chip.label}-${idx}`}
                className={`wallet-auth-chip ${chip.tone === 'notice' ? 'wallet-auth-chip--notice' : ''} ${chip.tone === 'positive' ? 'wallet-auth-chip--positive' : ''} ${chip.tone === 'negative' ? 'wallet-auth-chip--negative' : ''}`}
              >
                <span className="wallet-auth-chip__label">{chip.label.toUpperCase()}</span>
                <span className="wallet-auth-chip__value">{chip.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Detail */}
        {diagnostics.detail && (
          <div className="wallet-auth-detail">
            {diagnostics.detail}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mount
// ─────────────────────────────────────────────────────────────────────────────

const root = document.getElementById('wallet-auth-root');
if (root) {
  createRoot(root).render(<WalletAuth />);
}

export default WalletAuth;
