import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/x402-pricing.css';

import { createRoot } from 'react-dom/client';
import { useOpenAIGlobal, useToolInput, useSendFollowUp, useMaxHeight } from '../sdk';

const X402_WIDGET_BUILD = '2026-02-26.1';

type PaymentOption = {
  price: number;
  priceFormatted: string;
  network: string;
  scheme: string;
  asset: string;
  payTo: string;
};

type PricingPayload = {
  requiresPayment?: boolean;
  statusCode: number;
  x402Version?: number;
  paymentOptions?: PaymentOption[];
  resource?: unknown;
  free?: boolean;
  error?: boolean | string;
  message?: string;
};

const CHAIN_MAP: Record<string, { name: string; logo?: string }> = {
  'solana': { name: 'Solana', logo: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/sol.png' },
  'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': { name: 'Solana', logo: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/sol.png' },
  'eip155:8453': { name: 'Base', logo: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/base.png' },
  'base': { name: 'Base', logo: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/base.png' },
  'eip155:137': { name: 'Polygon', logo: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/matic.png' },
  'polygon': { name: 'Polygon', logo: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/matic.png' },
  'eip155:42161': { name: 'Arbitrum', logo: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/arb.png' },
  'eip155:10': { name: 'Optimism', logo: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/op.png' },
  'eip155:43114': { name: 'Avalanche', logo: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/avax.png' },
  'eip155:2046399126': { name: 'SKALE', logo: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/skl.png' },
};

function shortenAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function PricingCheck() {
  const toolOutput = useOpenAIGlobal('toolOutput') as PricingPayload | null;
  const toolInput = useToolInput() as { url?: string; method?: string } | null;
  const sendFollowUp = useSendFollowUp();
  const maxHeight = useMaxHeight();

  if (!toolOutput) {
    return <div className="pricing" style={{ maxHeight: maxHeight ?? undefined }}><div className="pricing-card"><span>Checking endpoint...</span></div></div>;
  }

  if (toolOutput.error) {
    return (
      <div className="pricing" style={{ maxHeight: maxHeight ?? undefined }}>
        <div className="pricing-card">
          <div className="pricing-header">
            <span className="pricing-header__title">Endpoint Check</span>
            <span className="pricing-badge pricing-badge--error">Error {toolOutput.statusCode}</span>
          </div>
          <div className="pricing-error">{toolOutput.message || 'Failed to check endpoint'}</div>
        </div>
      </div>
    );
  }

  if (toolOutput.free || (!toolOutput.requiresPayment && toolOutput.statusCode >= 200 && toolOutput.statusCode < 300)) {
    return (
      <div className="pricing" style={{ maxHeight: maxHeight ?? undefined }}>
        <div className="pricing-card">
          <div className="pricing-header">
            <span className="pricing-header__title">Endpoint Check</span>
            <span className="pricing-badge pricing-badge--free">✓ Free</span>
          </div>
          <div className="pricing-free">
            <span className="pricing-free__icon">✅</span>
            <span className="pricing-free__text">No payment required — this endpoint is free to use.</span>
          </div>
        </div>
      </div>
    );
  }

  const options = toolOutput.paymentOptions || [];
  const cheapestIndex = options.length
    ? options.reduce((best, current, idx) => (current.price < options[best].price ? idx : best), 0)
    : -1;

  const handleFetch = async () => {
    if (!toolInput?.url) return;
    const method = toolInput.method || 'GET';
    await sendFollowUp(`Call x402_fetch with url "${toolInput.url}" and method "${method}".`);
  };

  return (
    <div className="pricing" style={{ maxHeight: maxHeight ?? undefined }}>
      <div className="pricing-card">
        <div className="pricing-header">
          <div className="pricing-header__title-wrap">
            <span className="pricing-header__eyebrow">x402 Pricing</span>
            <span className="pricing-header__title">Payment Required</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {toolOutput.x402Version && (
              <span className="pricing-badge pricing-badge--version">x402 v{toolOutput.x402Version}</span>
            )}
            <span className="pricing-badge pricing-badge--paid">402</span>
          </div>
        </div>

        {toolInput?.url && <div className="pricing-resource">{toolInput.url}</div>}

        <div className="pricing-options">
          {options.map((opt, i) => {
            const chain = CHAIN_MAP[opt.network] || { name: opt.network };
            return (
              <div key={i} className={`pricing-option ${i === cheapestIndex ? 'pricing-option--best' : ''}`}>
                <div className="pricing-option__chain">
                  {chain.logo ? <img className="pricing-option__logo" src={chain.logo} alt={chain.name} /> : <span>⬡</span>}
                </div>
                <div className="pricing-option__info">
                  <span className="pricing-option__network">{chain.name}</span>
                  <span className="pricing-option__asset">USDC</span>
                  <span className="pricing-option__payto">{shortenAddress(opt.payTo)}</span>
                </div>
                {i === cheapestIndex && <span className="pricing-option__best">Best route</span>}
                <span className="pricing-option__price">{opt.priceFormatted}</span>
              </div>
            );
          })}
        </div>

        {toolInput?.url && (
          <button className="pricing-fetch-btn" onClick={handleFetch}>
            Fetch & Pay{options[0] ? ` ${options[0].priceFormatted}` : ''}
          </button>
        )}
      </div>
    </div>
  );
}

const root = document.getElementById('x402-pricing-root');
if (root) {
  root.setAttribute('data-widget-build', X402_WIDGET_BUILD);
  createRoot(root).render(<PricingCheck />);
}

export default PricingCheck;
