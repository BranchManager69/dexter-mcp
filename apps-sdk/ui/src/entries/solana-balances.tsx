import '../styles/sdk.css';

import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { Badge } from '@openai/apps-sdk-ui/components/Badge';
import { Button } from '@openai/apps-sdk-ui/components/Button';
import { EmptyMessage } from '@openai/apps-sdk-ui/components/EmptyMessage';
import { ChevronDown, ChevronUp, ExternalLink, CreditCard, Trending } from '@openai/apps-sdk-ui/components/Icon';
import { useOpenAIGlobal } from '../sdk';
import { getTokenLogoUrl } from '../components/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type TokenMeta = {
  symbol?: string;
  name?: string;
  imageUrl?: string;
  logoUri?: string;
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
// Solana Icon (custom)
// ─────────────────────────────────────────────────────────────────────────────

function SolanaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 128 128" fill="none" className={className}>
      <defs>
        <linearGradient id="sol-bal-grad" x1="90%" y1="0%" x2="10%" y2="100%">
          <stop offset="0%" stopColor="#00FFA3" />
          <stop offset="100%" stopColor="#DC1FFF" />
        </linearGradient>
      </defs>
      <path d="M25.3 93.5c0.9-0.9 2.2-1.5 3.5-1.5h97.1c2.2 0 3.4 2.7 1.8 4.3l-24.2 24.2c-0.9 0.9-2.2 1.5-3.5 1.5H2.9c-2.2 0-3.4-2.7-1.8-4.3L25.3 93.5z" fill="url(#sol-bal-grad)" />
      <path d="M25.3 2.5c1-1 2.3-1.5 3.5-1.5h97.1c2.2 0 3.4 2.7 1.8 4.3L103.5 29.5c-0.9 0.9-2.2 1.5-3.5 1.5H2.9c-2.2 0-3.4-2.7-1.8-4.3L25.3 2.5z" fill="url(#sol-bal-grad)" />
      <path d="M102.7 47.3c-0.9-0.9-2.2-1.5-3.5-1.5H2.1c-2.2 0-3.4 2.7-1.8 4.3l24.2 24.2c0.9 0.9 2.2 1.5 3.5 1.5h97.1c2.2 0 3.4-2.7 1.8-4.3L102.7 47.3z" fill="url(#sol-bal-grad)" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Token Icon Component
// ─────────────────────────────────────────────────────────────────────────────

function TokenIcon({ symbol, imageUrl, size = 'md' }: { symbol: string; imageUrl?: string; size?: 'sm' | 'md' | 'lg' }) {
  const [error, setError] = useState(false);
  const showImage = imageUrl && !error;
  
  const sizeClasses = {
    sm: 'size-8',
    md: 'size-10',
    lg: 'size-14',
  };

  return (
    <div className={`${sizeClasses[size]} rounded-xl overflow-hidden bg-surface-secondary flex items-center justify-center flex-shrink-0`}>
      {showImage ? (
        <img
          src={imageUrl}
          alt={symbol}
          onError={() => setError(true)}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="text-sm font-bold text-secondary">{symbol.slice(0, 2)}</span>
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
  const iconUrl = pickString(
    tokenMeta?.imageUrl,
    tokenMeta?.logoUri,
    entry.icon,
    entry.logo,
    mint ? getTokenLogoUrl(mint) : undefined
  );

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
      className={`rounded-xl border p-4 cursor-pointer transition-all hover:border-default-strong ${
        isExpanded ? 'border-accent/30 bg-accent/5' : 'border-default bg-surface'
      }`}
      onClick={onToggle}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <TokenIcon symbol={symbol} imageUrl={iconUrl} size={isExpanded ? 'lg' : 'md'} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`font-semibold text-primary ${isExpanded ? 'text-lg' : 'text-sm'}`}>{symbol}</span>
              {priceChange && (
                <Badge 
                  color={isPositive ? 'success' : 'danger'} 
                  size="sm" 
                  variant="soft"
                >
                  {priceChange}
                </Badge>
              )}
            </div>
            <div className="text-xs text-tertiary truncate">{name}</div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-right">
          <div>
            <div className={`font-semibold text-primary ${isExpanded ? 'text-lg' : 'text-sm'}`}>{holdingUsd ?? '—'}</div>
            <div className="text-xs text-tertiary">{amountDisplay}</div>
          </div>
          <div className="text-tertiary">
            {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </div>
        </div>
      </div>

      {/* Collapsed footer */}
      {!isExpanded && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-subtle">
          <span className="text-xs text-tertiary">{priceUsd ?? '—'}</span>
          {volume && <span className="text-xs text-tertiary">VOL {volume}</span>}
        </div>
      )}

      {/* Expanded details */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-subtle space-y-4">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-tertiary uppercase tracking-wide">Price</div>
              <div className="text-sm font-medium text-primary mt-0.5">{priceUsd ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs text-tertiary uppercase tracking-wide">24h Change</div>
              <div className={`text-sm font-medium mt-0.5 ${isPositive ? 'text-success' : 'text-danger'}`}>
                {priceChange ?? '—'}
              </div>
            </div>
            {marketCap && (
              <div>
                <div className="text-xs text-tertiary uppercase tracking-wide">Market Cap</div>
                <div className="text-sm font-medium text-primary mt-0.5">{marketCap}</div>
              </div>
            )}
            {volume && (
              <div>
                <div className="text-xs text-tertiary uppercase tracking-wide">Volume 24h</div>
                <div className="text-sm font-medium text-primary mt-0.5">{volume}</div>
              </div>
            )}
            {liquidity && (
              <div>
                <div className="text-xs text-tertiary uppercase tracking-wide">Liquidity</div>
                <div className="text-sm font-medium text-primary mt-0.5">{liquidity}</div>
              </div>
            )}
          </div>

          {/* Links */}
          {mint && (
            <div className="flex items-center justify-between gap-2">
              <code className="text-xs text-tertiary font-mono">{abbreviate(mint, 6, 4)}</code>
              <div className="flex items-center gap-2">
                <a href={`https://solscan.io/token/${mint}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                  <Button color="secondary" variant="ghost" size="xs">
                    <span className="flex items-center gap-1">
                      Solscan
                      <ExternalLink className="size-3" />
                    </span>
                  </Button>
                </a>
                <a href={`https://birdeye.so/token/${mint}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                  <Button color="secondary" variant="ghost" size="xs">
                    <span className="flex items-center gap-1">
                      Birdeye
                      <ExternalLink className="size-3" />
                    </span>
                  </Button>
                </a>
                <a href={`https://dexscreener.com/solana/${mint}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                  <Button color="secondary" variant="ghost" size="xs">
                    <span className="flex items-center gap-1">
                      DEX
                      <ExternalLink className="size-3" />
                    </span>
                  </Button>
                </a>
              </div>
            </div>
          )}
        </div>
      )}
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

  const balances: BalanceEntry[] = Array.isArray(toolOutput)
    ? toolOutput
    : Array.isArray((toolOutput as BalancesPayload)?.balances)
      ? (toolOutput as BalancesPayload).balances!
      : [];

  // Loading
  if (!toolOutput) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-center gap-3 py-8">
          <div className="size-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-secondary text-sm">Loading balances...</span>
        </div>
      </div>
    );
  }

  // Empty
  if (balances.length === 0) {
    return (
      <div className="p-4">
        <EmptyMessage fill="none">
          <EmptyMessage.Icon>
            <CreditCard className="size-8" />
          </EmptyMessage.Icon>
          <EmptyMessage.Title>No Balances Found</EmptyMessage.Title>
          <EmptyMessage.Description>
            No token balances detected for this wallet.
          </EmptyMessage.Description>
        </EmptyMessage>
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
    <div className="p-4 space-y-4">
      {/* Total Portfolio Header */}
      <div className="rounded-xl border border-accent/30 bg-gradient-to-br from-accent/10 to-transparent p-4">
        <div className="flex items-center gap-2 text-tertiary text-xs uppercase tracking-wide mb-1">
          <Trending className="size-4" />
          Total Portfolio
        </div>
        <div className="text-3xl font-bold text-primary">{formatUsdNoCents(totalUsd)}</div>
        {totalSol !== undefined && (
          <div className="flex items-center gap-1.5 mt-2 text-sm text-secondary">
            <SolanaIcon className="size-4" />
            <span>{totalSol.toLocaleString('en-US', { maximumFractionDigits: 0 })} SOL</span>
          </div>
        )}
      </div>

      {/* Token List */}
      <div className="space-y-3">
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
        <Button 
          color="secondary" 
          variant="soft" 
          size="sm"
          onClick={() => setShowAll(!showAll)}
          className="w-full"
        >
          {showAll ? 'Collapse List' : `Show ${hiddenCount} more assets`}
        </Button>
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
