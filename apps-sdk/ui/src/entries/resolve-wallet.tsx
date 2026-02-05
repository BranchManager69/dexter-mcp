import '../styles/sdk.css';

import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { Badge } from '@openai/apps-sdk-ui/components/Badge';
import { Button } from '@openai/apps-sdk-ui/components/Button';
import { Alert } from '@openai/apps-sdk-ui/components/Alert';
import { EmptyMessage } from '@openai/apps-sdk-ui/components/EmptyMessage';
import { Check, Warning, ExternalLink, Copy, CreditCard } from '@openai/apps-sdk-ui/components/Icon';
import { useOpenAIGlobal } from '../sdk';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ResolvedWallet = {
  address?: string;
  walletAddress?: string;
  wallet_address?: string;
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
// Solana Icon (custom)
// ─────────────────────────────────────────────────────────────────────────────

function SolanaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 128 128" fill="none" className={className}>
      <defs>
        <linearGradient id="sol-resolve-grad" x1="90%" y1="0%" x2="10%" y2="100%">
          <stop offset="0%" stopColor="#00FFA3" />
          <stop offset="100%" stopColor="#DC1FFF" />
        </linearGradient>
      </defs>
      <path d="M25.3 93.5c0.9-0.9 2.2-1.5 3.5-1.5h97.1c2.2 0 3.4 2.7 1.8 4.3l-24.2 24.2c-0.9 0.9-2.2 1.5-3.5 1.5H2.9c-2.2 0-3.4-2.7-1.8-4.3L25.3 93.5z" fill="url(#sol-resolve-grad)" />
      <path d="M25.3 2.5c1-1 2.3-1.5 3.5-1.5h97.1c2.2 0 3.4 2.7 1.8 4.3L103.5 29.5c-0.9 0.9-2.2 1.5-3.5 1.5H2.9c-2.2 0-3.4-2.7-1.8-4.3L25.3 2.5z" fill="url(#sol-resolve-grad)" />
      <path d="M102.7 47.3c-0.9-0.9-2.2-1.5-3.5-1.5H2.1c-2.2 0-3.4 2.7-1.8 4.3l24.2 24.2c0.9 0.9 2.2 1.5 3.5 1.5h97.1c2.2 0 3.4-2.7 1.8-4.3L102.7 47.3z" fill="url(#sol-resolve-grad)" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chain Icon
// ─────────────────────────────────────────────────────────────────────────────

function ChainIcon({ chain, className }: { chain: string; className?: string }) {
  const chainLower = chain.toLowerCase();
  
  if (chainLower === 'solana' || chainLower === 'sol') {
    return <SolanaIcon className={className} />;
  }
  
  // Fallback for other chains
  return (
    <div className={`flex items-center justify-center rounded-lg bg-surface-secondary ${className}`}>
      <span className="text-sm font-bold text-secondary">{chain.slice(0, 2).toUpperCase()}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Copy Button
// ─────────────────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Button color="secondary" variant="ghost" size="xs" onClick={handleCopy} uniform>
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </Button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

function ResolveWallet() {
  const toolOutput = useOpenAIGlobal('toolOutput') as ResolveWalletPayload | null;

  // Loading state
  if (!toolOutput) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-center gap-3 py-8">
          <div className="size-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-secondary text-sm">Resolving wallet...</span>
        </div>
      </div>
    );
  }

  // Normalize data
  const resolved = toolOutput.result ?? toolOutput;
  const address = pickString(resolved.address, resolved.walletAddress, resolved.wallet_address);
  const chain = pickString(resolved.chain) ?? 'solana';
  const source = pickString(resolved.source, resolved.resolvedVia) ?? 'unknown';
  const verified = resolved.verified ?? false;
  const linkedAt = resolved.linkedAt;
  const handle = pickString(resolved.handle, resolved.twitter);

  // Not found state
  if (!address) {
    return (
      <div className="p-4">
        <EmptyMessage fill="none">
          <EmptyMessage.Icon>
            <CreditCard className="size-8" />
          </EmptyMessage.Icon>
          <EmptyMessage.Title>Wallet Not Found</EmptyMessage.Title>
          <EmptyMessage.Description>
            No wallet address could be resolved for this request.
          </EmptyMessage.Description>
        </EmptyMessage>
      </div>
    );
  }

  const chainName = chain.charAt(0).toUpperCase() + chain.slice(1);
  const explorerUrl = chain.toLowerCase() === 'solana' 
    ? `https://solscan.io/account/${address}` 
    : null;

  return (
    <div className="p-4 space-y-4">
      {/* Main Card */}
      <div className={`rounded-xl border p-4 ${
        verified 
          ? 'border-success/30 bg-success/5' 
          : 'border-warning/30 bg-warning/5'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-base text-primary">Wallet Resolution</h2>
          <Badge 
            color={verified ? 'success' : 'warning'} 
            size="sm" 
            variant="soft"
          >
            {verified ? (
              <span className="flex items-center gap-1">
                <Check className="size-3" />
                Verified
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Warning className="size-3" />
                Unverified
              </span>
            )}
          </Badge>
        </div>

        {/* Wallet Info */}
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 size-12 rounded-xl bg-surface-tertiary flex items-center justify-center overflow-hidden">
            <ChainIcon chain={chain} className="size-8" />
          </div>
          
          <div className="flex-1 min-w-0">
            {/* Address Row */}
            <div className="flex items-center gap-2">
              <code className="font-mono text-sm font-medium text-primary">
                {abbreviate(address, 8, 6)}
              </code>
              <CopyButton text={address} />
            </div>

            {/* Handle if present */}
            {handle && (
              <div className="mt-1">
                <span className="text-sm text-accent">@{handle.replace('@', '')}</span>
              </div>
            )}

            {/* Meta row */}
            <div className="flex items-center gap-2 mt-2 text-xs text-tertiary">
              <span className="font-medium">{chainName}</span>
              <span>•</span>
              <span>via {source}</span>
              {linkedAt && (
                <>
                  <span>•</span>
                  <span>{formatTimestamp(linkedAt)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Full Address */}
        <div className="mt-4 pt-4 border-t border-subtle">
          <div className="flex items-center justify-between gap-2">
            <code className="text-xs text-tertiary font-mono truncate flex-1" title={address}>
              {address}
            </code>
            {explorerUrl && (
              <a 
                href={explorerUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex-shrink-0"
              >
                <Button color="secondary" variant="soft" size="xs">
                  <span className="flex items-center gap-1.5">
                    Solscan
                    <ExternalLink className="size-3" />
                  </span>
                </Button>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Warning for unverified */}
      {!verified && (
        <Alert
          color="warning"
          variant="soft"
          title="Unverified Wallet"
          description="This wallet has not been verified. Consider confirming ownership before proceeding with transactions."
        />
      )}
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
