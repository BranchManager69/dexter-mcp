import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/solana-token-lookup.css';

import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { useOpenAIGlobal, useCallTool, useSendFollowUp, useOpenExternal, useTheme } from '../sdk';
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
  // Links
  websiteUrl?: string;
  twitterUrl?: string;
  telegramUrl?: string;
  discordUrl?: string;
  pairUrl?: string;
  // Verification & metrics
  isVerified?: boolean;
  organicScore?: number;
  organicScoreLabel?: string;
  jupiterTags?: string[];
  holderCount?: number;
  // Security
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

function VerifiedBadge() {
  return (
    <span className="token-verified-badge" title="Jupiter Verified">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" fill="#10b981"/>
        <path d="M8 12l3 3 5-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </span>
  );
}

function CheckIcon({ ok }: { ok: boolean }) {
  return ok ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="audit-icon audit-icon--ok">
      <circle cx="12" cy="12" r="10" fill="#10b981"/>
      <path d="M8 12l3 3 5-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="audit-icon audit-icon--warn">
      <circle cx="12" cy="12" r="10" fill="#f59e0b"/>
      <path d="M12 8v4M12 16h.01" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function SocialIcon({ type }: { type: 'twitter' | 'telegram' | 'discord' | 'website' }) {
  const icons: Record<string, JSX.Element> = {
    twitter: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
    telegram: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
      </svg>
    ),
    discord: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
      </svg>
    ),
    website: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
    ),
  };
  return icons[type] || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Security Audit Component
// ─────────────────────────────────────────────────────────────────────────────

function SecurityAuditSection({ audit }: { audit: SecurityAudit }) {
  const items = [
    { label: 'Mint Disabled', ok: audit.mintAuthorityDisabled === true },
    { label: 'Freeze Disabled', ok: audit.freezeAuthorityDisabled === true },
    { label: 'Low Whale Risk', ok: !audit.highSingleOwnership },
  ];

  const isSus = audit.isSus === true;

  return (
    <div className={`token-audit ${isSus ? 'token-audit--sus' : ''}`}>
      <div className="token-audit__header">
        <span className="token-audit__title">Security</span>
        {isSus && <span className="token-audit__sus-badge">⚠ SUSPICIOUS</span>}
      </div>
      <div className="token-audit__items">
        {items.map((item, i) => (
          <div key={i} className="token-audit__item">
            <CheckIcon ok={item.ok} />
            <span className={item.ok ? '' : 'token-audit__item--warn'}>{item.label}</span>
          </div>
        ))}
        {audit.topHoldersPercentage !== undefined && (
          <div className="token-audit__item">
            <span className="token-audit__label">Top Holders</span>
            <span className={audit.topHoldersPercentage > 50 ? 'token-audit__item--warn' : ''}>
              {audit.topHoldersPercentage.toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Organic Score Component
// ─────────────────────────────────────────────────────────────────────────────

function OrganicScoreMeter({ score, label }: { score: number; label?: string }) {
  const color = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444';
  
  return (
    <div className="token-organic-score">
      <div className="token-organic-score__bar">
        <div 
          className="token-organic-score__fill" 
          style={{ width: `${Math.min(score, 100)}%`, backgroundColor: color }}
        />
      </div>
      <div className="token-organic-score__info">
        <span className="token-organic-score__value">{score.toFixed(0)}</span>
        {label && <span className="token-organic-score__label">{label}</span>}
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
  
  // Token logo (square)
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
  
  // Banner image (1500x500) for card background
  const bannerUrl = pickString(
    token.headerImageUrl,
    info?.headerImageUrl,
    token.openGraphImageUrl,
    info?.openGraphImageUrl,
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
    <div className={`token-lookup-card ${isPositive ? 'token-lookup-card--positive' : 'token-lookup-card--negative'} ${bannerUrl ? 'token-lookup-card--has-banner' : ''}`}>
      {/* Banner background (1500x500) */}
      {bannerUrl && (
        <div 
          className="token-lookup-card__banner"
          style={{ backgroundImage: `url(${bannerUrl})` }}
        />
      )}
      
      {/* Glow effect */}
      <div className={`token-lookup-card__glow ${isPositive ? 'token-lookup-card__glow--positive' : 'token-lookup-card__glow--negative'}`} />

      <div className="token-lookup-card__content">
        {/* Header */}
        <div className="token-lookup-card__header">
          <TokenIcon symbol={symbol} imageUrl={imageUrl} size={64} />
          
          <div className="token-lookup-card__info">
            <div className="token-lookup-card__name-row">
              <h3 className="token-lookup-card__name">{name}</h3>
              {isVerified && <VerifiedBadge />}
            </div>
            <div className="token-lookup-card__symbol-row">
              <span className="token-lookup-card__symbol">{symbol}</span>
              {holderCount && <span className="token-lookup-card__holders">{holderCount} holders</span>}
            </div>
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

        {/* Tags */}
        {showTags.length > 0 && (
          <div className="token-lookup-card__tags">
            {showTags.map((tag, i) => (
              <span key={i} className="token-tag">{tag.replace(/-/g, ' ')}</span>
            ))}
          </div>
        )}

        {/* Organic Score */}
        {organicScore !== undefined && (
          <div className="token-lookup-card__organic">
            <span className="token-lookup-card__organic-label">Organic Score</span>
            <OrganicScoreMeter score={organicScore} label={token.organicScoreLabel} />
          </div>
        )}

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

        {/* Security Audit */}
        {hasAudit && <SecurityAuditSection audit={audit!} />}

        {/* Social Links */}
        {hasSocials && (
          <div className="token-lookup-card__socials">
            {websiteUrl && (
              <button className="token-social-btn" onClick={() => openExternal(websiteUrl)} title="Website">
                <SocialIcon type="website" />
              </button>
            )}
            {twitterUrl && (
              <button className="token-social-btn" onClick={() => openExternal(twitterUrl)} title="Twitter/X">
                <SocialIcon type="twitter" />
              </button>
            )}
            {telegramUrl && (
              <button className="token-social-btn" onClick={() => openExternal(telegramUrl)} title="Telegram">
                <SocialIcon type="telegram" />
              </button>
            )}
            {discordUrl && (
              <button className="token-social-btn" onClick={() => openExternal(discordUrl)} title="Discord">
                <SocialIcon type="discord" />
              </button>
            )}
          </div>
        )}

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

  if (tokens.length === 0) {
    return (
      <div className="token-lookup-container" data-theme={theme}>
        <div className="token-lookup-empty">No tokens found.</div>
      </div>
    );
  }

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
