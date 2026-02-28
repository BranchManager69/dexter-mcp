import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/x402-marketplace-search.css';

import { createRoot } from 'react-dom/client';
import { useOpenAIGlobal, useToolInput, useSendFollowUp, useMaxHeight } from '../sdk';

const X402_WIDGET_BUILD = '2026-02-26.3';

type Resource = {
  name: string;
  url: string;
  method: string;
  price: string;
  network: string | null;
  description: string;
  category: string;
  qualityScore: number | null;
  verified: boolean;
  totalCalls: number;
  seller: string | null;
  authRequired?: boolean;
  authType?: string | null;
  authHint?: string | null;
};

type SearchPayload = {
  success: boolean;
  count: number;
  resources: Resource[];
  tip?: string;
  error?: string;
};

function formatCalls(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function getNetworkName(network: string | null): string {
  if (!network) return '';
  const clean = network.replace(/^solana:.*/, 'solana').replace(/^eip155:8453/, 'base').replace(/^eip155:137/, 'polygon');
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function getNetworkSlug(network: string | null): string {
  if (!network) return '';
  if (network.startsWith('solana:')) return 'solana';
  if (network === 'eip155:8453') return 'base';
  if (network === 'eip155:137') return 'polygon';
  if (network === 'eip155:42161') return 'arbitrum';
  if (network === 'eip155:10') return 'optimism';
  if (network === 'eip155:43114') return 'avalanche';
  if (network === 'eip155:2046399126') return 'skale';
  return network.toLowerCase();
}

function getQualityTone(score: number | null): 'high' | 'mid' | 'low' | 'na' {
  if (score === null || Number.isNaN(score)) return 'na';
  if (score >= 85) return 'high';
  if (score >= 65) return 'mid';
  return 'low';
}

function ChainIcon({ slug }: { slug: string }) {
  return <span className={`mkt-chain-icon mkt-chain-icon--${slug || 'default'}`} aria-hidden="true" />;
}

function ApiCard({ resource, featured = false }: { resource: Resource; featured?: boolean }) {
  const sendFollowUp = useSendFollowUp();
  const networkSlug = getNetworkSlug(resource.network);
  const networkName = getNetworkName(resource.network);
  const qualityTone = getQualityTone(resource.qualityScore);

  const handleFetch = async () => {
    const method = resource.method || 'GET';
    await sendFollowUp(`Call x402_fetch with url "${resource.url}" and method "${method}".`);
  };

  return (
    <div className={`mkt-card ${featured ? 'mkt-card--featured' : ''}`}>
      <div className="mkt-card__top">
        <div className="mkt-card__info">
          <span className="mkt-card__name">{resource.name}</span>
          {resource.seller && <span className="mkt-card__seller">by {resource.seller}</span>}
        </div>
        <div className="mkt-card__right">
          <span className="mkt-price">
            <ChainIcon slug={networkSlug} />
            {resource.price}
          </span>
          {networkName && <span className="mkt-network">{networkName}</span>}
          {resource.qualityScore !== null && (
            <span className={`mkt-quality-badge mkt-quality-badge--${qualityTone}`}>
              Quality {resource.qualityScore}
            </span>
          )}
        </div>
      </div>
      {resource.description && <div className="mkt-card__desc">{resource.description}</div>}
      <div className="mkt-card__meta">
        <span className="mkt-tag">{resource.category}</span>
        <span className="mkt-tag">{resource.method}</span>
        <span className={resource.verified ? 'mkt-verified' : 'mkt-unverified'}>
          {resource.verified ? '✓ Verified' : '○ Unverified'}
        </span>
        {resource.authRequired && (
          <span
            className="mkt-auth-required"
            title={resource.authHint || 'This endpoint needs provider auth before payment.'}
          >
            Auth Required{resource.authType ? ` (${resource.authType.toUpperCase()})` : ''}
          </span>
        )}
        {resource.totalCalls > 0 && <span className="mkt-calls">{formatCalls(resource.totalCalls)} calls</span>}
        {resource.network && (
          <span className="mkt-tag">
            <ChainIcon slug={networkSlug} />
            {getNetworkName(resource.network)}
          </span>
        )}
      </div>
      <div className="mkt-card__url" title={resource.url}>{resource.url}</div>
      <button className="mkt-fetch-btn" onClick={handleFetch}>
        Run Fetch {resource.price}
      </button>
    </div>
  );
}

function MarketplaceSearch() {
  const toolOutput = useOpenAIGlobal('toolOutput') as SearchPayload | null;
  const toolInput = useToolInput() as { query?: string } | null;
  const maxHeight = useMaxHeight();
  const qualityValues = (toolOutput?.resources ?? [])
    .map((r) => r.qualityScore)
    .filter((q): q is number => q !== null);
  const avgQuality = qualityValues.length
    ? Math.round(qualityValues.reduce((sum, q) => sum + q, 0) / qualityValues.length)
    : null;
  const verifiedCount = (toolOutput?.resources ?? []).filter((r) => r.verified).length;

  if (!toolOutput) {
    return <div className="mkt" style={{ maxHeight: maxHeight ?? undefined }}><div className="mkt-empty">Loading results...</div></div>;
  }

  if (toolOutput.error) {
    return <div className="mkt" style={{ maxHeight: maxHeight ?? undefined }}><div className="mkt-empty">{toolOutput.error}</div></div>;
  }

  if (toolOutput.count === 0) {
    return (
      <div className="mkt" style={{ maxHeight: maxHeight ?? undefined }}>
        <div className="mkt-empty">
          No x402 APIs found{toolInput?.query ? ` for "${toolInput.query}"` : ''}. Try a broader search.
        </div>
      </div>
    );
  }

  return (
    <div className="mkt" style={{ maxHeight: maxHeight ?? undefined }}>
      <div className="mkt-header">
        <div className="mkt-header__title-block">
          <span className="mkt-header__eyebrow">x402 Marketplace</span>
          <span className="mkt-header__count">{toolOutput.count} result{toolOutput.count !== 1 ? 's' : ''}</span>
          <span className="mkt-header__lede">Discover paid endpoints with the cleanest execution path.</span>
        </div>
        {toolInput?.query && <span className="mkt-header__query">Query: "{toolInput.query}"</span>}
      </div>
      <div className="mkt-statbar">
        <span className="mkt-statbar__item">Catalog: live</span>
        <span className="mkt-statbar__dot" />
        <span className="mkt-statbar__item">Verified: {verifiedCount}</span>
        <span className="mkt-statbar__dot" />
        <span className="mkt-statbar__item">Avg quality: {avgQuality ?? 'n/a'}</span>
      </div>
      <div className="mkt-grid">
        {toolOutput.resources.map((r, i) => (
          <ApiCard key={r.url + i} resource={r} featured={i === 0} />
        ))}
      </div>
      {toolOutput.tip && <div className="mkt-tip">{toolOutput.tip}</div>}
    </div>
  );
}

const root = document.getElementById('x402-marketplace-search-root');
if (root) {
  root.setAttribute('data-widget-build', X402_WIDGET_BUILD);
  createRoot(root).render(<MarketplaceSearch />);
}

export default MarketplaceSearch;
