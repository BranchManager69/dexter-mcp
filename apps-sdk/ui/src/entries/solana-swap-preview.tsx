import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/solana-swap.css';

import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { useOpenAIGlobal, useCallTool, useSendFollowUp, useTheme } from '../sdk';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type TokenMeta = {
  symbol?: string;
  name?: string;
  imageUrl?: string;
  priceUsd?: number;
  priceChange24h?: number;
};

type SwapQuote = {
  inputMint?: string;
  outputMint?: string;
  amountUi?: number;
  inAmountUi?: number;
  expectedOutputUi?: number;
  outAmountUi?: number;
  priceImpactPct?: number;
  slippageBps?: number;
  networkFeeSol?: number;
  route?: string;
  routeLabel?: string;
  quoteId?: string;
  swapId?: string;
  inputToken?: TokenMeta;
  outputToken?: TokenMeta;
  inputLogo?: string;
  outputLogo?: string;
};

type SwapPreviewPayload = {
  result?: SwapQuote;
  quote?: SwapQuote;
} & SwapQuote;

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

function abbreviate(value: string, prefix = 4, suffix = 4): string {
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
// Action Button Component
// ─────────────────────────────────────────────────────────────────────────────

function ActionButton({ 
  onClick, 
  label, 
  loadingLabel, 
  isLoading, 
  disabled,
  variant = 'secondary' 
}: { 
  onClick: () => void; 
  label: string; 
  loadingLabel?: string;
  isLoading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
}) {
  return (
    <button 
      className={`swap-action-btn swap-action-btn--${variant}`}
      onClick={onClick}
      disabled={isLoading || disabled}
    >
      {isLoading ? (loadingLabel || 'Loading...') : label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

function SolanaSwapPreview() {
  const toolOutput = useOpenAIGlobal('toolOutput') as SwapPreviewPayload | null;
  const theme = useTheme();
  const { callTool, isLoading: isExecuting } = useCallTool();
  const sendFollowUp = useSendFollowUp();
  const [actionState, setActionState] = useState<'idle' | 'success' | 'error'>('idle');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Normalize quote from various payload shapes
  const quote: SwapQuote | null = toolOutput
    ? (toolOutput.result ?? toolOutput.quote ?? toolOutput)
    : null;

  // Loading
  if (!quote) {
    return (
      <div className="swap-container" data-theme={theme}>
        <div className="swap-loading">
          <div className="swap-loading__spinner" />
          <span>Building swap quote...</span>
        </div>
      </div>
    );
  }

  // Extract values
  const inputMint = pickString(quote.inputMint);
  const outputMint = pickString(quote.outputMint);
  const inputSymbol = pickString(quote.inputToken?.symbol) ?? symbolFromMint(inputMint);
  const outputSymbol = pickString(quote.outputToken?.symbol) ?? symbolFromMint(outputMint);
  const inputImage = pickString(quote.inputToken?.imageUrl, quote.inputLogo);
  const outputImage = pickString(quote.outputToken?.imageUrl, quote.outputLogo);
  
  const amountIn = pickNumber(quote.amountUi, quote.inAmountUi);
  const amountOut = pickNumber(quote.expectedOutputUi, quote.outAmountUi);
  const priceImpact = pickNumber(quote.priceImpactPct);
  const slippageBps = pickNumber(quote.slippageBps);
  const networkFee = pickNumber(quote.networkFeeSol);
  const routeLabel = pickString(quote.route, quote.routeLabel) ?? 'Jupiter';
  const quoteId = pickString(quote.quoteId, quote.swapId);

  const highImpact = priceImpact !== undefined && priceImpact > 1;
  const impactIsNegative = priceImpact !== undefined && priceImpact < 0;

  // Action handlers
  const handleExecuteSwap = async () => {
    if (!inputMint || !outputMint) return;
    setActionState('idle');
    setActionMessage(null);
    
    const result = await callTool('solana_swap_execute', {
      inputMint,
      outputMint,
      amount: amountIn,
      slippageBps: slippageBps || 100,
    });
    
    if (result) {
      setActionState('success');
      setActionMessage('Swap executed successfully!');
    } else {
      setActionState('error');
      setActionMessage('Failed to execute swap');
    }
  };

  const handleCheckSlippage = async () => {
    if (!outputMint) return;
    await callTool('slippage_sentinel', {
      token_out: outputMint,
      token_in: inputMint,
      amount_in_ui: amountIn,
    });
  };

  const handleLearnMore = async () => {
    await sendFollowUp(`Tell me more about ${outputSymbol} (${outputMint})`);
  };

  const handleRefreshQuote = async () => {
    if (!inputMint || !outputMint) return;
    await callTool('solana_swap_preview', {
      inputMint,
      outputMint,
      amount: amountIn,
    });
  };

  return (
    <div className="swap-container" data-theme={theme}>
      <div className="swap-card">
        {/* Header */}
        <div className="swap-card__header">
          <span className="swap-card__title">Swap Preview</span>
          <span className="swap-card__badge">{routeLabel}</span>
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

        {/* Warning */}
        {highImpact && (
          <div className="swap-card__warning">
            <div className="swap-card__warning-icon">⚠</div>
            <div className="swap-card__warning-content">
              <span className="swap-card__warning-title">High Price Impact</span>
              <span className="swap-card__warning-text">Consider using a smaller amount to reduce slippage.</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="swap-card__actions">
          <ActionButton
            variant="primary"
            onClick={handleExecuteSwap}
            label="Execute Swap"
            loadingLabel="Executing..."
            isLoading={isExecuting}
          />
          <ActionButton
            onClick={handleRefreshQuote}
            label="Refresh Quote"
          />
          <ActionButton
            onClick={handleCheckSlippage}
            label="Check Slippage"
          />
          <ActionButton
            onClick={handleLearnMore}
            label={`About ${outputSymbol}`}
          />
        </div>

        {/* Action Result */}
        {actionMessage && (
          <div className={`swap-card__action-result swap-card__action-result--${actionState}`}>
            {actionMessage}
          </div>
        )}

        {/* Footer */}
        <div className="swap-card__footer">
          {quoteId && <span className="swap-card__quote-id">Quote: {abbreviate(quoteId, 6, 4)}</span>}
          <span className="swap-card__status">Ready to execute</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mount
// ─────────────────────────────────────────────────────────────────────────────

const root = document.getElementById('solana-swap-preview-root');
if (root) {
  createRoot(root).render(<SolanaSwapPreview />);
}

export default SolanaSwapPreview;
