import '../styles/global.css';

import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { useOpenAIGlobal } from '../sdk';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type TokenMeta = {
  symbol?: string;
  name?: string;
  imageUrl?: string;
};

type SwapExecution = {
  inputMint?: string;
  outputMint?: string;
  walletAddress?: string;
  amountUi?: number;
  outputAmountUi?: number;
  expectedOutputUi?: number;
  priceImpactPct?: number;
  slippageBps?: number;
  networkFeeSol?: number;
  route?: string;
  swapId?: string;
  status?: string;
  txSignature?: string;
  transactionSignature?: string;
  signature?: string;
  inputToken?: TokenMeta;
  outputToken?: TokenMeta;
  inputLogo?: string;
  outputLogo?: string;
};

type SwapPayload = {
  result?: SwapExecution;
} & SwapExecution;

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

const WELL_KNOWN: Record<string, string> = {
  So11111111111111111111111111111111111111112: 'SOL',
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 'USDC',
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: 'USDT',
};

function symbolFromMint(mint?: string): string {
  if (!mint) return 'TOKEN';
  return WELL_KNOWN[mint] ?? mint.slice(0, 4).toUpperCase();
}

function formatAmount(value?: number): string {
  if (value === undefined) return '—';
  if (Math.abs(value) >= 1) {
    return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
  }
  return value.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

function formatPercent(value?: number): string {
  if (value === undefined) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function abbreviate(value: string, prefix = 6, suffix = 4): string {
  if (value.length <= prefix + suffix + 3) return value;
  return `${value.slice(0, prefix)}…${value.slice(-suffix)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Token Icon Component
// ─────────────────────────────────────────────────────────────────────────────

function TokenIcon({ symbol, imageUrl, size = 56 }: { symbol: string; imageUrl?: string; size?: number }) {
  const [error, setError] = useState(false);
  const showImage = imageUrl && !error;

  return (
    <div className="swap-token-icon" style={{ width: size, height: size }}>
      {showImage ? (
        <img
          src={imageUrl}
          alt={symbol}
          onError={() => setError(true)}
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="swap-token-icon__fallback" style={{ fontSize: size * 0.3 }}>{symbol.slice(0, 2)}</span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Status Badge
// ─────────────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: 'confirmed' | 'pending' | 'failed' }) {
  const config = {
    confirmed: { label: 'Confirmed', className: 'swap-status-badge--success' },
    pending: { label: 'Pending', className: 'swap-status-badge--pending' },
    failed: { label: 'Failed', className: 'swap-status-badge--error' },
  }[status];

  return (
    <span className={`swap-status-badge ${config.className}`}>
      {status === 'confirmed' && <span className="swap-status-badge__icon">✓</span>}
      {status === 'pending' && <span className="swap-status-badge__icon swap-status-badge__icon--pulse">●</span>}
      {status === 'failed' && <span className="swap-status-badge__icon">✕</span>}
      {config.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Swap Flow Visualization
// ─────────────────────────────────────────────────────────────────────────────

function SwapFlow({
  fromSymbol,
  fromAmount,
  fromImage,
  toSymbol,
  toAmount,
  toImage,
}: {
  fromSymbol: string;
  fromAmount: string;
  fromImage?: string;
  toSymbol: string;
  toAmount: string;
  toImage?: string;
}) {
  return (
    <div className="swap-flow">
      {/* From Side */}
      <div className="swap-flow__side">
        <TokenIcon symbol={fromSymbol} imageUrl={fromImage} size={56} />
        <div className="swap-flow__info">
          <span className="swap-flow__amount">{fromAmount}</span>
          <span className="swap-flow__symbol">{fromSymbol}</span>
        </div>
      </div>

      {/* Arrow */}
      <div className="swap-flow__arrow">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* To Side */}
      <div className="swap-flow__side swap-flow__side--to">
        <TokenIcon symbol={toSymbol} imageUrl={toImage} size={56} />
        <div className="swap-flow__info">
          <span className="swap-flow__amount swap-flow__amount--receive">{toAmount}</span>
          <span className="swap-flow__symbol">{toSymbol}</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

function SolanaSwapExecute() {
  const toolOutput = useOpenAIGlobal('toolOutput') as SwapPayload | null;

  // Normalize execution from various payload shapes
  const execution: SwapExecution | null = toolOutput
    ? (toolOutput.result ?? toolOutput)
    : null;

  // Loading
  if (!execution) {
    return (
      <div className="swap-container">
        <div className="swap-loading">
          <div className="swap-loading__spinner" />
          <span>Executing swap...</span>
        </div>
      </div>
    );
  }

  // Extract values
  const inputMint = pickString(execution.inputMint);
  const outputMint = pickString(execution.outputMint);
  const inputSymbol = pickString(execution.inputToken?.symbol) ?? symbolFromMint(inputMint);
  const outputSymbol = pickString(execution.outputToken?.symbol) ?? symbolFromMint(outputMint);
  const inputImage = pickString(execution.inputToken?.imageUrl, execution.inputLogo);
  const outputImage = pickString(execution.outputToken?.imageUrl, execution.outputLogo);
  
  const amountIn = pickNumber(execution.amountUi);
  const amountOut = pickNumber(execution.outputAmountUi, execution.expectedOutputUi);
  const priceImpact = pickNumber(execution.priceImpactPct);
  const slippageBps = pickNumber(execution.slippageBps);
  const networkFee = pickNumber(execution.networkFeeSol);
  const signature = pickString(execution.txSignature, execution.transactionSignature, execution.signature);
  const swapId = pickString(execution.swapId);
  const wallet = pickString(execution.walletAddress);

  // Determine status
  const statusRaw = pickString(execution.status)?.toLowerCase();
  const swapStatus: 'confirmed' | 'pending' | 'failed' = 
    statusRaw === 'confirmed' || statusRaw === 'success' ? 'confirmed' :
    statusRaw === 'failed' || statusRaw === 'error' ? 'failed' : 
    signature ? 'confirmed' : 'pending';

  const impactIsNegative = priceImpact !== undefined && priceImpact < 0;
  const solscanUrl = signature ? `https://solscan.io/tx/${signature}` : null;

  return (
    <div className="swap-container">
      <div className={`swap-card ${swapStatus === 'confirmed' ? 'swap-card--success' : ''}`}>
        {/* Success glow */}
        {swapStatus === 'confirmed' && <div className="swap-card__glow swap-card__glow--success" />}

        {/* Header */}
        <div className="swap-card__header">
          <span className="swap-card__title">Swap Execution</span>
          <StatusBadge status={swapStatus} />
        </div>

        {/* Visual Flow */}
        <SwapFlow
          fromSymbol={inputSymbol}
          fromAmount={formatAmount(amountIn)}
          fromImage={inputImage}
          toSymbol={outputSymbol}
          toAmount={formatAmount(amountOut)}
          toImage={outputImage}
        />

        {/* Metrics */}
        <div className="swap-card__metrics">
          {priceImpact !== undefined && (
            <div className="swap-card__metric">
              <span className="swap-card__metric-label">Price Impact</span>
              <span className={`swap-card__metric-value ${impactIsNegative ? 'swap-card__metric-value--negative' : 'swap-card__metric-value--positive'}`}>
                {formatPercent(priceImpact)}
              </span>
            </div>
          )}
          {slippageBps !== undefined && (
            <div className="swap-card__metric">
              <span className="swap-card__metric-label">Slippage</span>
              <span className="swap-card__metric-value">{(slippageBps / 100).toFixed(2)}%</span>
            </div>
          )}
          {networkFee !== undefined && (
            <div className="swap-card__metric">
              <span className="swap-card__metric-label">Network Fee</span>
              <span className="swap-card__metric-value">{networkFee.toFixed(6)} SOL</span>
            </div>
          )}
        </div>

        {/* Transaction Signature */}
        {signature && (
          <div className="swap-card__signature">
            <span className="swap-card__signature-label">Transaction</span>
            <span className="swap-card__signature-value">{abbreviate(signature)}</span>
          </div>
        )}

        {/* Footer */}
        <div className="swap-card__footer">
          {wallet && <span className="swap-card__wallet">Wallet: {abbreviate(wallet)}</span>}
          <div className="swap-card__links">
            {solscanUrl && (
              <a href={solscanUrl} target="_blank" rel="noreferrer" className="swap-card__link">
                Solscan
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mount
// ─────────────────────────────────────────────────────────────────────────────

const root = document.getElementById('solana-swap-execute-root');
if (root) {
  createRoot(root).render(<SolanaSwapExecute />);
}

export default SolanaSwapExecute;
