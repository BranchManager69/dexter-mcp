import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/x402-pricing.css';

import { createRoot } from 'react-dom/client';
import { useOpenAIGlobal, useToolInput, useSendFollowUp, useMaxHeight } from '../sdk';

const X402_WIDGET_BUILD = '2026-02-26.3';

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

const CHAIN_MAP: Record<string, { name: string; slug: string }> = {
  'solana': { name: 'Solana', slug: 'solana' },
  'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': { name: 'Solana', slug: 'solana' },
  'eip155:8453': { name: 'Base', slug: 'base' },
  'base': { name: 'Base', slug: 'base' },
  'eip155:137': { name: 'Polygon', slug: 'polygon' },
  'polygon': { name: 'Polygon', slug: 'polygon' },
  'eip155:42161': { name: 'Arbitrum', slug: 'arbitrum' },
  'eip155:10': { name: 'Optimism', slug: 'optimism' },
  'eip155:43114': { name: 'Avalanche', slug: 'avalanche' },
  'eip155:2046399126': { name: 'SKALE', slug: 'skale' },
};

function ChainIcon({ slug }: { slug: string }) {
  return <span className={`pricing-chain-icon pricing-chain-icon--${slug || 'default'}`} aria-hidden="true" />;
}

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
  const selectedPrice = cheapestIndex >= 0 ? options[cheapestIndex].priceFormatted : null;

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
            <span className="pricing-header__subtitle">Select the best settlement route before execution.</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {toolOutput.x402Version && (
              <span className="pricing-badge pricing-badge--version">x402 v{toolOutput.x402Version}</span>
            )}
            <span className="pricing-badge pricing-badge--paid">402</span>
          </div>
        </div>

        {toolInput?.url && <div className="pricing-resource">{toolInput.url}</div>}
        {!!options.length && (
          <div className="pricing-summary">
            <span className="pricing-summary__label">Best route</span>
            <span className="pricing-summary__value">{selectedPrice ?? '—'}</span>
          </div>
        )}

        <div className="pricing-options">
          {options.map((opt, i) => {
            const chain = CHAIN_MAP[opt.network] || { name: opt.network, slug: 'default' };
            return (
              <div key={i} className={`pricing-option ${i === cheapestIndex ? 'pricing-option--best' : ''}`}>
                <span className="pricing-option__index">{String(i + 1).padStart(2, '0')}</span>
                <div className="pricing-option__chain">
                  <ChainIcon slug={chain.slug} />
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
          <>
            <button className="pricing-fetch-btn" onClick={handleFetch}>
              Fetch & Pay{selectedPrice ? ` ${selectedPrice}` : ''}
            </button>
            <div className="pricing-disclaimer">
              Route and fee details are resolved live at execution time.
            </div>
          </>
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
