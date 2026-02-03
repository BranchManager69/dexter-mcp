import '../styles/global.css';

import { createRoot } from 'react-dom/client';
import { useOpenAIGlobal } from '../sdk';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ResolvedWallet = {
  address?: string;
  walletAddress?: string;
  chain?: string;
  source?: string;
  resolvedVia?: string;
  verified?: boolean;
  linkedAt?: string | number;
  handle?: string;
  twitter?: string;
};

type ResolveWalletPayload = {
  result?: ResolvedWallet;
} & ResolvedWallet;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function pickString(...values: (string | null | undefined)[]): string | undefined {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

function abbreviate(value: string, prefix = 6, suffix = 4): string {
  if (value.length <= prefix + suffix + 3) return value;
  return `${value.slice(0, prefix)}…${value.slice(-suffix)}`;
}

function formatTimestamp(value?: string | number): string {
  if (!value) return '';
  const date = new Date(value);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Solana Icon
// ─────────────────────────────────────────────────────────────────────────────

function SolanaIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" fill="none">
      <defs>
        <linearGradient id="sol-wallet-grad" x1="90%" y1="0%" x2="10%" y2="100%">
          <stop offset="0%" stopColor="#00FFA3" />
          <stop offset="100%" stopColor="#DC1FFF" />
        </linearGradient>
      </defs>
      <path d="M25.3 93.5c0.9-0.9 2.2-1.5 3.5-1.5h97.1c2.2 0 3.4 2.7 1.8 4.3l-24.2 24.2c-0.9 0.9-2.2 1.5-3.5 1.5H2.9c-2.2 0-3.4-2.7-1.8-4.3L25.3 93.5z" fill="url(#sol-wallet-grad)" />
      <path d="M25.3 2.5c1-1 2.3-1.5 3.5-1.5h97.1c2.2 0 3.4 2.7 1.8 4.3L103.5 29.5c-0.9 0.9-2.2 1.5-3.5 1.5H2.9c-2.2 0-3.4-2.7-1.8-4.3L25.3 2.5z" fill="url(#sol-wallet-grad)" />
      <path d="M102.7 47.3c-0.9-0.9-2.2-1.5-3.5-1.5H2.1c-2.2 0-3.4 2.7-1.8 4.3l24.2 24.2c0.9 0.9 2.2 1.5 3.5 1.5h97.1c2.2 0 3.4-2.7 1.8-4.3L102.7 47.3z" fill="url(#sol-wallet-grad)" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chain Icon
// ─────────────────────────────────────────────────────────────────────────────

function ChainIcon({ chain, size = 40 }: { chain: string; size?: number }) {
  const chainLower = chain.toLowerCase();
  
  if (chainLower === 'solana' || chainLower === 'sol') {
    return <SolanaIcon size={size} />;
  }
  
  // Fallback for other chains
  return (
    <div className="wallet-chain-icon" style={{ width: size, height: size }}>
      <span style={{ fontSize: size * 0.4 }}>{chain.slice(0, 2).toUpperCase()}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

function ResolveWallet() {
  const toolOutput = useOpenAIGlobal('toolOutput') as ResolveWalletPayload | null;

  // Loading
  if (!toolOutput) {
    return (
      <div className="wallet-container">
        <div className="wallet-loading">
          <div className="wallet-loading__spinner" />
          <span>Resolving wallet...</span>
        </div>
      </div>
    );
  }

  // Normalize data
  const resolved = toolOutput.result ?? toolOutput;
  const address = pickString(resolved.address, resolved.walletAddress);
  const chain = pickString(resolved.chain) ?? 'solana';
  const source = pickString(resolved.source, resolved.resolvedVia) ?? 'unknown';
  const verified = resolved.verified ?? false;
  const linkedAt = resolved.linkedAt;
  const handle = pickString(resolved.handle, resolved.twitter);

  // No address found
  if (!address) {
    return (
      <div className="wallet-container">
        <div className="wallet-card wallet-card--error">
          <div className="wallet-card__header">
            <span className="wallet-card__title">Wallet Resolution</span>
            <span className="wallet-status-badge wallet-status-badge--error">
              <span className="wallet-status-badge__icon">✕</span>
              Not Found
            </span>
          </div>
          <div className="wallet-card__empty">No wallet address could be resolved.</div>
        </div>
      </div>
    );
  }

  const explorerUrl = chain.toLowerCase() === 'solana' 
    ? `https://solscan.io/account/${address}` 
    : null;

  return (
    <div className="wallet-container">
      <div className={`wallet-card ${verified ? 'wallet-card--verified' : 'wallet-card--unverified'}`}>
        {/* Glow effect for verified */}
        {verified && <div className="wallet-card__glow wallet-card__glow--verified" />}

        {/* Header */}
        <div className="wallet-card__header">
          <span className="wallet-card__title">Wallet Resolution</span>
          <span className={`wallet-status-badge ${verified ? 'wallet-status-badge--success' : 'wallet-status-badge--warning'}`}>
            <span className="wallet-status-badge__icon">{verified ? '✓' : '?'}</span>
            {verified ? 'Verified' : 'Unverified'}
          </span>
        </div>

        {/* Main Content */}
        <div className="wallet-card__main">
          <ChainIcon chain={chain} size={48} />
          
          <div className="wallet-card__info">
            <div className="wallet-card__address-row">
              <span className="wallet-card__address">{abbreviate(address, 8, 6)}</span>
              {handle && <span className="wallet-card__handle">@{handle.replace('@', '')}</span>}
            </div>
            <div className="wallet-card__meta">
              <span className="wallet-card__chain">{chain.charAt(0).toUpperCase() + chain.slice(1)}</span>
              <span className="wallet-card__separator">•</span>
              <span className="wallet-card__source">via {source}</span>
              {linkedAt && (
                <>
                  <span className="wallet-card__separator">•</span>
                  <span className="wallet-card__date">{formatTimestamp(linkedAt)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Warning for unverified */}
        {!verified && (
          <div className="wallet-card__warning">
            <span className="wallet-card__warning-icon">⚠</span>
            <span className="wallet-card__warning-text">
              This wallet is not verified. Consider verifying ownership before proceeding.
            </span>
          </div>
        )}

        {/* Footer */}
        <div className="wallet-card__footer">
          <span className="wallet-card__full-address" title={address}>{address}</span>
          {explorerUrl && (
            <a href={explorerUrl} target="_blank" rel="noreferrer" className="wallet-card__link">
              View on Solscan ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mount
// ─────────────────────────────────────────────────────────────────────────────

const root = document.getElementById('resolve-wallet-root');
if (root) {
  createRoot(root).render(<ResolveWallet />);
}

export default ResolveWallet;
