import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/solscan-trending.css';

import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { useOpenAIGlobal } from '../sdk';
import { getTokenLogoUrl } from '../components/utils';

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
// Token Icon Component
// ─────────────────────────────────────────────────────────────────────────────

function TokenIcon({ symbol, imageUrl, size = 42 }: { symbol: string; imageUrl?: string; size?: number }) {
  const [error, setError] = useState(false);
  const showImage = imageUrl && !error;

  return (
    <div className="trending-token-icon" style={{ width: size, height: size }}>
      {showImage ? (
        <img
          src={imageUrl}
          alt={symbol}
          onError={() => setError(true)}
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="trending-token-icon__fallback">{(symbol || '?').slice(0, 2)}</span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Token Card Component
// ─────────────────────────────────────────────────────────────────────────────

function TokenCard({
  token,
  rank,
  isExpanded,
  onToggle,
}: {
  token: TrendingToken;
  rank: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const change = formatChange(token.priceChange24h || token.price_change_24h);
  const volume = token.volume24h || token.volume_24h;
  const mcap = token.marketCap || token.market_cap;
  const address = token.mint || token.address;
  // Try API-provided logo first, fall back to DexScreener CDN
  const logo = token.logoUrl || token.logo_url || token.image || (address ? getTokenLogoUrl(address) : undefined);

  return (
    <div
      className={`trending-card ${isExpanded ? 'trending-card--expanded' : ''} ${change.isPositive ? 'trending-card--positive' : 'trending-card--negative'}`}
      onClick={onToggle}
    >
      {/* Glow effect */}
      <div className={`trending-card__glow ${change.isPositive ? 'trending-card__glow--positive' : 'trending-card__glow--negative'}`} />

      <div className="trending-card__content">
        {/* Header */}
        <div className="trending-card__header">
          <div className="trending-card__token">
            <div className="trending-card__rank-badge">#{rank}</div>
            <TokenIcon symbol={token.symbol || '?'} imageUrl={logo} size={isExpanded ? 56 : 42} />
            <div className="trending-card__token-info">
              <span className={`trending-card__symbol ${isExpanded ? 'trending-card__symbol--large' : ''}`}>
                {token.symbol || 'Unknown'}
              </span>
              <span className="trending-card__name">{token.name || '—'}</span>
            </div>
          </div>
          <div className="trending-card__value">
            <span className={`trending-card__price ${isExpanded ? 'trending-card__price--large' : ''}`}>
              {formatPrice(token.price)}
            </span>
            <span className={`trending-card__change ${change.isPositive ? 'trending-card__change--positive' : 'trending-card__change--negative'}`}>
              {change.text}
            </span>
          </div>
        </div>

        <div className="trending-card__divider" />

        {/* Compact footer (when collapsed) */}
        {!isExpanded && (
          <div className="trending-card__footer">
            <div className="trending-card__stats">
              {mcap && <span className="trending-card__stat">MC {formatLargeNumber(mcap)}</span>}
              {volume && <span className="trending-card__stat">VOL {formatLargeNumber(volume)}</span>}
            </div>
          </div>
        )}

        {/* Expanded details */}
        {isExpanded && (
          <div className="trending-card__details">
            <div className="trending-card__metrics">
              <div className="trending-card__metric">
                <span className="trending-card__metric-label">MARKET CAP</span>
                <span className="trending-card__metric-value">{formatLargeNumber(mcap)}</span>
              </div>
              <div className="trending-card__metric">
                <span className="trending-card__metric-label">VOL (24H)</span>
                <span className="trending-card__metric-value">{formatLargeNumber(volume)}</span>
              </div>
              {token.holders && (
                <div className="trending-card__metric">
                  <span className="trending-card__metric-label">HOLDERS</span>
                  <span className="trending-card__metric-value">{token.holders.toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Links */}
            <div className="trending-card__links">
              {address && (
                <span className="trending-card__mint" title={address}>
                  {shortenAddress(address)}
                </span>
              )}
              <div className="trending-card__external-links">
                {address && (
                  <>
                    <a href={`https://solscan.io/token/${address}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>Solscan</a>
                    <a href={`https://birdeye.so/token/${address}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>Birdeye</a>
                    <a href={`https://dexscreener.com/solana/${address}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>Dexscreener</a>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
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
        <div className="trending-header__gradient" />
        <div className="trending-header__content">
          <div className="trending-header__left">
            <span className="trending-header__icon">🔥</span>
            <div className="trending-header__text">
              <span className="trending-header__label">Solscan</span>
              <span className="trending-header__title">Trending Tokens</span>
            </div>
          </div>
          {fetchedAt && (
            <span className="trending-header__timestamp">
              {new Date(fetchedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Token Grid */}
      <div className="trending-grid">
        {tokens.map((token, idx) => (
          <TokenCard
            key={token.mint || token.address || idx}
            token={token}
            rank={token.rank || idx + 1}
            isExpanded={expandedIdx === idx}
            onToggle={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
          />
        ))}
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
