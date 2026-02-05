import '../styles/sdk.css';

import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { Badge } from '@openai/apps-sdk-ui/components/Badge';
import { Button } from '@openai/apps-sdk-ui/components/Button';
import { EmptyMessage } from '@openai/apps-sdk-ui/components/EmptyMessage';
import { CreditCard, ChevronDown, ChevronUp, Copy, Check } from '@openai/apps-sdk-ui/components/Icon';
import { useOpenAIGlobal } from '../sdk';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type WalletRecord = {
  address?: string;
  public_key?: string;
  label?: string;
  is_default?: boolean;
  status?: string;
  chain?: string;
  sol?: number;
  usdc?: number;
  usdt?: number;
  totalUsd?: number | string;
  verified?: boolean;
};

type PortfolioPayload = {
  user?: { id?: string; email?: string } | null;
  wallets?: WalletRecord[];
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
// Solana Icon (custom, not in SDK)
// ─────────────────────────────────────────────────────────────────────────────

function SolanaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 128 128" fill="none" className={className}>
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
// Copy Button Component
// ─────────────────────────────────────────────────────────────────────────────

function CopyAddressButton({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = address;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Button
      color="secondary"
      variant="ghost"
      size="xs"
      onClick={handleCopy}
      uniform
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </Button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Wallet Card Component
// ─────────────────────────────────────────────────────────────────────────────

function WalletCard({ wallet, index }: { wallet: WalletRecord; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const address = wallet.address || wallet.public_key || `Wallet ${index + 1}`;
  const label = wallet.label;
  const chain = wallet.chain ?? 'Solana';
  const isDefault = wallet.is_default ?? false;
  const status = wallet.status;
  const hasBalances = wallet.sol !== undefined || wallet.usdc !== undefined || wallet.usdt !== undefined;
  const totalUsd = wallet.totalUsd !== undefined ? formatUsd(wallet.totalUsd) : null;

  return (
    <div
      className={`rounded-xl border p-4 transition-all ${
        isDefault 
          ? 'border-success/30 bg-success/5' 
          : 'border-default bg-surface'
      } ${hasBalances ? 'cursor-pointer hover:border-default-strong' : ''}`}
      onClick={() => hasBalances && setExpanded(!expanded)}
    >
      {/* Header Row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 size-10 rounded-lg bg-surface-tertiary flex items-center justify-center">
            <SolanaIcon className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm text-primary truncate">
                {abbreviate(address)}
              </span>
              <CopyAddressButton address={address} />
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-tertiary">{label || chain}</span>
              {isDefault && (
                <Badge color="success" size="sm" variant="soft">Default</Badge>
              )}
              {status && (
                <span className={`size-2 rounded-full ${status === 'active' ? 'bg-success' : 'bg-secondary'}`} />
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {totalUsd && (
            <span className="font-semibold text-sm text-primary">{totalUsd}</span>
          )}
          {hasBalances && (
            <div className="text-tertiary">
              {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </div>
          )}
        </div>
      </div>

      {/* Expanded Balances */}
      {expanded && hasBalances && (
        <div className="mt-4 pt-4 border-t border-subtle grid grid-cols-3 gap-4">
          {wallet.sol !== undefined && (
            <div>
              <div className="text-xs text-tertiary uppercase tracking-wide">SOL</div>
              <div className="text-sm font-medium text-primary mt-0.5">{formatToken(wallet.sol)}</div>
            </div>
          )}
          {wallet.usdc !== undefined && (
            <div>
              <div className="text-xs text-tertiary uppercase tracking-wide">USDC</div>
              <div className="text-sm font-medium text-primary mt-0.5">{formatToken(wallet.usdc)}</div>
            </div>
          )}
          {wallet.usdt !== undefined && (
            <div>
              <div className="text-xs text-tertiary uppercase tracking-wide">USDT</div>
              <div className="text-sm font-medium text-primary mt-0.5">{formatToken(wallet.usdt)}</div>
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

  // Loading state
  if (!toolOutput) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-center gap-3 py-8">
          <div className="size-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-secondary text-sm">Loading portfolio...</span>
        </div>
      </div>
    );
  }

  const wallets = Array.isArray(toolOutput.wallets) ? toolOutput.wallets : [];
  const totalUsd = toolOutput.totalUsd !== undefined ? formatUsd(toolOutput.totalUsd) : null;
  const updatedAt = toolOutput.updatedAt;
  const defaultWallet = wallets.find(w => w.is_default);
  const hasBalanceData = wallets.some(w => w.totalUsd !== undefined || w.sol !== undefined);

  // Empty state
  if (wallets.length === 0) {
    return (
      <div className="p-4">
        <EmptyMessage fill="none">
          <EmptyMessage.Icon>
            <CreditCard className="size-8" />
          </EmptyMessage.Icon>
          <EmptyMessage.Title>No wallets linked</EmptyMessage.Title>
          <EmptyMessage.Description>
            Link a wallet to see your portfolio and start trading.
          </EmptyMessage.Description>
        </EmptyMessage>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header Card */}
      <div className="rounded-xl border border-default bg-surface p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="size-5 text-secondary" />
            <h2 className="font-semibold text-base text-primary">Linked Wallets</h2>
            <Badge color="secondary" size="sm" variant="soft">
              {wallets.length}
            </Badge>
          </div>
          {updatedAt && (
            <span className="text-xs text-tertiary">
              Updated {formatTimestamp(updatedAt)}
            </span>
          )}
        </div>

        {/* Total Value */}
        {hasBalanceData && totalUsd && (
          <div className="mt-4 pt-4 border-t border-subtle">
            <div className="text-xs text-tertiary uppercase tracking-wide">Total Value</div>
            <div className="text-2xl font-bold text-primary mt-1">{totalUsd}</div>
          </div>
        )}

        {/* Default Wallet Quick Info */}
        {defaultWallet && !hasBalanceData && (
          <div className="mt-4 pt-4 border-t border-subtle flex items-center gap-2">
            <span className="size-2 rounded-full bg-success" />
            <span className="text-sm text-secondary">Active:</span>
            <code className="text-xs text-primary bg-surface-secondary px-2 py-0.5 rounded">
              {abbreviate(defaultWallet.address || defaultWallet.public_key || '')}
            </code>
          </div>
        )}
      </div>

      {/* Wallet List */}
      <div className="space-y-3">
        {wallets.map((wallet, index) => (
          <WalletCard key={wallet.address || index} wallet={wallet} index={index} />
        ))}
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
