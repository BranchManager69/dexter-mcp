import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/solana-balances.css';

import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { useOpenAIGlobal } from '../sdk';
import { getTokenLogoUrl } from '../components/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type TokenMeta = {
  symbol?: string;
  name?: string;
  imageUrl?: string;
  logoUri?: string;           // MCP normalised field
  headerImageUrl?: string;
  openGraphImageUrl?: string;
  priceUsd?: number;
  price_usd?: number;
  priceChange24h?: number;
  price_change_24h?: number;
  holdingUsd?: number;
  balanceUsd?: number;
  balance_usd?: number;
  marketCap?: number;
  market_cap?: number;
  volume24hUsd?: number;
  volume24h?: number;
  liquidityUsd?: number;
  liquidity_usd?: number;
};

type BalanceEntry = {
  mint?: string;
  ata?: string;
  amountUi?: number;
  amount_ui?: number;
  decimals?: number;
  token?: TokenMeta;
  icon?: string;
  logo?: string;
};

type BalancesPayload = {
  balances?: BalanceEntry[];
};

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

function symbolFromMint(mint?: string): string | undefined {
  if (!mint) return undefined;
  // No hardcoded lookup - use truncated mint as fallback
  return mint.slice(0, 4).toUpperCase();
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
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 6,
  }).format(value);
}

function formatUsdNoCents(value: number): string {
  return '$' + Math.round(value).toLocaleString('en-US');
}

function formatPercent(value: number): string {
  // API returns percentage * 100, so divide by 100
  const corrected = value / 100;
  return `${corrected >= 0 ? '+' : ''}${corrected.toFixed(2)}%`;
}

function formatAmount(amount?: number, decimals?: number): string | undefined {
  if (amount === undefined) return undefined;
  const maxDigits = decimals && decimals > 4 ? 4 : decimals ?? 6;
  return amount.toLocaleString('en-US', { maximumFractionDigits: maxDigits });
}

function abbreviate(value: string, prefix = 4, suffix = 4): string {
  if (value.length <= prefix + suffix + 3) return value;
  return `${value.slice(0, prefix)}…${value.slice(-suffix)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Solana Icon SVG
// ─────────────────────────────────────────────────────────────────────────────

function SolanaIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" fill="none">
      <defs>
        <linearGradient id="sol-grad" x1="90%" y1="0%" x2="10%" y2="100%">
          <stop offset="0%" stopColor="#00FFA3" />
          <stop offset="100%" stopColor="#DC1FFF" />
        </linearGradient>
      </defs>
      <path d="M25.3 93.5c0.9-0.9 2.2-1.5 3.5-1.5h97.1c2.2 0 3.4 2.7 1.8 4.3l-24.2 24.2c-0.9 0.9-2.2 1.5-3.5 1.5H2.9c-2.2 0-3.4-2.7-1.8-4.3L25.3 93.5z" fill="url(#sol-grad)" />
      <path d="M25.3 2.5c1-1 2.3-1.5 3.5-1.5h97.1c2.2 0 3.4 2.7 1.8 4.3L103.5 29.5c-0.9 0.9-2.2 1.5-3.5 1.5H2.9c-2.2 0-3.4-2.7-1.8-4.3L25.3 2.5z" fill="url(#sol-grad)" />
      <path d="M102.7 47.3c-0.9-0.9-2.2-1.5-3.5-1.5H2.1c-2.2 0-3.4 2.7-1.8 4.3l24.2 24.2c0.9 0.9 2.2 1.5 3.5 1.5h97.1c2.2 0 3.4-2.7 1.8-4.3L102.7 47.3z" fill="url(#sol-grad)" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Token Icon Component
// ─────────────────────────────────────────────────────────────────────────────

function TokenIcon({ symbol, imageUrl, size = 42 }: { symbol: string; imageUrl?: string; size?: number }) {
  const [error, setError] = useState(false);
  const showImage = imageUrl && !error;

  return (
    <div className="balances-token-icon" style={{ width: size, height: size }}>
      {showImage ? (
        <img
          src={imageUrl}
          alt={symbol}
          onError={() => setError(true)}
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="balances-token-icon__fallback">{symbol.slice(0, 2)}</span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Token Card Component
// ─────────────────────────────────────────────────────────────────────────────

function TokenCard({
  entry,
  index,
  isExpanded,
  onToggle,
}: {
  entry: BalanceEntry;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const tokenMeta = entry.token;
  const mint = pickString(entry.mint);
  
  const symbol = pickString(tokenMeta?.symbol) ?? symbolFromMint(mint) ?? `Token ${index + 1}`;
  const name = pickString(tokenMeta?.name) ?? symbol;
  // Get images from API response, fall back to DexScreener CDN for any token
  const iconUrl = pickString(
    tokenMeta?.imageUrl,
    tokenMeta?.logoUri,
    entry.icon,
    entry.logo,
    mint ? getTokenLogoUrl(mint) : undefined
  );
  const bannerUrl = pickString(tokenMeta?.headerImageUrl, tokenMeta?.openGraphImageUrl);

  const amountUi = pickNumber(entry.amountUi, entry.amount_ui);
  const amountDisplay = formatAmount(amountUi, entry.decimals);

  const priceUsdRaw = pickNumber(tokenMeta?.priceUsd, tokenMeta?.price_usd);
  const priceUsd = priceUsdRaw !== undefined ? formatUsdPrecise(priceUsdRaw) : undefined;

  const priceChangeRaw = pickNumber(tokenMeta?.priceChange24h, tokenMeta?.price_change_24h);
  const priceChange = priceChangeRaw !== undefined ? formatPercent(priceChangeRaw) : undefined;
  const isPositive = priceChangeRaw !== undefined && priceChangeRaw >= 0;

  const holdingUsdRaw = pickNumber(tokenMeta?.holdingUsd, tokenMeta?.balanceUsd, tokenMeta?.balance_usd)
    ?? (priceUsdRaw && amountUi ? priceUsdRaw * amountUi : undefined);
  const holdingUsd = holdingUsdRaw !== undefined ? formatUsdNoCents(holdingUsdRaw) : undefined;

  const marketCapRaw = pickNumber(tokenMeta?.marketCap, tokenMeta?.market_cap);
  const marketCap = marketCapRaw !== undefined ? formatUsdCompact(marketCapRaw) : undefined;

  const volumeRaw = pickNumber(tokenMeta?.volume24hUsd, tokenMeta?.volume24h);
  const volume = volumeRaw !== undefined ? formatUsdCompact(volumeRaw) : undefined;

  const liquidityRaw = pickNumber(tokenMeta?.liquidityUsd, tokenMeta?.liquidity_usd);
  const liquidity = liquidityRaw !== undefined ? formatUsdCompact(liquidityRaw) : undefined;

  return (
    <div
      className={`balances-card ${isExpanded ? 'balances-card--expanded' : ''} ${isPositive ? 'balances-card--positive' : 'balances-card--negative'}`}
      onClick={onToggle}
    >
      {/* Banner backdrop */}
      {bannerUrl && (
        <div className="balances-card__banner" style={{ backgroundImage: `url(${bannerUrl})` }} />
      )}
      
      {/* Glow effect */}
      <div className={`balances-card__glow ${isPositive ? 'balances-card__glow--positive' : 'balances-card__glow--negative'}`} />

      <div className="balances-card__content">
        {/* Header */}
        <div className="balances-card__header">
          <div className="balances-card__token">
            <TokenIcon symbol={symbol} imageUrl={iconUrl} size={isExpanded ? 56 : 42} />
            <div className="balances-card__token-info">
              <span className={`balances-card__symbol ${isExpanded ? 'balances-card__symbol--large' : ''}`}>{symbol}</span>
              <span className="balances-card__name">{name}</span>
            </div>
          </div>
          <div className="balances-card__value">
            <span className={`balances-card__holding ${isExpanded ? 'balances-card__holding--large' : ''}`}>{holdingUsd ?? '—'}</span>
            <span className="balances-card__amount">{amountDisplay}</span>
          </div>
        </div>

        <div className="balances-card__divider" />

        {/* Compact footer (when collapsed) */}
        {!isExpanded && (
          <div className="balances-card__footer">
            <div className="balances-card__price-row">
              <span className="balances-card__price">{priceUsd ?? '—'}</span>
              <span className={`balances-card__change ${isPositive ? 'balances-card__change--positive' : 'balances-card__change--negative'}`}>
                {priceChange ?? '—'}
              </span>
            </div>
            {volume && <span className="balances-card__volume">VOL {volume}</span>}
          </div>
        )}

        {/* Expanded details */}
        {isExpanded && (
          <div className="balances-card__details">
            <div className="balances-card__metrics">
              <div className="balances-card__metric">
                <span className="balances-card__metric-label">PRICE</span>
                <span className="balances-card__metric-value">{priceUsd ?? '—'}</span>
              </div>
              <div className="balances-card__metric">
                <span className="balances-card__metric-label">24H CHANGE</span>
                <span className={`balances-card__metric-value ${isPositive ? 'balances-card__change--positive' : 'balances-card__change--negative'}`}>
                  {priceChange ?? '—'}
                </span>
              </div>
              {marketCap && (
                <div className="balances-card__metric">
                  <span className="balances-card__metric-label">MCAP</span>
                  <span className="balances-card__metric-value">{marketCap}</span>
                </div>
              )}
              {volume && (
                <div className="balances-card__metric">
                  <span className="balances-card__metric-label">VOL (24H)</span>
                  <span className="balances-card__metric-value">{volume}</span>
                </div>
              )}
              {liquidity && (
                <div className="balances-card__metric">
                  <span className="balances-card__metric-label">LIQUIDITY</span>
                  <span className="balances-card__metric-value">{liquidity}</span>
                </div>
              )}
            </div>

            {/* Links */}
            <div className="balances-card__links">
              {mint && (
                <span className="balances-card__mint" title={mint}>
                  {abbreviate(mint)}
                </span>
              )}
              <div className="balances-card__external-links">
                {mint && (
                  <>
                    <a href={`https://solscan.io/token/${mint}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>Solscan</a>
                    <a href={`https://birdeye.so/token/${mint}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>Birdeye</a>
                    <a href={`https://dexscreener.com/solana/${mint}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>Dexscreener</a>
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

function SolanaBalances() {
  const toolOutput = useOpenAIGlobal('toolOutput') as BalancesPayload | BalanceEntry[] | null;
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  // Parse balances from various formats
  const balances: BalanceEntry[] = Array.isArray(toolOutput)
    ? toolOutput
    : Array.isArray((toolOutput as BalancesPayload)?.balances)
      ? (toolOutput as BalancesPayload).balances!
      : [];

  // Loading
  if (!toolOutput) {
    return (
      <div className="balances-container">
        <div className="balances-loading">
          <div className="balances-loading__spinner" />
          <span>Loading balances...</span>
        </div>
      </div>
    );
  }

  // Empty
  if (balances.length === 0) {
    return (
      <div className="balances-container">
        <div className="balances-empty">No balances detected for this wallet.</div>
      </div>
    );
  }

  // Calculate totals
  let totalUsd = 0;
  let solPriceUsd = 0;

  for (const entry of balances) {
    const tokenMeta = entry.token;
    const holdingUsd = pickNumber(tokenMeta?.holdingUsd, tokenMeta?.balanceUsd, tokenMeta?.balance_usd);
    const priceUsd = pickNumber(tokenMeta?.priceUsd, tokenMeta?.price_usd);
    const amountUi = pickNumber(entry.amountUi, entry.amount_ui);

    const symbol = pickString(tokenMeta?.symbol);
    if (symbol === 'SOL' && priceUsd) {
      solPriceUsd = priceUsd;
    }

    const value = holdingUsd ?? (priceUsd && amountUi ? priceUsd * amountUi : 0);
    if (value && Number.isFinite(value)) {
      totalUsd += value;
    }
  }

  const totalSol = solPriceUsd > 0 ? totalUsd / solPriceUsd : undefined;

  // Sort by value
  const getEntryValue = (e: BalanceEntry): number => {
    const tm = e.token;
    const h = pickNumber(tm?.holdingUsd, tm?.balanceUsd, tm?.balance_usd);
    const p = pickNumber(tm?.priceUsd, tm?.price_usd);
    const a = pickNumber(e.amountUi, e.amount_ui);
    return h ?? (p && a ? p * a : 0) ?? 0;
  };

  const valuedBalances = balances.filter(e => getEntryValue(e) > 0).sort((a, b) => getEntryValue(b) - getEntryValue(a));
  const unvaluedBalances = balances.filter(e => getEntryValue(e) <= 0);

  const visibleBalances = showAll ? [...valuedBalances, ...unvaluedBalances] : valuedBalances.slice(0, 6);
  const hiddenCount = showAll ? 0 : Math.max(0, valuedBalances.length - 6) + unvaluedBalances.length;

  return (
    <div className="balances-container">
      {/* Total Portfolio Header */}
      <div className="balances-total">
        <div className="balances-total__gradient" />
        <div className="balances-total__content">
          <span className="balances-total__label">Total Portfolio</span>
          <span className="balances-total__value">{formatUsdNoCents(totalUsd)}</span>
          {totalSol !== undefined && (
            <span className="balances-total__sol">
              <SolanaIcon size={14} />
              <span>{totalSol.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
            </span>
          )}
        </div>
      </div>

      {/* Token Grid */}
      <div className="balances-grid">
        {visibleBalances.map((entry, index) => (
          <TokenCard
            key={`${index}-${entry.mint || entry.ata || 'unknown'}`}
            entry={entry}
            index={index}
            isExpanded={expandedIndex === index}
            onToggle={() => setExpandedIndex(expandedIndex === index ? null : index)}
          />
        ))}
      </div>

      {/* Show More Button */}
      {hiddenCount > 0 && (
        <button className="balances-show-more" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Collapse List' : `Show ${hiddenCount} more assets`}
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mount
// ─────────────────────────────────────────────────────────────────────────────

const root = document.getElementById('solana-balances-root');
if (root) {
  createRoot(root).render(<SolanaBalances />);
}

export default SolanaBalances;
