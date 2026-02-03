import '../styles/global.css';

import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { useOpenAIGlobal } from '../sdk';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type StreamEntry = {
  name?: string;
  symbol?: string;
  mintId?: string;
  channel?: string;
  url?: string;
  streamUrl?: string;
  thumbnail?: string;
  currentViewers?: number;
  viewer_count?: number;
  viewers?: number;
  marketCapUsd?: number;
  market_cap_usd?: number;
  marketCap?: number;
  momentum?: number | string;
  signal?: number | string;
};

type PumpstreamPayload = {
  streams?: StreamEntry[];
  generatedAt?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function pickNumber(...values: (number | string | null | undefined)[]): number | undefined {
  for (const v of values) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const n = Number(v.replace(/%/g, ''));
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

function formatViewerCount(value?: number): string {
  if (value === undefined) return '—';
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toString();
}

function formatCurrency(value?: number): string {
  if (value === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMomentum(value?: number): string {
  if (value === undefined) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Token Icon
// ─────────────────────────────────────────────────────────────────────────────

function TokenIcon({ symbol, size = 48 }: { symbol: string; size?: number }) {
  return (
    <div className="pumpstream-token-icon" style={{ width: size, height: size }}>
      <span style={{ fontSize: size * 0.35 }}>{symbol.slice(0, 2).toUpperCase()}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stream Card
// ─────────────────────────────────────────────────────────────────────────────

function StreamCard({ stream, index }: { stream: StreamEntry; index: number }) {
  const [imgError, setImgError] = useState(false);
  
  const title = stream.name || stream.symbol || stream.mintId || stream.channel || `Stream ${index + 1}`;
  const viewers = pickNumber(stream.currentViewers, stream.viewer_count, stream.viewers);
  const marketCap = pickNumber(stream.marketCapUsd, stream.market_cap_usd, stream.marketCap);
  const momentumRaw = pickNumber(stream.momentum, stream.signal);
  const isPositive = momentumRaw !== undefined && momentumRaw >= 0;
  
  const href = stream.url || stream.streamUrl || (stream.mintId ? `https://pump.fun/${stream.mintId}` : undefined);
  const showThumbnail = stream.thumbnail && !imgError;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="pumpstream-card"
    >
      {/* Thumbnail */}
      <div className="pumpstream-card__thumbnail">
        {showThumbnail ? (
          <img
            src={stream.thumbnail}
            alt={title}
            onError={() => setImgError(true)}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="pumpstream-card__thumbnail-fallback">
            <TokenIcon symbol={title} size={48} />
          </div>
        )}
        
        {/* Live Badge */}
        <div className="pumpstream-card__live-badge">
          <span className="pumpstream-card__live-dot" />
          <span>LIVE</span>
        </div>

        {/* Viewer Count */}
        {viewers !== undefined && (
          <div className="pumpstream-card__viewers">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span>{formatViewerCount(viewers)}</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="pumpstream-card__content">
        <div className="pumpstream-card__header">
          <span className="pumpstream-card__title">{title}</span>
          {stream.symbol && (
            <span className="pumpstream-card__symbol">{stream.symbol}</span>
          )}
        </div>

        <div className="pumpstream-card__metrics">
          <div className="pumpstream-card__metric">
            <span className="pumpstream-card__metric-label">MCAP</span>
            <span className="pumpstream-card__metric-value">{formatCurrency(marketCap)}</span>
          </div>
          
          {momentumRaw !== undefined && (
            <div className="pumpstream-card__metric pumpstream-card__metric--right">
              <span className="pumpstream-card__metric-label">MOMENTUM</span>
              <span className={`pumpstream-card__metric-value ${isPositive ? 'pumpstream-card__metric-value--positive' : 'pumpstream-card__metric-value--negative'}`}>
                {formatMomentum(momentumRaw)}
              </span>
            </div>
          )}
        </div>
      </div>
    </a>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

function Pumpstream() {
  const toolOutput = useOpenAIGlobal('toolOutput') as PumpstreamPayload | null;
  const [showAll, setShowAll] = useState(false);

  // Loading
  if (!toolOutput) {
    return (
      <div className="pumpstream-container">
        <div className="pumpstream-loading">
          <div className="pumpstream-loading__spinner" />
          <span>Loading live streams...</span>
        </div>
      </div>
    );
  }

  const streams = Array.isArray(toolOutput.streams) ? toolOutput.streams : [];
  
  // Empty
  if (streams.length === 0) {
    return (
      <div className="pumpstream-container">
        <div className="pumpstream-empty">No active Pump.fun streams detected.</div>
      </div>
    );
  }

  const visibleStreams = showAll ? streams : streams.slice(0, 6);
  const hiddenCount = streams.length - visibleStreams.length;

  return (
    <div className="pumpstream-container">
      {/* Header */}
      <div className="pumpstream-header">
        <span className="pumpstream-title">Live Streams</span>
        <div className="pumpstream-header__badges">
          <span className="pumpstream-live-indicator">
            <span className="pumpstream-live-indicator__dot" />
            <span className="pumpstream-live-indicator__ping" />
            <span>Live</span>
          </span>
          <span className="pumpstream-count">{streams.length} streams</span>
        </div>
      </div>

      {/* Grid */}
      <div className="pumpstream-grid">
        {visibleStreams.map((stream, index) => (
          <StreamCard 
            key={stream.mintId || stream.url || `${stream.name}-${index}`} 
            stream={stream} 
            index={index} 
          />
        ))}
      </div>

      {/* Show More */}
      {hiddenCount > 0 && (
        <button className="pumpstream-show-more" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Collapse' : `Show ${hiddenCount} more streams`}
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mount
// ─────────────────────────────────────────────────────────────────────────────

const root = document.getElementById('pumpstream-root');
if (root) {
  createRoot(root).render(<Pumpstream />);
}

export default Pumpstream;
