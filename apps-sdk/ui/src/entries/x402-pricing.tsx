import '../styles/sdk.css';

import { createRoot } from 'react-dom/client';
import { useState, useEffect } from 'react';
import { Badge } from '@openai/apps-sdk-ui/components/Badge';
import { Button, CopyButton } from '@openai/apps-sdk-ui/components/Button';
import { Alert } from '@openai/apps-sdk-ui/components/Alert';
import { useToolOutput, useAdaptiveCallToolFn, useMaxHeight, useAdaptiveTheme, useSendFollowUp } from '../sdk';
import { useToolInput as useAdaptiveToolInput } from '../sdk/adapter';
import { captureWidgetException } from '../sdk/init-sentry';
import { ChainIcon, getChain, useIntrinsicHeight, DebugPanel } from '../components/x402';

const WORDMARK_URL = 'https://dexter.cash/wordmarks/dexter-wordmark.svg';
const LOGO_MARK_URL = 'https://dexter.cash/assets/pokedexter/dexter-logo.svg';

type PaymentOption = {
  price: number;
  priceFormatted: string;
  network: string | null;
  scheme: string;
  asset: string;
  payTo: string;
};

type PricingPayload = {
  requiresPayment?: boolean;
  statusCode?: number;
  x402Version?: number;
  paymentOptions?: PaymentOption[];
  free?: boolean;
  authRequired?: boolean;
  message?: string;
  error?: boolean | string;
  resource?: unknown;
  schema?: unknown;
};

function shortenAddress(addr: string | null): string {
  if (!addr) return '';
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function PricingCheck() {
  const toolOutput = useToolOutput<PricingPayload>();
  const toolInput = useAdaptiveToolInput<{ url?: string; method?: string }>();
  const callTool = useAdaptiveCallToolFn();
  const theme = useAdaptiveTheme();
  const maxHeight = useMaxHeight();
  const containerRef = useIntrinsicHeight();

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  const [loadingElapsed, setLoadingElapsed] = useState(0);
  useEffect(() => {
    if (toolOutput) return;
    const t = setInterval(() => setLoadingElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [toolOutput]);

  if (!toolOutput) {
    return (
      <div data-theme={theme} className="p-4" style={{ maxHeight: maxHeight ?? undefined }}>
        <p className="text-sm text-secondary">{loadingElapsed < 5 ? 'Checking pricing...' : 'Still probing endpoint — hang tight.'}</p>
      </div>
    );
  }

  if (toolOutput.authRequired) {
    return (
      <div data-theme={theme} className="p-4" style={{ maxHeight: maxHeight ?? undefined }}>
        <Alert color="warning" title="Authentication Required" description={`This endpoint requires provider authentication before the x402 payment flow.${toolOutput.message ? ' ' + toolOutput.message : ''}`} />
      </div>
    );
  }

  if (toolOutput.error || (toolOutput.requiresPayment && !(toolOutput.paymentOptions || []).length)) {
    const message =
      toolOutput.message ||
      (typeof toolOutput.error === 'string' ? toolOutput.error : undefined) ||
      'No payment options are currently available for this endpoint.';
    return (
      <div data-theme={theme} className="p-4" style={{ maxHeight: maxHeight ?? undefined }}>
        <Alert color="danger" title="Pricing Unavailable" description={message} />
      </div>
    );
  }

  if (toolOutput.free || (!toolOutput.requiresPayment && toolOutput.statusCode && toolOutput.statusCode >= 200 && toolOutput.statusCode < 300)) {
    return (
      <div data-theme={theme} className="p-4" style={{ maxHeight: maxHeight ?? undefined }}>
        <div className="rounded-2xl border border-default bg-surface p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="heading-sm">Endpoint Check</span>
            <Badge color="success">Free</Badge>
          </div>
          <p className="text-sm text-secondary">No payment required -- this endpoint is free to use.</p>
        </div>
      </div>
    );
  }

  const options = toolOutput.paymentOptions || [];
  const cheapestIndex = options.length
    ? options.reduce((best, current, idx) => (current.price < options[best].price ? idx : best), 0)
    : -1;
  const selectedPrice = cheapestIndex >= 0 ? options[cheapestIndex].priceFormatted : null;

  const sendFollowUp = useSendFollowUp();
  const handleFetch = async () => {
    if (!toolInput?.url) return;
    await sendFollowUp({
      prompt: `Paying ${selectedPrice || 'the listed price'} to call ${toolInput.url}`,
      scrollToBottom: false,
    });
    await callTool('x402_fetch', { url: toolInput.url, method: toolInput.method || 'GET' });
  };

  return (
    <div data-theme={theme} ref={containerRef} className="p-4 flex flex-col gap-4 overflow-y-auto" style={{ maxHeight: maxHeight ?? undefined }}>
      <div
        className="relative overflow-hidden rounded-2xl border border-default bg-surface p-4 flex flex-col gap-4"
        style={{ background: 'linear-gradient(135deg, rgba(209,63,0,0.08) 0%, rgba(255,107,0,0.04) 52%, transparent 100%)' }}
      >
        {/* Header */}
        <div className="relative overflow-hidden rounded-xl px-4 pt-4 pb-3 bg-surface/70">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <img src={LOGO_MARK_URL} alt="Dexter logo" width={24} height={24} style={{ width: 24, height: 24, flexShrink: 0 }} />
              <img src={WORDMARK_URL} alt="Dexter" height={22} style={{ height: 22, width: 'auto', opacity: 0.9 }} />
              <span className="text-xs text-tertiary">Pricing</span>
            </div>
            <div className="flex gap-1.5">
              {toolOutput.x402Version && <Badge color="info" variant="outline">v{toolOutput.x402Version}</Badge>}
              <Badge color="warning">402</Badge>
            </div>
          </div>
          <div className="mt-2 flex flex-col gap-1">
            <span className="heading-lg">Payment Required</span>
            <span className="text-sm text-secondary">Select the best settlement route before execution.</span>
          </div>
          <div className="absolute bottom-0 left-4 right-4 h-px" style={{ background: 'linear-gradient(90deg, #ff6b00 0%, transparent 100%)', opacity: 0.18 }} />
        </div>

        {/* Resource URL */}
        {toolInput?.url && (
          <div className="rounded-xl bg-surface-secondary px-4 py-3">
            <span className="text-xs font-mono text-tertiary break-all">{toolInput.url}</span>
          </div>
        )}

        {/* Payment options */}
        <div className="flex flex-col gap-2">
          {options.map((opt, i) => {
            const { name: chainName } = getChain(opt.network);
            const isBest = i === cheapestIndex;
            return (
              <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-2xl ${isBest ? 'bg-surface-secondary shadow-[0_0_0_1px_rgba(255,107,0,0.14)]' : 'bg-surface-secondary/60'}`}>
                <ChainIcon network={opt.network} size={20} />
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{chainName}</span>
                    {isBest && <Badge color="success" size="sm">Best</Badge>}
                  </div>
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="text-xs text-tertiary">USDC</span>
                  </div>
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="text-xs font-mono text-tertiary truncate">{shortenAddress(opt.payTo)}</span>
                    <CopyButton copyValue={opt.payTo} variant="ghost" color="secondary" size="sm" />
                  </div>
                </div>
                <span className="heading-sm flex-shrink-0">{opt.priceFormatted}</span>
              </div>
            );
          })}
      </div>

        {/* Fetch button */}
        {toolInput?.url && (
          <Button color="primary" block onClick={handleFetch}>
            Fetch & Pay{selectedPrice ? ` ${selectedPrice}` : ''}
          </Button>
        )}

        <Alert color="info" variant="soft" description="Route and fee details are resolved live at execution time." />
        <DebugPanel widgetName="x402-pricing" />
      </div>
    </div>
  );
}

const root = document.getElementById('x402-pricing-root');
if (root) {
  root.setAttribute('data-widget-build', '2026-03-04.2');
  createRoot(root).render(<PricingCheck />);
}

export default PricingCheck;
