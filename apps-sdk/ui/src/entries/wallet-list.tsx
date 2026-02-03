import '../styles/global.css';

import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { useOpenAIGlobal } from '../sdk';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type WalletRecord = {
  address?: string;
  public_key?: string;
  label?: string;
  status?: string;
  is_default?: boolean;
};

type WalletListPayload = {
  user?: { id?: string };
  wallets?: WalletRecord[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function pickAddress(wallet: WalletRecord): string | null {
  if (wallet.address && wallet.address.trim().length > 0) return wallet.address.trim();
  if (wallet.public_key && wallet.public_key.trim().length > 0) return wallet.public_key.trim();
  return null;
}

function abbreviate(value: string, len = 6): string {
  if (value.length <= len * 2 + 3) return value;
  return `${value.slice(0, len)}…${value.slice(-4)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

function WalletList() {
  const toolOutput = useOpenAIGlobal('toolOutput') as WalletListPayload | WalletRecord[] | null;
  const [showAll, setShowAll] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  // Loading
  if (!toolOutput) {
    return (
      <div className="wallet-list-container">
        <div className="wallet-list-loading">
          <div className="wallet-list-loading__spinner" />
          <span>Loading wallets...</span>
        </div>
      </div>
    );
  }

  // Normalize payload
  const payload = toolOutput as WalletListPayload;
  const wallets: WalletRecord[] = Array.isArray(payload.wallets)
    ? payload.wallets
    : Array.isArray(toolOutput)
      ? toolOutput
      : [];

  // Empty
  if (wallets.length === 0) {
    return (
      <div className="wallet-list-container">
        <div className="wallet-list-empty">No linked wallets found.</div>
      </div>
    );
  }

  const visibleWallets = showAll ? wallets : wallets.slice(0, 6);
  const hiddenCount = wallets.length - visibleWallets.length;

  return (
    <div className="wallet-list-container">
      {/* Header */}
      <div className="wallet-list-header">
        <span className="wallet-list-title">Linked Wallets</span>
        <span className="wallet-list-count">{wallets.length} wallet{wallets.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Grid */}
      <div className="wallet-list-grid">
        {visibleWallets.map((wallet, index) => {
          const address = pickAddress(wallet);
          const label = typeof wallet.label === 'string' && wallet.label.trim().length > 0 
            ? wallet.label.trim() 
            : null;
          const isDefault = Boolean(wallet.is_default);
          const displayLabel = label ?? (address ? `Wallet ${index + 1}` : 'Unknown Wallet');
          const isExpanded = expandedIndex === index;

          return (
            <div
              key={address ?? `wallet-${index}`}
              className={`wallet-list-card ${isExpanded ? 'wallet-list-card--expanded' : ''} ${isDefault ? 'wallet-list-card--default' : ''}`}
              onClick={() => setExpandedIndex(isExpanded ? null : index)}
            >
              <div className="wallet-list-card__header">
                {/* Icon */}
                <div className={`wallet-list-card__icon ${isDefault ? 'wallet-list-card__icon--default' : ''}`}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>

                <div className="wallet-list-card__info">
                  <div className="wallet-list-card__label-row">
                    <span className="wallet-list-card__label">{displayLabel}</span>
                    {isDefault && (
                      <span className="wallet-list-card__default-badge">Default</span>
                    )}
                  </div>

                  {address && (
                    <a
                      href={`https://solscan.io/account/${address}`}
                      target="_blank"
                      rel="noreferrer"
                      className="wallet-list-card__address"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isExpanded ? address : abbreviate(address, 6)}
                    </a>
                  )}
                </div>
              </div>

              {isExpanded && address && (
                <div className="wallet-list-card__actions">
                  <a
                    href={`https://solscan.io/account/${address}`}
                    target="_blank"
                    rel="noreferrer"
                    className="wallet-list-card__action"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Solscan
                  </a>
                  <a
                    href={`https://explorer.solana.com/address/${address}`}
                    target="_blank"
                    rel="noreferrer"
                    className="wallet-list-card__action"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Explorer
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Show More */}
      {hiddenCount > 0 && (
        <button className="wallet-list-show-more" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Collapse List' : `Show ${hiddenCount} more wallets`}
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mount
// ─────────────────────────────────────────────────────────────────────────────

const root = document.getElementById('wallet-list-root');
if (root) {
  createRoot(root).render(<WalletList />);
}

export default WalletList;
