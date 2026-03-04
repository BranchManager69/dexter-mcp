import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/x402-pricing.css';

import { createRoot } from 'react-dom/client';
import { useOpenAIGlobal, useToolInput, useCallToolFn, useMaxHeight, useTheme } from '../sdk';
import { ChainIcon, getChain, CopyButton, DebugPanel, useIntrinsicHeight, shortenAddress } from '../components/x402';

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
  authRequired?: boolean;
  message?: string;
};

function PricingCheck() {
  const toolOutput = useOpenAIGlobal('toolOutput') as PricingPayload | null;
  const toolInput = useToolInput() as { url?: string; method?: string } | null;
  const callTool = useCallToolFn();
  const theme = useTheme();
  const maxHeight = useMaxHeight();
  const containerRef = useIntrinsicHeight();

  if (!toolOutput) {
    return <div className="pricing" data-theme={theme} style={{ maxHeight: maxHeight ?? undefined }}><div className="pricing-card"><span>Checking endpoint...</span></div></div>;
  }

  if (toolOutput.error) {
    return (
      <div className="pricing" data-theme={theme} style={{ maxHeight: maxHeight ?? undefined }}>
        <div className="pricing-card">
          <div className="pricing-header">
            <span className="pricing-header__title">Endpoint Check</span>
            <span className="pricing-badge pricing-badge--error">
              {toolOutput.authRequired ? 'Auth Required' : `Error ${toolOutput.statusCode}`}
            </span>
          </div>
          <div className="pricing-error">{toolOutput.message || 'Failed to check endpoint'}</div>
        </div>
      </div>
    );
  }

  if (toolOutput.free || (!toolOutput.requiresPayment && toolOutput.statusCode >= 200 && toolOutput.statusCode < 300)) {
    return (
      <div className="pricing" data-theme={theme} style={{ maxHeight: maxHeight ?? undefined }}>
        <div className="pricing-card">
          <div className="pricing-header">
            <span className="pricing-header__title">Endpoint Check</span>
            <span className="pricing-badge pricing-badge--free">Free</span>
          </div>
          <div className="pricing-free">
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
    try {
      (window as any).openai?.sendFollowUpMessage?.({
        prompt: `Paying ${selectedPrice || 'the listed price'} to call ${toolInput.url}`,
        scrollToBottom: false,
      });
    } catch {}
    await callTool('x402_fetch', { url: toolInput.url, method: toolInput.method || 'GET' });
  };

  return (
    <div className="pricing" data-theme={theme} ref={containerRef} style={{ maxHeight: maxHeight ?? undefined }}>
      <div className="pricing-card">
        <div className="pricing-header">
          <div className="pricing-header__title-wrap">
            <span className="pricing-header__eyebrow">x402 Pricing</span>
            <span className="pricing-header__title">Payment Required</span>
            <span className="pricing-header__subtitle">Select the best settlement route before execution.</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {toolOutput.x402Version && (
              <span className="pricing-badge pricing-badge--version">v{toolOutput.x402Version}</span>
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
            const { name: chainName, slug } = getChain(opt.network);
            return (
              <div key={i} className={`pricing-option ${i === cheapestIndex ? 'pricing-option--best' : ''}`}>
                <span className="pricing-option__index">{String(i + 1).padStart(2, '0')}</span>
                <div className="pricing-option__chain">
                  <ChainIcon network={opt.network} />
                </div>
                <div className="pricing-option__info">
                  <span className="pricing-option__network">{chainName}</span>
                  <span className="pricing-option__asset">USDC</span>
                  <span className="pricing-option__payto">
                    {shortenAddress(opt.payTo)}
                    <CopyButton text={opt.payTo} label="" copiedLabel="✓" className="pricing-option__copy" />
                  </span>
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
        <DebugPanel widgetName="x402-pricing" />
      </div>
    </div>
  );
}

const root = document.getElementById('x402-pricing-root');
if (root) {
  root.setAttribute('data-widget-build', '2026-03-04.1');
  createRoot(root).render(<PricingCheck />);
}

export default PricingCheck;
