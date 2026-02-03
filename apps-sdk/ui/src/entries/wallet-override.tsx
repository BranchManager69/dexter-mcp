import '../styles/global.css';

import { createRoot } from 'react-dom/client';
import { useOpenAIGlobal } from '../sdk';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type OverridePayload = {
  ok?: boolean;
  cleared?: boolean;
  wallet_address?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

function WalletOverride() {
  const toolOutput = useOpenAIGlobal('toolOutput') as OverridePayload | null;

  // Loading
  if (!toolOutput) {
    return (
      <div className="wallet-override-container">
        <div className="wallet-override-loading">
          <div className="wallet-override-loading__spinner" />
          <span>Processing override...</span>
        </div>
      </div>
    );
  }

  const cleared = Boolean(toolOutput.cleared);
  const ok = Boolean(toolOutput.ok);
  const walletAddress = toolOutput.wallet_address;

  const statusLabel = cleared ? 'OVERRIDE CLEARED' : ok ? 'OVERRIDE ACTIVE' : 'OVERRIDE FAILED';
  const statusClass = cleared ? 'neutral' : ok ? 'success' : 'error';

  return (
    <div className="wallet-override-container">
      <div className="wallet-override-card">
        {/* Header */}
        <div className="wallet-override-header">
          <span className="wallet-override-title">Session Control</span>
        </div>

        {/* Main Section */}
        <div className="wallet-override-main">
          {/* Status Icon */}
          <div className={`wallet-override-icon wallet-override-icon--${statusClass}`}>
            {cleared ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            ) : ok ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            )}
          </div>

          <div className="wallet-override-info">
            <span className={`wallet-override-status wallet-override-status--${statusClass}`}>
              {statusLabel}
            </span>

            {cleared ? (
              <span className="wallet-override-description">Session reverted to default resolver.</span>
            ) : walletAddress ? (
              <a
                href={`https://solscan.io/account/${walletAddress}`}
                target="_blank"
                rel="noreferrer"
                className="wallet-override-address"
              >
                {walletAddress}
              </a>
            ) : (
              <span className="wallet-override-description">No wallet address provided.</span>
            )}
          </div>
        </div>

        {/* Links */}
        {walletAddress && !cleared && (
          <div className="wallet-override-links">
            <a
              href={`https://solscan.io/account/${walletAddress}`}
              target="_blank"
              rel="noreferrer"
              className="wallet-override-link"
            >
              Solscan
            </a>
            <a
              href={`https://explorer.solana.com/address/${walletAddress}`}
              target="_blank"
              rel="noreferrer"
              className="wallet-override-link"
            >
              Explorer
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mount
// ─────────────────────────────────────────────────────────────────────────────

const root = document.getElementById('wallet-override-root');
if (root) {
  createRoot(root).render(<WalletOverride />);
}

export default WalletOverride;
