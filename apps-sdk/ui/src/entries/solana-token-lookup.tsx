import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/solana-token-lookup.css';

import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { useOpenAIGlobal, useCallTool, useSendFollowUp, useOpenExternal, useTheme } from '../sdk';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type TokenInfo = {
  symbol?: string;
  name?: string;
  imageUrl?: string;
  openGraphImageUrl?: string;
  headerImageUrl?: string;
};

type TokenMeta = {
  address?: string;
  mint?: string;
  symbol?: string;
  name?: string;
  decimals?: number;
  logoURI?: string;
  icon?: string;
  logo?: string;
  image?: string;
  info?: TokenInfo;
  priceUsd?: number;
  price_usd?: number;
  marketCap?: number;
  market_cap?: number;
  volume24h?: number;
  volume24hUsd?: number;
  liquidityUsd?: number;
  liquidity_usd?: number;
  priceChange24h?: number;
  price_change_24h?: number;
};

type TokenLookupPayload = {
  result?: TokenMeta;
  token?: TokenMeta;
  results?: TokenMeta[];
} & TokenMeta;

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

function formatUsdCompact(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatUsdPrecise(value: number): string {
  // For very small prices, show more decimals
  const decimals = value < 0.01 ? 6 : value < 1 ? 4 : 2;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function abbreviate(value: string, prefix = 4, suffix = 4): string {
  if (value.length <= prefix + suffix + 3) return value;
  return `${value.slice(0, prefix)}…${value.slice(-suffix)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Token Icon Component
// ─────────────────────────────────────────────────────────────────────────────

function TokenIcon({ symbol, imageUrl, size = 64 }: { symbol: string; imageUrl?: string; size?: number }) {
  const [error, setError] = useState(false);
  const showImage = imageUrl && !error;

  return (
    <div className="token-lookup-icon" style={{ width: size, height: size }}>
      {showImage ? (
        <img
          src={imageUrl}
          alt={symbol}
          onError={() => setError(true)}
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="token-lookup-icon__fallback" style={{ fontSize: size * 0.3 }}>{symbol.slice(0, 2)}</span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Token Card Component
// ─────────────────────────────────────────────────────────────────────────────

function TokenCard({ token }: { token: TokenMeta }) {
  const { callTool } = useCallTool();
  const sendFollowUp = useSendFollowUp();
  const openExternal = useOpenExternal();
  const [isQuoting, setIsQuoting] = useState(false);

  const info = token.info;
  const address = pickString(token.address, token.mint);
  const symbol = pickString(token.symbol, info?.symbol) ?? 'UNKNOWN';
  const name = pickString(token.name, info?.name) ?? symbol;
  const imageUrl = pickString(
    info?.imageUrl,
    info?.openGraphImageUrl,
    info?.headerImageUrl,
    token.logoURI,
    token.icon,
    token.logo,
    token.image,
  );

  const priceRaw = pickNumber(token.priceUsd, token.price_usd);
  const price = priceRaw !== undefined ? formatUsdPrecise(priceRaw) : undefined;

  const priceChangeRaw = pickNumber(token.priceChange24h, token.price_change_24h);
  const priceChange = priceChangeRaw !== undefined ? formatPercent(priceChangeRaw) : undefined;
  const isPositive = priceChangeRaw !== undefined && priceChangeRaw >= 0;

  const marketCapRaw = pickNumber(token.marketCap, token.market_cap);
  const marketCap = marketCapRaw !== undefined ? formatUsdCompact(marketCapRaw) : undefined;

  const volumeRaw = pickNumber(token.volume24hUsd, token.volume24h);
  const volume = volumeRaw !== undefined ? formatUsdCompact(volumeRaw) : undefined;

  const liquidityRaw = pickNumber(token.liquidityUsd, token.liquidity_usd);
  const liquidity = liquidityRaw !== undefined ? formatUsdCompact(liquidityRaw) : undefined;

  // Action handlers
  const handleGetQuote = async () => {
    if (!address) return;
    setIsQuoting(true);
    await callTool('solana_swap_preview', {
      outputMint: address,
      amount: 1,
    });
    setIsQuoting(false);
  };

  const handleCheckSlippage = async () => {
    if (!address) return;
    await callTool('slippage_sentinel', {
      token_out: address,
    });
  };

  const handleAnalyze = async () => {
    await sendFollowUp(`Give me a detailed analysis of ${symbol} (${address})`);
  };

  return (
    <div className={`token-lookup-card ${isPositive ? 'token-lookup-card--positive' : 'token-lookup-card--negative'}`}>
      {/* Glow effect */}
      <div className={`token-lookup-card__glow ${isPositive ? 'token-lookup-card__glow--positive' : 'token-lookup-card__glow--negative'}`} />

      <div className="token-lookup-card__content">
        {/* Header */}
        <div className="token-lookup-card__header">
          <TokenIcon symbol={symbol} imageUrl={imageUrl} size={64} />
          
          <div className="token-lookup-card__info">
            <h3 className="token-lookup-card__name">{name}</h3>
            <span className="token-lookup-card__symbol">{symbol}</span>
          </div>

          <div className="token-lookup-card__price-block">
            <span className="token-lookup-card__price">{price ?? '—'}</span>
            {priceChange && (
              <span className={`token-lookup-card__change ${isPositive ? 'token-lookup-card__change--positive' : 'token-lookup-card__change--negative'}`}>
                {priceChange}
              </span>
            )}
          </div>
        </div>

        {/* Metrics */}
        <div className="token-lookup-card__metrics">
          {marketCap && (
            <div className="token-lookup-card__metric">
              <span className="token-lookup-card__metric-label">MCAP</span>
              <span className="token-lookup-card__metric-value">{marketCap}</span>
            </div>
          )}
          {volume && (
            <div className="token-lookup-card__metric">
              <span className="token-lookup-card__metric-label">VOL (24H)</span>
              <span className="token-lookup-card__metric-value">{volume}</span>
            </div>
          )}
          {liquidity && (
            <div className="token-lookup-card__metric">
              <span className="token-lookup-card__metric-label">LIQUIDITY</span>
              <span className="token-lookup-card__metric-value">{liquidity}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="token-lookup-card__actions">
          <button className="token-action-btn token-action-btn--primary" onClick={handleGetQuote} disabled={isQuoting}>
            {isQuoting ? 'Getting Quote...' : 'Get Swap Quote'}
          </button>
          <button className="token-action-btn" onClick={handleCheckSlippage}>
            Check Slippage
          </button>
          <button className="token-action-btn" onClick={handleAnalyze}>
            Deep Analysis
          </button>
        </div>

        {/* Footer */}
        <div className="token-lookup-card__footer">
          {address && (
            <span className="token-lookup-card__mint" title={address}>
              {abbreviate(address)}
            </span>
          )}
          <div className="token-lookup-card__links">
            {address && (
              <>
                <button className="token-link-btn" onClick={() => openExternal(`https://solscan.io/token/${address}`)}>Solscan</button>
                <button className="token-link-btn" onClick={() => openExternal(`https://birdeye.so/token/${address}`)}>Birdeye</button>
                <button className="token-link-btn" onClick={() => openExternal(`https://dexscreener.com/solana/${address}`)}>Chart</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

function SolanaTokenLookup() {
  const toolOutput = useOpenAIGlobal('toolOutput') as TokenLookupPayload | null;
  const theme = useTheme();

  // Loading
  if (!toolOutput) {
    return (
      <div className="token-lookup-container" data-theme={theme}>
        <div className="token-lookup-loading">
          <div className="token-lookup-loading__skeleton" />
          <div className="token-lookup-loading__skeleton token-lookup-loading__skeleton--small" />
        </div>
      </div>
    );
  }

  // Parse tokens - handle multiple formats
  let tokens: TokenMeta[] = [];
  
  if (Array.isArray(toolOutput.results)) {
    tokens = toolOutput.results;
  } else if (toolOutput.result) {
    tokens = [toolOutput.result];
  } else if (toolOutput.token) {
    tokens = [toolOutput.token];
  } else if (toolOutput.address || toolOutput.mint || toolOutput.symbol) {
    tokens = [toolOutput as TokenMeta];
  }

  // Empty state
  if (tokens.length === 0) {
    return (
      <div className="token-lookup-container" data-theme={theme}>
        <div className="token-lookup-empty">No tokens found.</div>
      </div>
    );
  }

  // Show up to 3 tokens
  const visibleTokens = tokens.slice(0, 3);

  return (
    <div className="token-lookup-container" data-theme={theme}>
      <div className="token-lookup-header">
        <span className="token-lookup-title">Token Analysis</span>
      </div>
      <div className="token-lookup-list">
        {visibleTokens.map((token, index) => (
          <TokenCard key={token.address || token.mint || index} token={token} />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mount
// ─────────────────────────────────────────────────────────────────────────────

const root = document.getElementById('solana-token-lookup-root');
if (root) {
  createRoot(root).render(<SolanaTokenLookup />);
}

export default SolanaTokenLookup;
