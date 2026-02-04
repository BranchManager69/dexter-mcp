import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/onchain-activity.css';

import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { useOpenAIGlobal } from '../sdk';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type WalletFlowSummary = {
  wallet: string;
  trades: number;
  netQuoteVolume: number;
  netBaseVolume: number;
  lastSeen: number;
};

type NormalizedTrade = {
  signature: string;
  wallet: string;
  side: 'buy' | 'sell';
  timestamp: number;
  pool?: string | null;
  source?: string | null;
  quoteSymbol?: string | null;
  quoteAbs: number;
  quoteSigned: number;
  baseSymbol?: string | null;
  baseAbs: number;
  baseSigned: number;
  priceUsd?: number | null;
};

type TokenActivitySummary = {
  mint: string;
  timeframeSeconds: number;
  tradeCount: number;
  uniqueWallets: number;
  primaryQuoteSymbol?: string | null;
  primaryBaseSymbol?: string | null;
  // Widget expects these names
  buyQuoteVolume?: number;
  sellQuoteVolume?: number;
  netQuoteVolume?: number;
  // API returns these names
  buyVolumeSol?: number;
  sellVolumeSol?: number;
  netFlowSol?: number;
  netSol?: number;
  buyBaseVolume?: number;
  sellBaseVolume?: number;
  netBaseVolume?: number;
  topNetBuyers?: WalletFlowSummary[];
  topNetSellers?: WalletFlowSummary[];
  largestTrades?: NormalizedTrade[];
  recentTrades?: NormalizedTrade[];
};

type WalletActivitySummary = {
  wallet: string;
  mint?: string;
  timeframeSeconds: number;
  tradeCount: number;
  primaryQuoteSymbol?: string | null;
  primaryBaseSymbol?: string | null;
  // Widget expects these names
  buyQuoteVolume?: number;
  sellQuoteVolume?: number;
  netQuoteVolume?: number;
  // API returns these names
  buyVolumeSol?: number;
  sellVolumeSol?: number;
  netFlowSol?: number;
  netSol?: number;
  buyBaseVolume?: number;
  sellBaseVolume?: number;
  netBaseVolume?: number;
  netUsdChange?: number | null;
  trades?: NormalizedTrade[];
};

type OnchainPayload = {
  ok?: boolean;
  error?: string;
  message?: string;
  scope?: 'token' | 'wallet' | 'trade';
  summary?: TokenActivitySummary | WalletActivitySummary;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Extract volume fields regardless of naming convention (API vs widget) */
function getVolumes(summary: TokenActivitySummary | WalletActivitySummary) {
  return {
    buy: summary.buyQuoteVolume ?? summary.buyVolumeSol ?? 0,
    sell: summary.sellQuoteVolume ?? summary.sellVolumeSol ?? 0,
    net: summary.netQuoteVolume ?? summary.netFlowSol ?? summary.netSol ?? 0,
  };
}

function formatTimeframe(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

function formatVolume(value: number, decimals = 4): string {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toFixed(decimals);
}

function formatUsd(value?: number): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

function abbreviate(value: string, len = 6): string {
  if (value.length <= len * 2 + 3) return value;
  return `${value.slice(0, len)}…${value.slice(-4)}`;
}

function relativeTime(timestamp?: number): string {
  if (!timestamp) return '—';
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Volume Bar Component
// ─────────────────────────────────────────────────────────────────────────────

function VolumeBar({ buy, sell, label }: { buy: number; sell: number; label?: string }) {
  const total = buy + sell;
  const buyPct = total > 0 ? (buy / total) * 100 : 50;
  const sellPct = total > 0 ? (sell / total) * 100 : 50;

  return (
    <div className="onchain-volume-bar">
      {label && <span className="onchain-volume-bar__label">{label}</span>}
      <div className="onchain-volume-bar__track">
        <div className="onchain-volume-bar__buy" style={{ width: `${buyPct}%` }} />
        <div className="onchain-volume-bar__sell" style={{ width: `${sellPct}%` }} />
        <div className="onchain-volume-bar__values">
          <span className="onchain-volume-bar__value onchain-volume-bar__value--buy">{formatVolume(buy)}</span>
          <span className="onchain-volume-bar__value onchain-volume-bar__value--sell">{formatVolume(sell)}</span>
        </div>
      </div>
      <div className="onchain-volume-bar__legend">
        <span>BUY {buyPct.toFixed(0)}%</span>
        <span>SELL {sellPct.toFixed(0)}%</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Net Flow Indicator
// ─────────────────────────────────────────────────────────────────────────────

function NetFlowIndicator({ value, symbol = 'SOL' }: { value: number; symbol?: string }) {
  const isPositive = value > 0;
  const isNeutral = Math.abs(value) < 0.0001;

  return (
    <div className={`onchain-net-flow ${isNeutral ? '' : isPositive ? 'onchain-net-flow--positive' : 'onchain-net-flow--negative'}`}>
      {!isNeutral && (
        <span className="onchain-net-flow__arrow">
          {isPositive ? '↑' : '↓'}
        </span>
      )}
      <div className="onchain-net-flow__info">
        <span className="onchain-net-flow__label">Net Flow</span>
        <span className="onchain-net-flow__value">
          {isPositive ? '+' : ''}{formatVolume(value)} {symbol}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Top Traders List
// ─────────────────────────────────────────────────────────────────────────────

function TopTradersList({ buyers, sellers }: { buyers?: WalletFlowSummary[]; sellers?: WalletFlowSummary[] }) {
  const [showAll, setShowAll] = useState(false);
  const limit = showAll ? 10 : 3;
  const topBuyers = (buyers || []).slice(0, limit);
  const topSellers = (sellers || []).slice(0, limit);

  if (topBuyers.length === 0 && topSellers.length === 0) return null;

  const hasMore = (buyers?.length || 0) > 3 || (sellers?.length || 0) > 3;

  return (
    <div className="onchain-traders">
      <div className="onchain-traders__header">
        <span className="onchain-traders__title">Top Traders</span>
        {hasMore && (
          <button className="onchain-traders__toggle" onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Show Less' : 'Show All'}
          </button>
        )}
      </div>

      <div className="onchain-traders__grid">
        {/* Buyers */}
        <div className="onchain-traders__column">
          <span className="onchain-traders__column-title onchain-traders__column-title--buy">↑ Buyers</span>
          {topBuyers.map(flow => (
            <a
              key={flow.wallet}
              href={`https://solscan.io/account/${flow.wallet}`}
              target="_blank"
              rel="noreferrer"
              className="onchain-traders__item onchain-traders__item--buy"
            >
              <span className="onchain-traders__wallet">{abbreviate(flow.wallet)}</span>
              <span className="onchain-traders__amount">+{formatVolume(flow.netBaseVolume, 2)}</span>
            </a>
          ))}
        </div>

        {/* Sellers */}
        <div className="onchain-traders__column">
          <span className="onchain-traders__column-title onchain-traders__column-title--sell">↓ Sellers</span>
          {topSellers.map(flow => (
            <a
              key={flow.wallet}
              href={`https://solscan.io/account/${flow.wallet}`}
              target="_blank"
              rel="noreferrer"
              className="onchain-traders__item onchain-traders__item--sell"
            >
              <span className="onchain-traders__wallet">{abbreviate(flow.wallet)}</span>
              <span className="onchain-traders__amount">{formatVolume(flow.netBaseVolume, 2)}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Recent Trades List
// ─────────────────────────────────────────────────────────────────────────────

function RecentTradesList({ trades }: { trades?: NormalizedTrade[] }) {
  const [expanded, setExpanded] = useState(false);
  const limit = expanded ? 20 : 5;
  const displayTrades = (trades || []).slice(0, limit);

  if (displayTrades.length === 0) return null;

  const hasMore = (trades?.length || 0) > 5;

  return (
    <div className="onchain-trades">
      <div className="onchain-trades__header">
        <span className="onchain-trades__title">Recent Trades</span>
        {hasMore && (
          <button className="onchain-trades__toggle" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Collapse' : `Show ${Math.min(20, trades!.length)} trades`}
          </button>
        )}
      </div>

      <div className="onchain-trades__list">
        {displayTrades.map(trade => (
          <a
            key={trade.signature}
            href={`https://solscan.io/tx/${trade.signature}`}
            target="_blank"
            rel="noreferrer"
            className={`onchain-trades__item ${trade.side === 'buy' ? 'onchain-trades__item--buy' : 'onchain-trades__item--sell'}`}
          >
            <div className="onchain-trades__item-left">
              <span className="onchain-trades__arrow">{trade.side === 'buy' ? '↑' : '↓'}</span>
              <span className="onchain-trades__sig">{abbreviate(trade.signature, 8)}</span>
            </div>
            <div className="onchain-trades__item-right">
              <span className="onchain-trades__amount">
                {formatVolume(trade.quoteAbs, 4)} {trade.quoteSymbol || 'SOL'}
              </span>
              <span className="onchain-trades__time">{relativeTime(trade.timestamp)}</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Token Activity View
// ─────────────────────────────────────────────────────────────────────────────

function TokenActivityView({ summary }: { summary: TokenActivitySummary }) {
  return (
    <div className="onchain-view">
      {/* Key Metrics */}
      <div className="onchain-metrics">
        <div className="onchain-metric">
          <span className="onchain-metric__label">TRADES</span>
          <span className="onchain-metric__value">{summary.tradeCount.toLocaleString()}</span>
        </div>
        <div className="onchain-metric">
          <span className="onchain-metric__label">WALLETS</span>
          <span className="onchain-metric__value">{summary.uniqueWallets.toLocaleString()}</span>
        </div>
        <div className="onchain-metric">
          <span className="onchain-metric__label">TIMEFRAME</span>
          <span className="onchain-metric__value">{formatTimeframe(summary.timeframeSeconds)}</span>
        </div>
      </div>

      <VolumeBar buy={getVolumes(summary).buy} sell={getVolumes(summary).sell} label="VOLUME (SOL)" />
      <NetFlowIndicator value={getVolumes(summary).net} />
      <TopTradersList buyers={summary.topNetBuyers} sellers={summary.topNetSellers} />
      <RecentTradesList trades={summary.recentTrades} />

      {/* Mint Address */}
      <div className="onchain-footer">
        <a href={`https://solscan.io/token/${summary.mint}`} target="_blank" rel="noreferrer" className="onchain-hash">
          <span className="onchain-hash__label">Token</span>
          <span className="onchain-hash__value">{abbreviate(summary.mint, 8)}</span>
        </a>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Wallet Activity View
// ─────────────────────────────────────────────────────────────────────────────

function WalletActivityView({ summary }: { summary: WalletActivitySummary }) {
  return (
    <div className="onchain-view">
      {/* Wallet Header */}
      <div className="onchain-wallet-header">
        <div className="onchain-wallet-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div className="onchain-wallet-info">
          <a href={`https://solscan.io/account/${summary.wallet}`} target="_blank" rel="noreferrer" className="onchain-wallet-address">
            {abbreviate(summary.wallet, 8)}
          </a>
          <span className="onchain-wallet-timeframe">{formatTimeframe(summary.timeframeSeconds)} activity window</span>
        </div>
      </div>

      {/* Metrics */}
      <div className="onchain-metrics onchain-metrics--4col">
        <div className="onchain-metric">
          <span className="onchain-metric__label">TRADES</span>
          <span className="onchain-metric__value">{summary.tradeCount.toLocaleString()}</span>
        </div>
        <div className="onchain-metric">
          <span className="onchain-metric__label">BUY VOL</span>
          <span className="onchain-metric__value">{formatVolume(getVolumes(summary).buy, 4)} SOL</span>
        </div>
        <div className="onchain-metric">
          <span className="onchain-metric__label">SELL VOL</span>
          <span className="onchain-metric__value">{formatVolume(getVolumes(summary).sell, 4)} SOL</span>
        </div>
        <div className="onchain-metric">
          <span className="onchain-metric__label">NET SOL</span>
          <span className={`onchain-metric__value ${getVolumes(summary).net > 0 ? 'onchain-metric__value--positive' : getVolumes(summary).net < 0 ? 'onchain-metric__value--negative' : ''}`}>
            {formatVolume(getVolumes(summary).net, 4)} SOL
          </span>
        </div>
      </div>

      {/* Net P&L */}
      {summary.netUsdChange !== undefined && summary.netUsdChange !== null && (
        <div className={`onchain-pnl ${summary.netUsdChange >= 0 ? 'onchain-pnl--positive' : 'onchain-pnl--negative'}`}>
          <span className="onchain-pnl__label">NET P&L</span>
          <span className="onchain-pnl__value">
            {summary.netUsdChange >= 0 ? '+' : ''}{formatUsd(summary.netUsdChange)}
          </span>
        </div>
      )}

      <RecentTradesList trades={summary.trades} />

      {/* Token Link */}
      {summary.mint && (
        <div className="onchain-footer">
          <a href={`https://solscan.io/token/${summary.mint}`} target="_blank" rel="noreferrer" className="onchain-hash">
            <span className="onchain-hash__label">Token</span>
            <span className="onchain-hash__value">{abbreviate(summary.mint, 8)}</span>
          </a>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

function OnchainActivity() {
  const toolOutput = useOpenAIGlobal('toolOutput') as OnchainPayload | null;

  // Loading
  if (!toolOutput) {
    return (
      <div className="onchain-container">
        <div className="onchain-loading">
          <div className="onchain-loading__spinner" />
          <span>Analyzing on-chain activity...</span>
        </div>
      </div>
    );
  }

  // Error
  if (toolOutput.ok === false || toolOutput.error) {
    return (
      <div className="onchain-container">
        <div className="onchain-error">
          {toolOutput.error || toolOutput.message || 'Activity lookup failed'}
        </div>
      </div>
    );
  }

  const scope = toolOutput.scope || 'token';
  const summary = toolOutput.summary;

  if (!summary) {
    return (
      <div className="onchain-container">
        <div className="onchain-error">No activity data available</div>
      </div>
    );
  }

  // Scope badge config
  const scopeConfig = {
    token: { label: 'Token', icon: '🚀' },
    wallet: { label: 'Wallet', icon: '👤' },
    trade: { label: 'Trade', icon: '📊' },
  }[scope];

  return (
    <div className="onchain-container">
      <div className="onchain-card">
        {/* Header */}
        <div className="onchain-card__header">
          <div className="onchain-card__title-row">
            <span className="onchain-card__icon">📊</span>
            <span className="onchain-card__title">On-Chain Activity</span>
          </div>
          <span className="onchain-scope-badge">
            <span>{scopeConfig.icon}</span>
            <span>{scopeConfig.label}</span>
          </span>
        </div>

        {/* Content */}
        {scope === 'token' && <TokenActivityView summary={summary as TokenActivitySummary} />}
        {scope === 'wallet' && <WalletActivityView summary={summary as WalletActivitySummary} />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mount
// ─────────────────────────────────────────────────────────────────────────────

const root = document.getElementById('onchain-activity-root');
if (root) {
  createRoot(root).render(<OnchainActivity />);
}

export default OnchainActivity;
