import '../styles/global.css';

import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { useOpenAIGlobal } from '../sdk';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type HyperliquidMarket = {
  name?: string;
  symbol?: string;
  maxLeverage?: number;
  fundingRate?: number;
  openInterest?: number;
  dayVolume?: number;
  price?: number;
};

type HyperliquidAgent = {
  id?: string;
  managedWalletPublicKey?: string;
  agentWalletAddress?: string;
  status?: string;
  validUntil?: string;
};

type FundResult = {
  solSignature?: string;
  usdcAmount?: number;
  bridgeStatus?: string;
  steps?: Array<{ step: string; status: string; signature?: string; amount?: number }>;
};

type DepositResult = {
  txHash?: string;
  amountUsd?: number;
  status?: string;
};

type TradeResult = {
  orderId?: string;
  symbol?: string;
  side?: string;
  size?: number;
  price?: number;
  filledSize?: number;
  status?: string;
  timestamp?: string;
};

type HyperliquidPayload = {
  ok?: boolean;
  error?: string;
  markets?: HyperliquidMarket[];
  agent?: HyperliquidAgent;
  result?: FundResult | DepositResult | TradeResult;
  // Detect tool type from fields
  _toolType?: 'markets' | 'opt_in' | 'fund' | 'deposit' | 'trade';
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatNumber(value?: number, decimals = 2): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(decimals)}B`;
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(decimals)}M`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(decimals)}K`;
  return value.toFixed(decimals);
}

function formatPercent(value?: number): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(4)}%`;
}

function abbreviate(value?: string, len = 8): string {
  if (!value) return '—';
  if (value.length <= len * 2 + 3) return value;
  return `${value.slice(0, len)}...${value.slice(-4)}`;
}

function detectToolType(payload: HyperliquidPayload): string {
  if (payload.markets) return 'markets';
  if (payload.agent) return 'opt_in';
  const result = payload.result;
  if (result) {
    if ('solSignature' in result || 'steps' in result) return 'fund';
    if ('txHash' in result) return 'deposit';
    if ('orderId' in result || 'side' in result) return 'trade';
  }
  return 'unknown';
}

// ─────────────────────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────────────────────

function HLLogo({ size = 20 }: { size?: number }) {
  return (
    <div
      className="hl-logo"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
    >
      HL
    </div>
  );
}

function HLStatusBadge({ status }: { status: string }) {
  const statusClass = {
    active: 'hl-badge--success',
    success: 'hl-badge--success',
    filled: 'hl-badge--success',
    completed: 'hl-badge--success',
    pending: 'hl-badge--warning',
    partial: 'hl-badge--warning',
    failed: 'hl-badge--error',
  }[status.toLowerCase()] || 'hl-badge--warning';

  return <span className={`hl-badge ${statusClass}`}>{status}</span>;
}

function MarketsView({ markets }: { markets: HyperliquidMarket[] }) {
  const [showAll, setShowAll] = useState(false);
  const visibleMarkets = showAll ? markets : markets.slice(0, 10);

  return (
    <div className="hl-view">
      <div className="hl-markets-header">
        <span className="hl-markets-count">{markets.length} markets</span>
      </div>
      <div className="hl-markets-list">
        {visibleMarkets.map((market, idx) => (
          <div key={market.symbol || idx} className="hl-market-row">
            <div className="hl-market-left">
              <span className="hl-market-symbol">{market.symbol || market.name}</span>
              {market.maxLeverage && (
                <span className="hl-market-leverage">{market.maxLeverage}x</span>
              )}
            </div>
            <div className="hl-market-right">
              {market.price && <span className="hl-market-price">${formatNumber(market.price, 4)}</span>}
              {market.fundingRate !== undefined && (
                <span className={`hl-market-funding ${market.fundingRate >= 0 ? 'hl-positive' : 'hl-negative'}`}>
                  {formatPercent(market.fundingRate)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      {markets.length > 10 && (
        <button className="hl-show-more" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Show Less' : `Show ${markets.length - 10} more`}
        </button>
      )}
    </div>
  );
}

function OptInView({ agent }: { agent: HyperliquidAgent }) {
  return (
    <div className="hl-view">
      <div className="hl-success-banner">
        <span className="hl-success-icon">✓</span>
        <div className="hl-success-text">
          <span className="hl-success-title">Agent Provisioned!</span>
          <span className="hl-success-subtitle">Your Hyperliquid trading agent is ready</span>
        </div>
      </div>

      <div className="hl-info-box">
        <span className="hl-info-label">AGENT WALLET</span>
        <div className="hl-info-value">
          <code>{abbreviate(agent.agentWalletAddress, 12)}</code>
        </div>
      </div>

      <div className="hl-metrics">
        <div className="hl-metric">
          <span className="hl-metric-label">VALID UNTIL</span>
          <span className="hl-metric-value">
            {agent.validUntil ? new Date(agent.validUntil).toLocaleDateString() : '—'}
          </span>
        </div>
        <div className="hl-metric">
          <span className="hl-metric-label">AGENT ID</span>
          <span className="hl-metric-value">{agent.id?.slice(0, 8) || '—'}</span>
        </div>
      </div>
    </div>
  );
}

function FundView({ result }: { result: FundResult }) {
  return (
    <div className="hl-view">
      <div className="hl-flow-visual">
        <div className="hl-flow-step">
          <span className="hl-flow-label">SOL</span>
          <span className="hl-flow-sublabel">Solana</span>
        </div>
        <span className="hl-flow-arrow">→</span>
        <div className="hl-flow-step">
          <span className="hl-flow-label hl-cyan">USDC</span>
          <span className="hl-flow-sublabel">Arbitrum</span>
        </div>
        <span className="hl-flow-arrow">→</span>
        <div className="hl-flow-step">
          <HLLogo size={32} />
          <span className="hl-flow-sublabel">Hyperliquid</span>
        </div>
      </div>

      {result.usdcAmount && (
        <div className="hl-amount-display">
          <span className="hl-amount-label">Funded</span>
          <span className="hl-amount-value">${formatNumber(result.usdcAmount, 2)}</span>
        </div>
      )}

      {result.steps && result.steps.length > 0 && (
        <div className="hl-steps">
          <span className="hl-steps-title">Bridge Steps</span>
          {result.steps.map((step, idx) => (
            <div key={idx} className={`hl-step ${step.status === 'completed' || step.status === 'success' ? 'hl-step--success' : 'hl-step--pending'}`}>
              <span className="hl-step-name">{step.step}</span>
              <span className="hl-step-status">{step.status}</span>
            </div>
          ))}
        </div>
      )}

      {result.solSignature && (
        <a
          href={`https://solscan.io/tx/${result.solSignature}`}
          target="_blank"
          rel="noreferrer"
          className="hl-tx-link"
        >
          View SOL transaction: {abbreviate(result.solSignature, 12)} ↗
        </a>
      )}
    </div>
  );
}

function DepositView({ result }: { result: DepositResult }) {
  return (
    <div className="hl-view">
      <div className="hl-deposit-visual">
        <div className="hl-deposit-flow">
          <span>L2 (Arbitrum)</span>
          <span className="hl-flow-arrow">→</span>
          <span className="hl-cyan">L1 (Hyperliquid)</span>
        </div>
        {result.amountUsd && (
          <span className="hl-deposit-amount">${formatNumber(result.amountUsd, 2)}</span>
        )}
      </div>

      {result.txHash && (
        <div className="hl-info-box">
          <span className="hl-info-label">TRANSACTION HASH</span>
          <code className="hl-info-value">{abbreviate(result.txHash, 16)}</code>
        </div>
      )}
    </div>
  );
}

function TradeView({ result }: { result: TradeResult }) {
  const isBuy = result.side?.toLowerCase() === 'buy';

  return (
    <div className="hl-view">
      <div className={`hl-trade-banner ${isBuy ? 'hl-trade-banner--buy' : 'hl-trade-banner--sell'}`}>
        <span className="hl-trade-icon">{isBuy ? '↑' : '↓'}</span>
        <div className="hl-trade-info">
          <span className={`hl-trade-action ${isBuy ? 'hl-positive' : 'hl-negative'}`}>
            {result.side?.toUpperCase()} {result.symbol}
          </span>
          <span className="hl-trade-type">Perpetual</span>
        </div>
        <div className="hl-trade-size">
          <span className="hl-trade-size-value">{formatNumber(result.size, 4)}</span>
          <span className="hl-trade-size-label">Size</span>
        </div>
      </div>

      <div className="hl-metrics hl-metrics--4col">
        <div className="hl-metric">
          <span className="hl-metric-label">PRICE</span>
          <span className="hl-metric-value">{result.price ? `$${formatNumber(result.price, 4)}` : 'Market'}</span>
        </div>
        <div className="hl-metric">
          <span className="hl-metric-label">FILLED</span>
          <span className="hl-metric-value">{formatNumber(result.filledSize, 4)}</span>
        </div>
        <div className="hl-metric">
          <span className="hl-metric-label">ORDER ID</span>
          <span className="hl-metric-value">{result.orderId?.slice(0, 8) || '—'}</span>
        </div>
        <div className="hl-metric">
          <span className="hl-metric-label">TIME</span>
          <span className="hl-metric-value">
            {result.timestamp ? new Date(result.timestamp).toLocaleTimeString() : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

function Hyperliquid() {
  const toolOutput = useOpenAIGlobal('toolOutput') as HyperliquidPayload | null;

  if (!toolOutput) {
    return (
      <div className="hl-container">
        <div className="hl-loading">
          <div className="hl-loading__spinner" />
          <span>Loading Hyperliquid...</span>
        </div>
      </div>
    );
  }

  if (toolOutput.error || toolOutput.ok === false) {
    return (
      <div className="hl-container">
        <div className="hl-error">{toolOutput.error || 'Operation failed'}</div>
      </div>
    );
  }

  const toolType = detectToolType(toolOutput);

  const titles: Record<string, string> = {
    markets: 'Hyperliquid Markets',
    opt_in: 'Hyperliquid Opt-In',
    fund: 'Fund Hyperliquid',
    deposit: 'Bridge Deposit',
    trade: 'Perp Trade',
    unknown: 'Hyperliquid',
  };

  return (
    <div className="hl-container">
      <div className="hl-card">
        <div className="hl-header">
          <div className="hl-header-left">
            <HLLogo />
            <span className="hl-title">{titles[toolType]}</span>
          </div>
          {toolType === 'opt_in' && toolOutput.agent?.status && (
            <HLStatusBadge status={toolOutput.agent.status} />
          )}
          {toolType === 'fund' && (
            <HLStatusBadge status={(toolOutput.result as FundResult)?.bridgeStatus || 'success'} />
          )}
          {toolType === 'trade' && (
            <HLStatusBadge status={(toolOutput.result as TradeResult)?.status || 'filled'} />
          )}
        </div>

        {toolType === 'markets' && toolOutput.markets && (
          <MarketsView markets={toolOutput.markets} />
        )}
        {toolType === 'opt_in' && toolOutput.agent && (
          <OptInView agent={toolOutput.agent} />
        )}
        {toolType === 'fund' && toolOutput.result && (
          <FundView result={toolOutput.result as FundResult} />
        )}
        {toolType === 'deposit' && toolOutput.result && (
          <DepositView result={toolOutput.result as DepositResult} />
        )}
        {toolType === 'trade' && toolOutput.result && (
          <TradeView result={toolOutput.result as TradeResult} />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mount
// ─────────────────────────────────────────────────────────────────────────────

const root = document.getElementById('hyperliquid-root');
if (root) {
  createRoot(root).render(<Hyperliquid />);
}

export default Hyperliquid;
