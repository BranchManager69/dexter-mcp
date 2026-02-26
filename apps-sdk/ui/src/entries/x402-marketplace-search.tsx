import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/x402-marketplace-search.css';

import { createRoot } from 'react-dom/client';
import { useOpenAIGlobal, useCallTool, useToolInput, useSendFollowUp } from '../sdk';

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

const CHAIN_ICONS: Record<string, string> = {
  solana: '◎',
  base: '🔵',
  polygon: '🟣',
  arbitrum: '🔷',
  optimism: '🔴',
  avalanche: '🔺',
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

function QualityRing({ score }: { score: number | null }) {
  if (score === null) return null;
  const r = 13;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const colorClass = score >= 80 ? 'mkt-quality__fill--green' : score >= 50 ? 'mkt-quality__fill--yellow' : 'mkt-quality__fill--red';

  return (
    <div className="mkt-quality">
      <svg width="32" height="32" viewBox="0 0 32 32" className="mkt-quality__ring">
        <circle cx="16" cy="16" r={r} className="mkt-quality__bg" />
        <circle cx="16" cy="16" r={r} className={`mkt-quality__fill ${colorClass}`}
          strokeDasharray={c} strokeDashoffset={offset} />
      </svg>
      <span className="mkt-quality__label">{score}</span>
    </div>
  );
}

function ApiCard({ resource }: { resource: Resource }) {
  const { callTool, isLoading } = useCallTool();
  const sendFollowUp = useSendFollowUp();
  const chainIcon = resource.network ? CHAIN_ICONS[resource.network.split(':')[0]] || '⬡' : '';

  const handleFetch = async () => {
    try {
      const result = await callTool('x402_fetch', { url: resource.url, method: resource.method });
      if (!result) {
        sendFollowUp({ prompt: `Please call x402_fetch with url "${resource.url}" and method "${resource.method}"` });
      }
    } catch {
      sendFollowUp({ prompt: `Please call x402_fetch with url "${resource.url}" and method "${resource.method}"` });
    }
  };

  return (
    <div className="mkt-card">
      <div className="mkt-card__top">
        <div className="mkt-card__info">
          <span className="mkt-card__name">{resource.name}</span>
          {resource.seller && <span className="mkt-card__seller">by {resource.seller}</span>}
        </div>
        <div className="mkt-card__right">
          <span className="mkt-price">{chainIcon} {resource.price}</span>
          <QualityRing score={resource.qualityScore} />
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
      <button className="mkt-fetch-btn" onClick={handleFetch} disabled={isLoading}>
        {isLoading ? 'Calling...' : `Fetch ${resource.price}`}
      </button>
    </div>
  );
}

function MarketplaceSearch() {
  const toolOutput = useOpenAIGlobal('toolOutput') as SearchPayload | null;
  const toolInput = useToolInput() as { query?: string } | null;

  if (!toolOutput) {
    return <div className="mkt"><div className="mkt-empty">Loading results...</div></div>;
  }

  if (toolOutput.error) {
    return <div className="mkt"><div className="mkt-empty">{toolOutput.error}</div></div>;
  }

  if (toolOutput.count === 0) {
    return (
      <div className="mkt">
        <div className="mkt-empty">
          No x402 APIs found{toolInput?.query ? ` for "${toolInput.query}"` : ''}. Try a broader search.
        </div>
      </div>
    );
  }

  return (
    <div className="mkt">
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
