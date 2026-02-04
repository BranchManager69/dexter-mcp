import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/solscan-trending.css';

import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { useOpenAIGlobal } from '../sdk';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type TrendingToken = {
  rank?: number;
  symbol?: string;
  name?: string;
  mint?: string;
  address?: string;
  price?: number;
  priceChange24h?: number;
  price_change_24h?: number;
  volume24h?: number;
  volume_24h?: number;
  marketCap?: number;
  market_cap?: number;
  holders?: number;
  logoUrl?: string;
  logo_url?: string;
  image?: string;
};

type TrendingPayload = {
  tokens?: TrendingToken[];
  data?: TrendingToken[];
  results?: TrendingToken[];
  fetchedAt?: string;
  fetched_at?: string;
  error?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatPrice(value?: number): string {
  if (!value || !Number.isFinite(value)) return '$0.00';
  if (value < 0.0001) return `$${value.toExponential(2)}`;
  if (value < 1) return `$${value.toFixed(6)}`;
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatLargeNumber(value?: number): string {
  if (!value || !Number.isFinite(value)) return '—';
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function formatChange(value?: number): { text: string; isPositive: boolean } {
  if (!value || !Number.isFinite(value)) return { text: '0.00%', isPositive: true };
  const isPositive = value >= 0;
  return { text: `${isPositive ? '+' : ''}${value.toFixed(2)}%`, isPositive };
}

function shortenAddress(addr?: string): string {
  if (!addr) return '—';
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

function SolscanTrending() {
  const toolOutput = useOpenAIGlobal('toolOutput') as TrendingPayload | null;
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (!toolOutput) {
    return (
      <div className="trending-container">
        <div className="trending-loading">
          <div className="trending-loading__spinner" />
          <span>Loading trending tokens...</span>
        </div>
      </div>
    );
  }

  if (toolOutput.error) {
    return (
      <div className="trending-container">
        <div className="trending-error">{toolOutput.error}</div>
      </div>
    );
  }

  const tokens = toolOutput.tokens || toolOutput.data || toolOutput.results || [];
  const fetchedAt = toolOutput.fetchedAt || toolOutput.fetched_at;

  if (tokens.length === 0) {
    return (
      <div className="trending-container">
        <div className="trending-empty">No trending tokens found.</div>
      </div>
    );
  }

  return (
    <div className="trending-container">
      {/* Header */}
      <div className="trending-header">
        <div className="trending-header-left">
          <span className="trending-icon">🔥</span>
          <span className="trending-title">Solscan Trending</span>
        </div>
        {fetchedAt && (
          <span className="trending-timestamp">
            {new Date(fetchedAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Token List */}
      <div className="trending-list">
        {tokens.map((token, idx) => {
          const change = formatChange(token.priceChange24h || token.price_change_24h);
          const volume = token.volume24h || token.volume_24h;
          const mcap = token.marketCap || token.market_cap;
          const logo = token.logoUrl || token.logo_url || token.image;
          const address = token.mint || token.address;
          const isExpanded = expandedIdx === idx;

          return (
            <div
              key={address || idx}
              className={`trending-card ${isExpanded ? 'trending-card--expanded' : ''}`}
              onClick={() => setExpandedIdx(isExpanded ? null : idx)}
            >
              {/* Rank Badge */}
              <div className="trending-card__rank">#{token.rank || idx + 1}</div>

              {/* Token Info */}
              <div className="trending-card__main">
                <div className="trending-card__token">
                  {logo ? (
                    <img src={logo} alt={token.symbol} className="trending-card__logo" />
                  ) : (
                    <div className="trending-card__logo-placeholder">
                      {(token.symbol || '?').slice(0, 2)}
                    </div>
                  )}
                  <div className="trending-card__info">
                    <span className="trending-card__symbol">{token.symbol || 'Unknown'}</span>
                    <span className="trending-card__name">{token.name || '—'}</span>
                  </div>
                </div>

                <div className="trending-card__price-section">
                  <span className="trending-card__price">{formatPrice(token.price)}</span>
                  <span className={`trending-card__change ${change.isPositive ? 'trending-card__change--positive' : 'trending-card__change--negative'}`}>
                    {change.text}
                  </span>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="trending-card__details">
                  <div className="trending-card__metrics">
                    <div className="trending-card__metric">
                      <span className="trending-card__metric-label">Volume 24h</span>
                      <span className="trending-card__metric-value">{formatLargeNumber(volume)}</span>
                    </div>
                    <div className="trending-card__metric">
                      <span className="trending-card__metric-label">Market Cap</span>
                      <span className="trending-card__metric-value">{formatLargeNumber(mcap)}</span>
                    </div>
                    {token.holders && (
                      <div className="trending-card__metric">
                        <span className="trending-card__metric-label">Holders</span>
                        <span className="trending-card__metric-value">{token.holders.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                  {address && (
                    <a
                      href={`https://solscan.io/token/${address}`}
                      target="_blank"
                      rel="noreferrer"
                      className="trending-card__link"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View on Solscan ↗
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mount
// ─────────────────────────────────────────────────────────────────────────────

const root = document.getElementById('solscan-trending-root');
if (root) {
  createRoot(root).render(<SolscanTrending />);
}

export default SolscanTrending;
