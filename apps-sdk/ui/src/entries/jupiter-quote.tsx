import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/jupiter-quote.css';

import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { useOpenAIGlobal } from '../sdk';
import { getTokenLogoUrl } from '../components/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type RouteStep = {
  ammKey?: string;
  label?: string;
  inputMint?: string;
  outputMint?: string;
  inAmount?: string | number;
  outAmount?: string | number;
  feeAmount?: string | number;
  feeMint?: string;
  percent?: number;
};

type QuotePayload = {
  inputMint?: string;
  input_mint?: string;
  outputMint?: string;
  output_mint?: string;
  inAmount?: string | number;
  in_amount?: string | number;
  outAmount?: string | number;
  out_amount?: string | number;
  otherAmountThreshold?: string | number;
  slippageBps?: number;
  slippage_bps?: number;
  priceImpactPct?: string | number;
  price_impact_pct?: string | number;
  routePlan?: RouteStep[];
  route_plan?: RouteStep[];
  contextSlot?: number;
  timeTaken?: number;
  inputSymbol?: string;
  outputSymbol?: string;
  inputDecimals?: number;
  outputDecimals?: number;
  error?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatAmount(value?: string | number, decimals = 9): string {
  if (!value) return '0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (!Number.isFinite(num)) return '0';
  const adjusted = num / Math.pow(10, decimals);
  if (adjusted < 0.0001) return adjusted.toExponential(4);
  return adjusted.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function shortenMint(mint?: string): string {
  if (!mint) return '—';
  if (mint.length <= 10) return mint;
  return `${mint.slice(0, 4)}...${mint.slice(-4)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Token Icon
// ─────────────────────────────────────────────────────────────────────────────

function TokenIcon({ symbol, mint, size = 32 }: { symbol: string; mint?: string; size?: number }) {
  const [error, setError] = useState(false);
  
  const imageUrl = mint ? getTokenLogoUrl(mint) : undefined;
  const showImage = imageUrl && !error;
  
  return (
    <div className="quote-token-icon" style={{ width: size, height: size }}>
      {showImage ? (
        <img
          src={imageUrl}
          alt={symbol}
          onError={() => setError(true)}
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="quote-token-icon__fallback">{symbol.slice(0, 2)}</span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

function JupiterQuote() {
  const toolOutput = useOpenAIGlobal('toolOutput') as QuotePayload | null;

  if (!toolOutput) {
    return (
      <div className="quote-container">
        <div className="quote-loading">
          <div className="quote-loading__spinner" />
          <span>Fetching quote...</span>
        </div>
      </div>
    );
  }

  if (toolOutput.error) {
    return (
      <div className="quote-container">
        <div className="quote-error">{toolOutput.error}</div>
      </div>
    );
  }

  const inputMint = toolOutput.inputMint || toolOutput.input_mint;
  const outputMint = toolOutput.outputMint || toolOutput.output_mint;
  const inAmount = toolOutput.inAmount || toolOutput.in_amount;
  const outAmount = toolOutput.outAmount || toolOutput.out_amount;
  const slippage = toolOutput.slippageBps || toolOutput.slippage_bps || 0;
  const priceImpact = toolOutput.priceImpactPct || toolOutput.price_impact_pct;
  const routePlan = toolOutput.routePlan || toolOutput.route_plan || [];
  const inputSymbol = toolOutput.inputSymbol || shortenMint(inputMint);
  const outputSymbol = toolOutput.outputSymbol || shortenMint(outputMint);
  const inputDecimals = toolOutput.inputDecimals || 9;
  const outputDecimals = toolOutput.outputDecimals || 9;

  const impactNum = typeof priceImpact === 'string' ? parseFloat(priceImpact) : priceImpact;
  const impactClass = impactNum && impactNum > 1 ? 'quote-impact--high' : impactNum && impactNum > 0.5 ? 'quote-impact--medium' : '';

  return (
    <div className="quote-container">
      <div className="quote-card">
        {/* Header */}
        <div className="quote-header">
          <div className="quote-header-left">
            <span className="quote-icon">⚡</span>
            <span className="quote-title">Jupiter Quote</span>
          </div>
          <span className="quote-badge">Preview</span>
        </div>

        {/* Swap Summary */}
        <div className="quote-swap">
          <div className="quote-swap__from">
            <TokenIcon symbol={inputSymbol} mint={inputMint} size={36} />
            <div className="quote-swap__info">
              <span className="quote-swap__label">From</span>
              <span className="quote-swap__amount">{formatAmount(inAmount, inputDecimals)}</span>
              <span className="quote-swap__symbol">{inputSymbol}</span>
            </div>
          </div>
          <div className="quote-swap__arrow">→</div>
          <div className="quote-swap__to">
            <TokenIcon symbol={outputSymbol} mint={outputMint} size={36} />
            <div className="quote-swap__info">
              <span className="quote-swap__label">To</span>
              <span className="quote-swap__amount">{formatAmount(outAmount, outputDecimals)}</span>
              <span className="quote-swap__symbol">{outputSymbol}</span>
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div className="quote-metrics">
          <div className="quote-metric">
            <span className="quote-metric__label">Slippage</span>
            <span className="quote-metric__value">{(slippage / 100).toFixed(2)}%</span>
          </div>
          <div className="quote-metric">
            <span className="quote-metric__label">Price Impact</span>
            <span className={`quote-metric__value ${impactClass}`}>
              {impactNum ? `${impactNum.toFixed(4)}%` : '< 0.01%'}
            </span>
          </div>
          {routePlan.length > 0 && (
            <div className="quote-metric">
              <span className="quote-metric__label">Route</span>
              <span className="quote-metric__value">{routePlan.length} hop{routePlan.length > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        {/* Route Details */}
        {routePlan.length > 0 && (
          <div className="quote-route">
            <span className="quote-route__label">ROUTE PATH</span>
            <div className="quote-route__steps">
              {routePlan.map((step, idx) => (
                <div key={idx} className="quote-route__step">
                  <span className="quote-route__step-label">{step.label || `Step ${idx + 1}`}</span>
                  {step.percent && <span className="quote-route__step-pct">{step.percent}%</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Context */}
        {toolOutput.contextSlot && (
          <div className="quote-footer">
            <span className="quote-footer__slot">Slot: {toolOutput.contextSlot}</span>
            {toolOutput.timeTaken && <span className="quote-footer__time">{toolOutput.timeTaken}ms</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mount
// ─────────────────────────────────────────────────────────────────────────────

const root = document.getElementById('jupiter-quote-root');
if (root) {
  createRoot(root).render(<JupiterQuote />);
}

export default JupiterQuote;
