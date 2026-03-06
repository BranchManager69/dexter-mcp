import '../styles/sdk.css';

import { createRoot } from 'react-dom/client';
import { useState, useEffect } from 'react';
import { Badge } from '@openai/apps-sdk-ui/components/Badge';
import { Button, CopyButton } from '@openai/apps-sdk-ui/components/Button';
import { Alert } from '@openai/apps-sdk-ui/components/Alert';
import { useOpenAIGlobal, useToolInput, useCallToolFn, useMaxHeight, useTheme } from '../sdk';
import { ChainIcon, getChain, useIntrinsicHeight, DebugPanel } from '../components/x402';

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
  const toolOutput = useOpenAIGlobal('toolOutput') as PricingPayload | null;
  const toolInput = useToolInput() as { url?: string; method?: string } | null;
  const callTool = useCallToolFn();
  const theme = useTheme();
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
    <div data-theme={theme} ref={containerRef} className="p-4 flex flex-col gap-4 overflow-y-auto" style={{ maxHeight: maxHeight ?? undefined }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-tertiary uppercase tracking-wider font-semibold">x402 Pricing</span>
          <span className="heading-lg">Payment Required</span>
        </div>
        <div className="flex gap-1.5">
          {toolOutput.x402Version && <Badge color="info" variant="outline">v{toolOutput.x402Version}</Badge>}
          <Badge color="warning">402</Badge>
        </div>
      </div>

      {/* Resource URL */}
      {toolInput?.url && (
        <span className="text-xs font-mono text-tertiary truncate">{toolInput.url}</span>
      )}

      {/* Payment options */}
      <div className="flex flex-col gap-2">
        {options.map((opt, i) => {
          const { name: chainName } = getChain(opt.network);
          const isBest = i === cheapestIndex;
          return (
            <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${isBest ? 'bg-surface-secondary' : ''}`}>
              <ChainIcon network={opt.network} size={20} />
              <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{chainName}</span>
                  {isBest && <Badge color="success" size="sm">Best</Badge>}
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

      <span className="text-3xs text-tertiary">Route and fee details resolved live at execution time.</span>
      <DebugPanel widgetName="x402-pricing" />
    </div>
  );
}

const root = document.getElementById('x402-pricing-root');
if (root) {
  root.setAttribute('data-widget-build', '2026-03-04.2');
  createRoot(root).render(<PricingCheck />);
}

export default PricingCheck;
