import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/solana-send.css';

import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { useOpenAIGlobal } from '../sdk';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type SolanaSendTransfer = {
  walletAddress?: string;
  destination?: string;
  recipient?: string;
  recipientHandle?: string;
  mint?: string;
  amountUi?: number;
  amountRaw?: string;
  decimals?: number;
  valueUsd?: number;
  priceUsd?: number;
  memo?: string;
  signature?: string;
  solscanUrl?: string;
};

type SolanaSendPayload = {
  ok?: boolean;
  error?: string;
  message?: string;
  thresholdUsd?: number;
  result?: SolanaSendTransfer;
  transfer?: SolanaSendTransfer;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function pickString(...values: (string | null | undefined)[]): string | undefined {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

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

function resolveSymbol(mint?: string): string {
  if (!mint) return 'TOKEN';
  if (mint.toLowerCase().includes('sol') || mint === 'native:SOL') return 'SOL';
  // No hardcoded lookup - use truncated mint as fallback
  return mint.slice(0, 4).toUpperCase();
}

function formatAmount(value?: number, decimals?: number): string {
  if (value === undefined) return '—';
  const maxDigits = decimals && decimals > 4 ? 4 : decimals ?? 6;
  if (Math.abs(value) >= 1) {
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: maxDigits });
  }
  return value.toLocaleString('en-US', { maximumSignificantDigits: 6 });
}

function formatUsd(value?: number): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

function abbreviate(value: string, prefix = 6, suffix = 4): string {
  if (value.length <= prefix + suffix + 3) return value;
  return `${value.slice(0, prefix)}…${value.slice(-suffix)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Solana Icon
// ─────────────────────────────────────────────────────────────────────────────

function SolanaIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" fill="none">
      <defs>
        <linearGradient id="sol-send-grad" x1="90%" y1="0%" x2="10%" y2="100%">
          <stop offset="0%" stopColor="#00FFA3" />
          <stop offset="100%" stopColor="#DC1FFF" />
        </linearGradient>
      </defs>
      <path d="M25.3 93.5c0.9-0.9 2.2-1.5 3.5-1.5h97.1c2.2 0 3.4 2.7 1.8 4.3l-24.2 24.2c-0.9 0.9-2.2 1.5-3.5 1.5H2.9c-2.2 0-3.4-2.7-1.8-4.3L25.3 93.5z" fill="url(#sol-send-grad)" />
      <path d="M25.3 2.5c1-1 2.3-1.5 3.5-1.5h97.1c2.2 0 3.4 2.7 1.8 4.3L103.5 29.5c-0.9 0.9-2.2 1.5-3.5 1.5H2.9c-2.2 0-3.4-2.7-1.8-4.3L25.3 2.5z" fill="url(#sol-send-grad)" />
      <path d="M102.7 47.3c-0.9-0.9-2.2-1.5-3.5-1.5H2.1c-2.2 0-3.4 2.7-1.8 4.3l24.2 24.2c0.9 0.9 2.2 1.5 3.5 1.5h97.1c2.2 0 3.4-2.7 1.8-4.3L102.7 47.3z" fill="url(#sol-send-grad)" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Token Icon
// ─────────────────────────────────────────────────────────────────────────────

function TokenIcon({ symbol, size = 24 }: { symbol: string; size?: number }) {
  if (symbol === 'SOL') {
    return <SolanaIcon size={size} />;
  }
  return (
    <div className="send-token-icon" style={{ width: size, height: size }}>
      <span style={{ fontSize: size * 0.4 }}>{symbol.slice(0, 2)}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Status Badge
// ─────────────────────────────────────────────────────────────────────────────

type TransferStatus = 'sent' | 'confirm' | 'failed';

function StatusBadge({ status }: { status: TransferStatus }) {
  const config = {
    sent: { label: 'Confirmed', className: 'send-status-badge--success', icon: '✓' },
    confirm: { label: 'Needs Confirmation', className: 'send-status-badge--warning', icon: '⚠' },
    failed: { label: 'Failed', className: 'send-status-badge--error', icon: '✕' },
  }[status];

  return (
    <span className={`send-status-badge ${config.className}`}>
      <span className="send-status-badge__icon">{config.icon}</span>
      {config.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Transfer Flow Visualization
// ─────────────────────────────────────────────────────────────────────────────

function TransferFlow({
  from,
  to,
  amount,
  symbol,
  valueUsd,
  recipientHandle,
}: {
  from: string;
  to: string;
  amount: string;
  symbol: string;
  valueUsd?: string;
  recipientHandle?: string;
}) {
  return (
    <div className="send-flow">
      {/* From Wallet */}
      <div className="send-flow__wallet">
        <div className="send-flow__wallet-box">
          <span className="send-flow__wallet-label">FROM</span>
        </div>
        <span className="send-flow__wallet-address">{abbreviate(from)}</span>
      </div>

      {/* Amount Display with Animation */}
      <div className="send-flow__center">
        <div className="send-flow__amount-box">
          <TokenIcon symbol={symbol} size={28} />
          <div className="send-flow__amount-info">
            <span className="send-flow__amount">{amount} <span className="send-flow__symbol">{symbol}</span></span>
            {valueUsd && <span className="send-flow__value-usd">{valueUsd}</span>}
          </div>
        </div>
        <div className="send-flow__track">
          <div className="send-flow__track-line" />
          <div className="send-flow__plane">✈</div>
        </div>
      </div>

      {/* To Wallet */}
      <div className="send-flow__wallet send-flow__wallet--to">
        <div className="send-flow__wallet-box send-flow__wallet-box--to">
          <span className="send-flow__wallet-label">TO</span>
        </div>
        <span className="send-flow__wallet-address">{abbreviate(to)}</span>
        {recipientHandle && <span className="send-flow__handle">{recipientHandle}</span>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

function SolanaSend() {
  const toolOutput = useOpenAIGlobal('toolOutput') as SolanaSendPayload | null;

  // Loading
  if (!toolOutput) {
    return (
      <div className="send-container">
        <div className="send-loading">
          <div className="send-loading__spinner" />
          <span>Processing transfer...</span>
        </div>
      </div>
    );
  }

  // Normalize transfer data
  const transfer = toolOutput.result ?? toolOutput.transfer ?? null;
  
  // Determine status
  const status: TransferStatus = 
    toolOutput.ok ? 'sent' :
    toolOutput.error === 'confirmation_required' ? 'confirm' : 'failed';

  const destination = pickString(transfer?.destination, transfer?.recipient) ?? '';
  const signature = pickString(transfer?.signature);
  const solscanUrl = pickString(transfer?.solscanUrl) ?? (signature ? `https://solscan.io/tx/${signature}` : null);
  const symbol = resolveSymbol(transfer?.mint);
  const amount = formatAmount(pickNumber(transfer?.amountUi), transfer?.decimals);
  const valueUsd = formatUsd(pickNumber(transfer?.valueUsd));
  const priceUsd = formatUsd(pickNumber(transfer?.priceUsd));
  const threshold = pickNumber(toolOutput.thresholdUsd);
  const walletAddress = pickString(transfer?.walletAddress) ?? '';
  const recipientHandle = pickString(transfer?.recipientHandle);
  const memo = pickString(transfer?.memo);

  return (
    <div className="send-container">
      <div className={`send-card ${status === 'sent' ? 'send-card--success' : status === 'confirm' ? 'send-card--warning' : 'send-card--error'}`}>
        {/* Glow effect */}
        {status === 'sent' && <div className="send-card__glow send-card__glow--success" />}

        {/* Header */}
        <div className="send-card__header">
          <div className="send-card__title-row">
            <span className="send-card__icon">✈</span>
            <span className="send-card__title">
              {status === 'confirm' ? 'Transfer Preview' : 'Token Transfer'}
            </span>
          </div>
          <StatusBadge status={status} />
        </div>

        {/* Confirmation Warning */}
        {status === 'confirm' && (
          <div className="send-card__warning">
            <div className="send-card__warning-icon">⚠</div>
            <div className="send-card__warning-content">
              <span className="send-card__warning-title">Confirmation Required</span>
              <span className="send-card__warning-text">
                This transfer exceeds the ${threshold ?? 50} threshold. 
                Re-run with <code>confirm=true</code> to proceed.
              </span>
            </div>
          </div>
        )}

        {/* Error Message */}
        {status === 'failed' && (
          <div className="send-card__error">
            <span>{toolOutput.message || toolOutput.error || 'Transfer failed'}</span>
          </div>
        )}

        {/* Transfer Flow */}
        {transfer && (
          <TransferFlow
            from={walletAddress}
            to={destination}
            amount={amount}
            symbol={symbol}
            valueUsd={valueUsd !== '—' ? valueUsd : undefined}
            recipientHandle={recipientHandle}
          />
        )}

        {/* Metrics */}
        {transfer && (
          <div className="send-card__metrics">
            <div className="send-card__metric">
              <span className="send-card__metric-label">Amount</span>
              <span className="send-card__metric-value">{amount} {symbol}</span>
            </div>
            <div className="send-card__metric">
              <span className="send-card__metric-label">Value</span>
              <span className="send-card__metric-value">{valueUsd}</span>
            </div>
            {priceUsd !== '—' && (
              <div className="send-card__metric">
                <span className="send-card__metric-label">Price</span>
                <span className="send-card__metric-value">{priceUsd}</span>
              </div>
            )}
          </div>
        )}

        {/* Memo */}
        {memo && (
          <div className="send-card__memo">
            <span className="send-card__memo-label">Memo</span>
            <span className="send-card__memo-value">{memo}</span>
          </div>
        )}

        {/* Signature */}
        {signature && (
          <div className="send-card__signature">
            <span className="send-card__signature-label">Transaction</span>
            <span className="send-card__signature-value">{abbreviate(signature)}</span>
          </div>
        )}

        {/* Footer */}
        {solscanUrl && (
          <div className="send-card__footer">
            <a href={solscanUrl} target="_blank" rel="noreferrer" className="send-card__link">
              View on Solscan ↗
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

const root = document.getElementById('solana-send-root');
if (root) {
  createRoot(root).render(<SolanaSend />);
}

export default SolanaSend;
