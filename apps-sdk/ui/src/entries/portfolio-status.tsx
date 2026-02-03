import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/portfolio-status.css';

import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { useOpenAIGlobal } from '../sdk';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type WalletBalance = {
  address?: string;
  chain?: string;
  sol?: number;
  usdc?: number;
  usdt?: number;
  totalUsd?: number | string;
  verified?: boolean;
};

type PortfolioPayload = {
  wallets?: WalletBalance[];
  totalUsd?: string | number;
  updatedAt?: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function pickNumber(...values: (number | string | null | undefined)[]): number | undefined {
  for (const v of values) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

function formatUsd(value?: number | string): string {
  const num = pickNumber(value);
  if (num === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(num);
}

function formatToken(value?: number, symbol?: string): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  const formatted = value.toLocaleString('en-US', { maximumFractionDigits: 4 });
  return symbol ? `${formatted} ${symbol}` : formatted;
}

function abbreviate(value: string, prefix = 6, suffix = 4): string {
  if (!value) return '—';
  if (value.length <= prefix + suffix + 3) return value;
  return `${value.slice(0, prefix)}…${value.slice(-suffix)}`;
}

function formatTimestamp(value?: number): string {
  if (!value) return '';
  const date = new Date(value);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Solana Icon
// ─────────────────────────────────────────────────────────────────────────────

function SolanaIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" fill="none">
      <defs>
        <linearGradient id="sol-port-grad" x1="90%" y1="0%" x2="10%" y2="100%">
          <stop offset="0%" stopColor="#00FFA3" />
          <stop offset="100%" stopColor="#DC1FFF" />
        </linearGradient>
      </defs>
      <path d="M25.3 93.5c0.9-0.9 2.2-1.5 3.5-1.5h97.1c2.2 0 3.4 2.7 1.8 4.3l-24.2 24.2c-0.9 0.9-2.2 1.5-3.5 1.5H2.9c-2.2 0-3.4-2.7-1.8-4.3L25.3 93.5z" fill="url(#sol-port-grad)" />
      <path d="M25.3 2.5c1-1 2.3-1.5 3.5-1.5h97.1c2.2 0 3.4 2.7 1.8 4.3L103.5 29.5c-0.9 0.9-2.2 1.5-3.5 1.5H2.9c-2.2 0-3.4-2.7-1.8-4.3L25.3 2.5z" fill="url(#sol-port-grad)" />
      <path d="M102.7 47.3c-0.9-0.9-2.2-1.5-3.5-1.5H2.1c-2.2 0-3.4 2.7-1.8 4.3l24.2 24.2c0.9 0.9 2.2 1.5 3.5 1.5h97.1c2.2 0 3.4-2.7 1.8-4.3L102.7 47.3z" fill="url(#sol-port-grad)" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Wallet Card Component
// ─────────────────────────────────────────────────────────────────────────────

function WalletCard({ wallet, index }: { wallet: WalletBalance; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const address = wallet.address ?? `Wallet ${index + 1}`;
  const chain = wallet.chain ?? 'Solana';
  const verified = wallet.verified ?? false;
  const totalUsd = formatUsd(wallet.totalUsd);

  return (
    <div 
      className={`portfolio-wallet ${verified ? 'portfolio-wallet--verified' : ''}`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="portfolio-wallet__header">
        <div className="portfolio-wallet__info">
          <div className="portfolio-wallet__chain-icon">
            <SolanaIcon size={20} />
          </div>
          <div className="portfolio-wallet__details">
            <span className="portfolio-wallet__address">{abbreviate(address)}</span>
            <span className="portfolio-wallet__chain">{chain}</span>
          </div>
        </div>
        <div className="portfolio-wallet__value">
          <span className="portfolio-wallet__total">{totalUsd}</span>
          {verified && <span className="portfolio-wallet__verified-badge">✓</span>}
        </div>
      </div>

      {expanded && (
        <div className="portfolio-wallet__balances">
          {wallet.sol !== undefined && (
            <div className="portfolio-wallet__balance">
              <span className="portfolio-wallet__balance-label">SOL</span>
              <span className="portfolio-wallet__balance-value">{formatToken(wallet.sol)}</span>
            </div>
          )}
          {wallet.usdc !== undefined && (
            <div className="portfolio-wallet__balance">
              <span className="portfolio-wallet__balance-label">USDC</span>
              <span className="portfolio-wallet__balance-value">{formatToken(wallet.usdc)}</span>
            </div>
          )}
          {wallet.usdt !== undefined && (
            <div className="portfolio-wallet__balance">
              <span className="portfolio-wallet__balance-label">USDT</span>
              <span className="portfolio-wallet__balance-value">{formatToken(wallet.usdt)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

function PortfolioStatus() {
  const toolOutput = useOpenAIGlobal('toolOutput') as PortfolioPayload | null;

  // Loading
  if (!toolOutput) {
    return (
      <div className="portfolio-container">
        <div className="portfolio-loading">
          <div className="portfolio-loading__spinner" />
          <span>Loading portfolio...</span>
        </div>
      </div>
    );
  }

  const wallets = Array.isArray(toolOutput.wallets) ? toolOutput.wallets : [];
  const totalUsd = formatUsd(toolOutput.totalUsd);
  const updatedAt = toolOutput.updatedAt;
  const hasUnverified = wallets.some(w => !w.verified);

  // Empty state
  if (wallets.length === 0) {
    return (
      <div className="portfolio-container">
        <div className="portfolio-card">
          <div className="portfolio-card__header">
            <span className="portfolio-card__title">Portfolio Overview</span>
          </div>
          <div className="portfolio-empty">
            <span className="portfolio-empty__icon">📭</span>
            <span className="portfolio-empty__text">No wallets linked</span>
            <span className="portfolio-empty__hint">Link a wallet to see your portfolio</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="portfolio-container">
      <div className="portfolio-card">
        {/* Header with Total */}
        <div className="portfolio-card__header">
          <div className="portfolio-card__title-row">
            <span className="portfolio-card__title">Portfolio Overview</span>
            {updatedAt && (
              <span className="portfolio-card__time">Updated {formatTimestamp(updatedAt)}</span>
            )}
          </div>
          <div className="portfolio-card__total-row">
            <span className="portfolio-card__total-label">Total Value</span>
            <span className="portfolio-card__total-value">{totalUsd}</span>
          </div>
        </div>

        {/* Warning for unverified */}
        {hasUnverified && (
          <div className="portfolio-card__warning">
            <span className="portfolio-card__warning-icon">⚠</span>
            <span className="portfolio-card__warning-text">
              Some wallets are not verified. Deposits may fail until verified.
            </span>
          </div>
        )}

        {/* Wallet List */}
        <div className="portfolio-wallets">
          {wallets.map((wallet, index) => (
            <WalletCard key={wallet.address || index} wallet={wallet} index={index} />
          ))}
        </div>

        {/* Footer */}
        <div className="portfolio-card__footer">
          <span className="portfolio-card__count">{wallets.length} wallet{wallets.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mount
// ─────────────────────────────────────────────────────────────────────────────

const root = document.getElementById('portfolio-status-root');
if (root) {
  createRoot(root).render(<PortfolioStatus />);
}

export default PortfolioStatus;
