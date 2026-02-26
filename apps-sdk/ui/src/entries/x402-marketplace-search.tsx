import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/x402-marketplace-search.css';

import { createRoot } from 'react-dom/client';
import { useOpenAIGlobal, useToolInput, useSendFollowUp, useMaxHeight } from '../sdk';

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
};

type SearchPayload = {
  success: boolean;
  count: number;
  resources: Resource[];
  tip?: string;
  error?: string;
};

const CHAIN_LOGOS: Record<string, string> = {
  solana: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/sol.png',
  base: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/base.png',
  polygon: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/matic.png',
  arbitrum: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/arb.png',
  optimism: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/op.png',
  avalanche: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/avax.png',
  skale: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/skl.png',
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

function ApiCard({ resource }: { resource: Resource }) {
  const sendFollowUp = useSendFollowUp();
  const networkSlug = getNetworkSlug(resource.network);
  const chainLogo = CHAIN_LOGOS[networkSlug];

  const handleFetch = async () => {
    const method = resource.method || 'GET';
    await sendFollowUp(`Call x402_fetch with url "${resource.url}" and method "${method}".`);
  };

  return (
    <div className="mkt-card">
      <div className="mkt-card__top">
        <div className="mkt-card__info">
          <span className="mkt-card__name">{resource.name}</span>
          {resource.seller && <span className="mkt-card__seller">by {resource.seller}</span>}
        </div>
        <div className="mkt-card__right">
          <span className="mkt-price">
            {chainLogo && <img className="mkt-chain-logo" src={chainLogo} alt={getNetworkName(resource.network)} />}
            {resource.price}
          </span>
          {resource.qualityScore !== null && <span className="mkt-quality-badge">Quality {resource.qualityScore}</span>}
        </div>
      </div>
      {resource.description && <div className="mkt-card__desc">{resource.description}</div>}
      <div className="mkt-card__meta">
        <span className="mkt-tag">{resource.category}</span>
        <span className="mkt-tag">{resource.method}</span>
        <span className={resource.verified ? 'mkt-verified' : 'mkt-unverified'}>
          {resource.verified ? '✓ Verified' : '○ Unverified'}
        </span>
        {resource.totalCalls > 0 && <span className="mkt-calls">{formatCalls(resource.totalCalls)} calls</span>}
        {resource.network && <span className="mkt-tag">{getNetworkName(resource.network)}</span>}
      </div>
      <button className="mkt-fetch-btn" onClick={handleFetch}>
        Fetch {resource.price}
      </button>
    </div>
  );
}

function MarketplaceSearch() {
  const toolOutput = useOpenAIGlobal('toolOutput') as SearchPayload | null;
  const toolInput = useToolInput() as { query?: string } | null;
  const maxHeight = useMaxHeight();

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
        <span className="mkt-header__count">{toolOutput.count} result{toolOutput.count !== 1 ? 's' : ''}</span>
        {toolInput?.query && <span className="mkt-header__query">"{toolInput.query}"</span>}
      </div>
      <div className="mkt-grid">
        {toolOutput.resources.map((r, i) => (
          <ApiCard key={r.url + i} resource={r} />
        ))}
      </div>
    </div>
  );
}

const root = document.getElementById('x402-marketplace-search-root');
if (root) createRoot(root).render(<MarketplaceSearch />);

export default MarketplaceSearch;
