import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/ohlcv.css';

import { createRoot } from 'react-dom/client';
import { useOpenAIGlobal } from '../sdk';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Candle = {
  t: number;
  o?: number | null;
  h?: number | null;
  l?: number | null;
  c?: number | null;
  v?: number | null;
};

type OhlcvSummary = {
  provider?: string;
  chain?: string;
  mint_address?: string;
  pair_address?: string;
  interval?: string;
  currency?: string;
  total_candles?: number;
  price_open?: number | null;
  price_close?: number | null;
  price_high?: number | null;
  price_low?: number | null;
  price_change_pct?: string | null;
  total_volume?: number;
  _truncated?: string;
};

type OhlcvPayload = {
  summary?: OhlcvSummary;
  ohlcv?: Candle[];
  error?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatPrice(value?: number | null): string {
  if (!value || !Number.isFinite(value)) return '—';
  if (value < 0.0001) return `$${value.toExponential(2)}`;
  if (value < 1) return `$${value.toFixed(6)}`;
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

function formatVolume(value?: number): string {
  if (!value || !Number.isFinite(value)) return '—';
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

function shortenAddress(addr?: string): string {
  if (!addr) return '—';
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mini Chart Component (ASCII-style bars)
// ─────────────────────────────────────────────────────────────────────────────

function MiniChart({ candles }: { candles: Candle[] }) {
  if (!candles.length) return null;
  
  const closes = candles.map(c => c.c).filter((v): v is number => v != null && Number.isFinite(v));
  if (closes.length < 2) return null;
  
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  
  // Take last 30 candles for display
  const displayCandles = candles.slice(-30);
  const isUp = (closes[closes.length - 1] || 0) >= (closes[0] || 0);
  
  return (
    <div className="ohlcv-chart">
      <div className={`ohlcv-chart__bars ${isUp ? 'ohlcv-chart__bars--up' : 'ohlcv-chart__bars--down'}`}>
        {displayCandles.map((candle, idx) => {
          const close = candle.c ?? 0;
          const height = ((close - min) / range) * 100;
          return (
            <div
              key={idx}
              className="ohlcv-chart__bar"
              style={{ height: `${Math.max(height, 5)}%` }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

function Ohlcv() {
  const toolOutput = useOpenAIGlobal('toolOutput') as OhlcvPayload | null;

  if (!toolOutput) {
    return (
      <div className="ohlcv-container">
        <div className="ohlcv-loading">
          <div className="ohlcv-loading__spinner" />
          <span>Loading OHLCV data...</span>
        </div>
      </div>
    );
  }

  if (toolOutput.error) {
    return (
      <div className="ohlcv-container">
        <div className="ohlcv-error">{toolOutput.error}</div>
      </div>
    );
  }

  const summary = toolOutput.summary;
  const candles = toolOutput.ohlcv || [];

  if (!summary && candles.length === 0) {
    return (
      <div className="ohlcv-container">
        <div className="ohlcv-empty">No OHLCV data available.</div>
      </div>
    );
  }

  const changeStr = summary?.price_change_pct;
  const isPositive = changeStr ? !changeStr.startsWith('-') : true;

  return (
    <div className="ohlcv-container">
      <div className="ohlcv-card">
        {/* Header */}
        <div className="ohlcv-header">
          <div className="ohlcv-header-left">
            <span className="ohlcv-icon">📊</span>
            <span className="ohlcv-title">OHLCV Data</span>
          </div>
          {summary?.interval && (
            <span className="ohlcv-badge">{summary.interval}</span>
          )}
        </div>

        {/* Token Info */}
        {summary?.mint_address && (
          <div className="ohlcv-token">
            <span className="ohlcv-token__label">Token</span>
            <a
              href={`https://solscan.io/token/${summary.mint_address}`}
              target="_blank"
              rel="noreferrer"
              className="ohlcv-token__address"
            >
              {shortenAddress(summary.mint_address)}
            </a>
          </div>
        )}

        {/* Mini Chart */}
        {candles.length > 0 && <MiniChart candles={candles} />}

        {/* Price Summary */}
        {summary && (
          <div className="ohlcv-summary">
            <div className="ohlcv-summary__main">
              <span className="ohlcv-summary__price">{formatPrice(summary.price_close)}</span>
              {changeStr && (
                <span className={`ohlcv-summary__change ${isPositive ? 'ohlcv-summary__change--positive' : 'ohlcv-summary__change--negative'}`}>
                  {changeStr}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Metrics */}
        {summary && (
          <div className="ohlcv-metrics">
            <div className="ohlcv-metric">
              <span className="ohlcv-metric__label">Open</span>
              <span className="ohlcv-metric__value">{formatPrice(summary.price_open)}</span>
            </div>
            <div className="ohlcv-metric">
              <span className="ohlcv-metric__label">High</span>
              <span className="ohlcv-metric__value ohlcv-metric__value--high">{formatPrice(summary.price_high)}</span>
            </div>
            <div className="ohlcv-metric">
              <span className="ohlcv-metric__label">Low</span>
              <span className="ohlcv-metric__value ohlcv-metric__value--low">{formatPrice(summary.price_low)}</span>
            </div>
            <div className="ohlcv-metric">
              <span className="ohlcv-metric__label">Volume</span>
              <span className="ohlcv-metric__value">{formatVolume(summary.total_volume)}</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="ohlcv-footer">
          {summary?.total_candles && (
            <span className="ohlcv-footer__candles">{summary.total_candles} candles</span>
          )}
          {summary?.provider && (
            <span className="ohlcv-footer__provider">{summary.provider}</span>
          )}
        </div>

        {summary?._truncated && (
          <div className="ohlcv-note">{summary._truncated}</div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mount
// ─────────────────────────────────────────────────────────────────────────────

const root = document.getElementById('ohlcv-root');
if (root) {
  createRoot(root).render(<Ohlcv />);
}

export default Ohlcv;
