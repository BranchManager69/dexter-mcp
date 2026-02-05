import '../styles/sdk.css';

import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { Badge } from '@openai/apps-sdk-ui/components/Badge';
import { Button } from '@openai/apps-sdk-ui/components/Button';
import { Alert } from '@openai/apps-sdk-ui/components/Alert';
import { EmptyMessage } from '@openai/apps-sdk-ui/components/EmptyMessage';
import { Check, Warning, ExternalLink, Globe, Search, ChevronRight } from '@openai/apps-sdk-ui/components/Icon';
import { useOpenAIGlobal, useCallTool, useSendFollowUp, useOpenExternal } from '../sdk';
import { getTokenLogoUrl } from '../components/utils';

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

type SecurityAudit = {
  isSus?: boolean;
  mintAuthorityDisabled?: boolean;
  freezeAuthorityDisabled?: boolean;
  topHoldersPercentage?: number;
  devBalancePercentage?: number;
  highSingleOwnership?: boolean;
};

type TokenMeta = {
  address?: string;
  mint?: string;
  symbol?: string;
  name?: string;
  decimals?: number;
  logoUri?: string;
  logoURI?: string;
  imageUrl?: string;
  headerImageUrl?: string;
  openGraphImageUrl?: string;
  icon?: string;
  logo?: string;
  image?: string;
  info?: TokenInfo;
  priceUsd?: number;
  price_usd?: number;
  marketCap?: number;
  market_cap?: number;
  fdvUsd?: number;
  volume24h?: number;
  volume24hUsd?: number;
  liquidityUsd?: number;
  liquidity_usd?: number;
  priceChange24h?: number;
  price_change_24h?: number;
  priceChange24hPct?: number;
  websiteUrl?: string;
  twitterUrl?: string;
  telegramUrl?: string;
  discordUrl?: string;
  pairUrl?: string;
  isVerified?: boolean;
  organicScore?: number;
  organicScoreLabel?: string;
  jupiterTags?: string[];
  holderCount?: number;
  audit?: SecurityAudit;
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

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact' }).format(value);
}

function abbreviate(value: string, prefix = 4, suffix = 4): string {
  if (value.length <= prefix + suffix + 3) return value;
  return `${value.slice(0, prefix)}…${value.slice(-suffix)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Icon Components
// ─────────────────────────────────────────────────────────────────────────────

function TokenIcon({ symbol, imageUrl, size = 'lg' }: { symbol: string; imageUrl?: string; size?: 'md' | 'lg' }) {
  const [error, setError] = useState(false);
  const showImage = imageUrl && !error;
  const sizeClass = size === 'lg' ? 'size-16' : 'size-12';

  return (
    <div className={`${sizeClass} rounded-2xl overflow-hidden bg-surface-secondary flex items-center justify-center flex-shrink-0`}>
      {showImage ? (
        <img
          src={imageUrl}
          alt={symbol}
          onError={() => setError(true)}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="text-xl font-bold text-secondary">{symbol.slice(0, 2)}</span>
      )}
    </div>
  );
}

// Social icons (custom, not in SDK)
function TwitterIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
    </svg>
  );
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Security Audit Component
// ─────────────────────────────────────────────────────────────────────────────

function SecurityAuditSection({ audit }: { audit: SecurityAudit }) {
  const isSus = audit.isSus === true;

  const items = [
    { label: 'Mint Disabled', ok: audit.mintAuthorityDisabled === true },
    { label: 'Freeze Disabled', ok: audit.freezeAuthorityDisabled === true },
    { label: 'Low Whale Risk', ok: !audit.highSingleOwnership },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-tertiary uppercase tracking-wide font-medium">Security</span>
        {isSus && (
          <Badge color="danger" size="sm" variant="soft">
            <span className="flex items-center gap-1">
              <Warning className="size-3" />
              Suspicious
            </span>
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5">
            {item.ok ? (
              <Check className="size-3.5 text-success" />
            ) : (
              <Warning className="size-3.5 text-warning" />
            )}
            <span className={`text-xs ${item.ok ? 'text-secondary' : 'text-warning'}`}>{item.label}</span>
          </div>
        ))}
      </div>
      {audit.topHoldersPercentage !== undefined && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-tertiary">Top Holders</span>
          <span className={audit.topHoldersPercentage > 50 ? 'text-warning font-medium' : 'text-secondary'}>
            {audit.topHoldersPercentage.toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Organic Score Component
// ─────────────────────────────────────────────────────────────────────────────

function OrganicScoreMeter({ score, label }: { score: number; label?: string }) {
  const color = score >= 70 ? 'bg-success' : score >= 40 ? 'bg-warning' : 'bg-danger';
  
  return (
    <div className="space-y-1.5">
      <div className="h-2 bg-surface-secondary rounded-full overflow-hidden">
        <div 
          className={`h-full ${color} rounded-full transition-all`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-primary">{score.toFixed(0)}</span>
        {label && <span className="text-tertiary">{label}</span>}
      </div>
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
    token.logoUri,
    token.imageUrl,
    info?.imageUrl,
    token.logoURI,
    token.icon,
    token.logo,
    token.image,
    address ? getTokenLogoUrl(address) : undefined,
  );

  // Price data
  const priceRaw = pickNumber(token.priceUsd, token.price_usd);
  const price = priceRaw !== undefined ? formatUsdPrecise(priceRaw) : undefined;
  const priceChangeRaw = pickNumber(token.priceChange24h, token.price_change_24h, token.priceChange24hPct);
  const priceChange = priceChangeRaw !== undefined ? formatPercent(priceChangeRaw) : undefined;
  const isPositive = priceChangeRaw !== undefined && priceChangeRaw >= 0;

  // Metrics
  const marketCapRaw = pickNumber(token.marketCap, token.market_cap, token.fdvUsd);
  const marketCap = marketCapRaw !== undefined ? formatUsdCompact(marketCapRaw) : undefined;
  const volumeRaw = pickNumber(token.volume24hUsd, token.volume24h);
  const volume = volumeRaw !== undefined ? formatUsdCompact(volumeRaw) : undefined;
  const liquidityRaw = pickNumber(token.liquidityUsd, token.liquidity_usd);
  const liquidity = liquidityRaw !== undefined ? formatUsdCompact(liquidityRaw) : undefined;
  const holderCount = token.holderCount ? formatNumber(token.holderCount) : undefined;

  // Verification
  const isVerified = token.isVerified === true;
  const organicScore = pickNumber(token.organicScore);
  const tags = Array.isArray(token.jupiterTags) ? token.jupiterTags : [];
  const showTags = tags.filter(t => !['strict', 'verified'].includes(t)).slice(0, 3);

  // Links
  const websiteUrl = pickString(token.websiteUrl);
  const twitterUrl = pickString(token.twitterUrl);
  const telegramUrl = pickString(token.telegramUrl);
  const discordUrl = pickString(token.discordUrl);
  const hasSocials = websiteUrl || twitterUrl || telegramUrl || discordUrl;

  // Security
  const audit = token.audit;
  const hasAudit = audit && (
    audit.mintAuthorityDisabled !== undefined ||
    audit.freezeAuthorityDisabled !== undefined ||
    audit.topHoldersPercentage !== undefined
  );
  const isSus = audit?.isSus === true;

  // Action handlers
  const handleGetQuote = async () => {
    if (!address) return;
    setIsQuoting(true);
    await callTool('solana_swap_preview', { outputMint: address, amount: 1 });
    setIsQuoting(false);
  };

  const handleCheckSlippage = async () => {
    if (!address) return;
    await callTool('slippage_sentinel', { token_out: address });
  };

  const handleAnalyze = async () => {
    await sendFollowUp(`Give me a detailed analysis of ${symbol} (${address})`);
  };

  return (
    <div className={`rounded-xl border p-4 space-y-4 ${
      isSus 
        ? 'border-danger/30 bg-danger/5' 
        : isPositive 
          ? 'border-success/20 bg-surface' 
          : 'border-danger/20 bg-surface'
    }`}>
      {/* Header */}
      <div className="flex items-start gap-4">
        <TokenIcon symbol={symbol} imageUrl={imageUrl} size="lg" />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-lg text-primary truncate">{name}</h3>
            {isVerified && (
              <Badge color="success" size="sm" variant="soft">
                <span className="flex items-center gap-1">
                  <Check className="size-3" />
                  Verified
                </span>
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-sm font-medium text-secondary">{symbol}</span>
            {holderCount && <span className="text-xs text-tertiary">• {holderCount} holders</span>}
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <div className="text-xl font-bold text-primary">{price ?? '—'}</div>
          {priceChange && (
            <Badge 
              color={isPositive ? 'success' : 'danger'} 
              size="sm" 
              variant="soft"
              className="mt-1"
            >
              {priceChange}
            </Badge>
          )}
        </div>
      </div>

      {/* Tags */}
      {showTags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {showTags.map((tag, i) => (
            <Badge key={i} color="secondary" size="sm" variant="outline">
              {tag.replace(/-/g, ' ')}
            </Badge>
          ))}
        </div>
      )}

      {/* Suspicious Warning */}
      {isSus && (
        <Alert
          color="danger"
          variant="soft"
          title="Suspicious Token"
          description="This token has been flagged as potentially risky. Exercise extreme caution."
        />
      )}

      {/* Organic Score */}
      {organicScore !== undefined && (
        <div>
          <div className="text-xs text-tertiary uppercase tracking-wide mb-2">Organic Score</div>
          <OrganicScoreMeter score={organicScore} label={token.organicScoreLabel} />
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3">
        {marketCap && (
          <div>
            <div className="text-xs text-tertiary uppercase tracking-wide">MCap</div>
            <div className="text-sm font-medium text-primary mt-0.5">{marketCap}</div>
          </div>
        )}
        {volume && (
          <div>
            <div className="text-xs text-tertiary uppercase tracking-wide">Vol 24h</div>
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

      {/* Security Audit */}
      {hasAudit && (
        <div className="pt-3 border-t border-subtle">
          <SecurityAuditSection audit={audit!} />
        </div>
      )}

      {/* Social Links */}
      {hasSocials && (
        <div className="flex items-center gap-2">
          {websiteUrl && (
            <Button color="secondary" variant="ghost" size="xs" onClick={() => openExternal(websiteUrl)} uniform>
              <Globe className="size-4" />
            </Button>
          )}
          {twitterUrl && (
            <Button color="secondary" variant="ghost" size="xs" onClick={() => openExternal(twitterUrl)} uniform>
              <TwitterIcon className="size-4" />
            </Button>
          )}
          {telegramUrl && (
            <Button color="secondary" variant="ghost" size="xs" onClick={() => openExternal(telegramUrl)} uniform>
              <TelegramIcon className="size-4" />
            </Button>
          )}
          {discordUrl && (
            <Button color="secondary" variant="ghost" size="xs" onClick={() => openExternal(discordUrl)} uniform>
              <DiscordIcon className="size-4" />
            </Button>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button color="primary" variant="solid" size="sm" onClick={handleGetQuote} disabled={isQuoting}>
          {isQuoting ? 'Quoting...' : 'Get Quote'}
        </Button>
        <Button color="secondary" variant="soft" size="sm" onClick={handleCheckSlippage}>
          Slippage
        </Button>
        <Button color="secondary" variant="soft" size="sm" onClick={handleAnalyze}>
          <span className="flex items-center gap-1">
            Analyze
            <ChevronRight className="size-3.5" />
          </span>
        </Button>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-subtle">
        {address && (
          <code className="text-xs text-tertiary font-mono">{abbreviate(address, 6, 4)}</code>
        )}
        <div className="flex items-center gap-2">
          {address && (
            <>
              <a href={`https://solscan.io/token/${address}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                <Button color="secondary" variant="ghost" size="xs">
                  <span className="flex items-center gap-1">
                    Solscan
                    <ExternalLink className="size-3" />
                  </span>
                </Button>
              </a>
              <a href={`https://birdeye.so/token/${address}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                <Button color="secondary" variant="ghost" size="xs">
                  <span className="flex items-center gap-1">
                    Birdeye
                    <ExternalLink className="size-3" />
                  </span>
                </Button>
              </a>
              <a href={`https://dexscreener.com/solana/${address}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                <Button color="secondary" variant="ghost" size="xs">
                  <span className="flex items-center gap-1">
                    Chart
                    <ExternalLink className="size-3" />
                  </span>
                </Button>
              </a>
            </>
          )}
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

  // Loading
  if (!toolOutput) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-center gap-3 py-8">
          <div className="size-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-secondary text-sm">Looking up token...</span>
        </div>
      </div>
    );
  }

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
      <div className="p-4">
        <EmptyMessage fill="none">
          <EmptyMessage.Icon>
            <Search className="size-8" />
          </EmptyMessage.Icon>
          <EmptyMessage.Title>No Tokens Found</EmptyMessage.Title>
          <EmptyMessage.Description>
            Could not find any tokens matching your query.
          </EmptyMessage.Description>
        </EmptyMessage>
      </div>
    );
  }

  const visibleTokens = tokens.slice(0, 3);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Search className="size-5 text-secondary" />
        <h2 className="font-semibold text-base text-primary">Token Analysis</h2>
        <Badge color="secondary" size="sm" variant="soft">
          {tokens.length}
        </Badge>
      </div>

      {/* Token Cards */}
      <div className="space-y-4">
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
