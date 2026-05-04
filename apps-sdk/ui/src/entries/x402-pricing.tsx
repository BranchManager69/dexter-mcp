import '../styles/sdk.css';

import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Badge } from '@openai/apps-sdk-ui/components/Badge';
import { Button, CopyButton } from '@openai/apps-sdk-ui/components/Button';
import { Alert } from '@openai/apps-sdk-ui/components/Alert';
import {
  useToolOutput,
  useAdaptiveCallToolFn,
  useMaxHeight,
  useAdaptiveTheme,
  useSendFollowUp,
} from '../sdk';
import { useToolInput as useAdaptiveToolInput } from '../sdk/adapter';
import { ChainIcon, getChain, useIntrinsicHeight, DebugPanel } from '../components/x402';

const WORDMARK_URL = 'https://dexter.cash/wordmarks/dexter-wordmark.svg';
const LOGO_MARK_URL = 'https://dexter.cash/assets/pokedexter/dexter-logo.svg';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

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

type PricingInput = { url?: string; method?: string };

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────────────────────

function shortenAddress(addr: string | null): string {
  if (!addr) return '';
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function pickCheapestIndex(options: PaymentOption[]): number {
  if (!options.length) return -1;
  return options.reduce(
    (best, current, idx) => (current.price < options[best].price ? idx : best),
    0,
  );
}

function isFreeEndpoint(payload: PricingPayload): boolean {
  if (payload.free) return true;
  if (payload.requiresPayment) return false;
  const code = payload.statusCode;
  return Boolean(code && code >= 200 && code < 300);
}

function isPricingUnavailable(payload: PricingPayload): boolean {
  if (payload.error) return true;
  if (payload.requiresPayment && !(payload.paymentOptions || []).length) return true;
  return false;
}

function unavailableMessage(payload: PricingPayload): string {
  return (
    payload.message ||
    (typeof payload.error === 'string' ? payload.error : undefined) ||
    'No payment options are currently available for this endpoint.'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Local components
// ─────────────────────────────────────────────────────────────────────────────

/** Wraps every branch (loading, auth, error, free, paid) so the theme attribute,
 *  padding, and host-imposed maxHeight are applied once, in one place. */
function StateFrame({
  theme,
  maxHeight,
  children,
  scroll = false,
  containerRef,
}: {
  theme: string;
  maxHeight: number | null;
  children: ReactNode;
  scroll?: boolean;
  containerRef?: React.Ref<HTMLDivElement>;
}) {
  const className = scroll
    ? 'p-4 flex flex-col gap-4 overflow-y-auto'
    : 'p-4';
  return (
    <div
      data-theme={theme}
      ref={containerRef}
      className={className}
      style={{ maxHeight: maxHeight ?? undefined }}
    >
      {children}
    </div>
  );
}

function PricingHeader({ x402Version }: { x402Version?: number }) {
  return (
    <div className="relative overflow-hidden rounded-xl px-4 pt-4 pb-3 bg-surface/70">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={LOGO_MARK_URL}
            alt="Dexter logo"
            width={24}
            height={24}
            style={{ width: 24, height: 24, flexShrink: 0 }}
          />
          <img
            src={WORDMARK_URL}
            alt="Dexter"
            height={22}
            style={{ height: 22, width: 'auto', opacity: 0.9 }}
          />
          <span className="text-xs text-tertiary">Pricing</span>
        </div>
        <div className="flex gap-1.5">
          {x402Version && (
            <Badge color="info" variant="outline">
              v{x402Version}
            </Badge>
          )}
          <Badge color="warning">402</Badge>
        </div>
      </div>
      <div className="mt-2 flex flex-col gap-1">
        <span className="heading-lg">Payment Required</span>
        <span className="text-sm text-secondary">
          Select the best settlement route before execution.
        </span>
      </div>
      <div
        className="absolute bottom-0 left-4 right-4 h-px"
        style={{
          background: 'linear-gradient(90deg, #ff6b00 0%, transparent 100%)',
          opacity: 0.18,
        }}
      />
    </div>
  );
}

function ResourceUrl({ url }: { url: string }) {
  return (
    <div className="rounded-xl bg-surface-secondary px-4 py-3">
      <span className="text-xs font-mono text-tertiary break-all">{url}</span>
    </div>
  );
}

function PaymentOptionRow({
  option,
  isBest,
}: {
  option: PaymentOption;
  isBest: boolean;
}) {
  const { name: chainName } = getChain(option.network);
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl ${
        isBest
          ? 'bg-surface-secondary shadow-[0_0_0_1px_rgba(255,107,0,0.14)]'
          : 'bg-surface-secondary/60'
      }`}
    >
      <ChainIcon network={option.network} size={20} />
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{chainName}</span>
          {isBest && (
            <Badge color="success" size="sm">
              Best
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-xs text-tertiary">USDC</span>
        </div>
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-xs font-mono text-tertiary truncate">
            {shortenAddress(option.payTo)}
          </span>
          <CopyButton
            copyValue={option.payTo}
            variant="ghost"
            color="secondary"
            size="sm"
          />
        </div>
      </div>
      <span className="heading-sm flex-shrink-0">{option.priceFormatted}</span>
    </div>
  );
}

function PaymentOptionList({
  options,
  cheapestIndex,
}: {
  options: PaymentOption[];
  cheapestIndex: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      {options.map((opt, i) => (
        <PaymentOptionRow key={i} option={opt} isBest={i === cheapestIndex} />
      ))}
    </div>
  );
}

function FetchAction({
  selectedPrice,
  onFetch,
}: {
  selectedPrice: string | null;
  onFetch: () => void;
}) {
  return (
    <Button color="primary" block onClick={onFetch}>
      Fetch & Pay{selectedPrice ? ` ${selectedPrice}` : ''}
    </Button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────────────────────

/** Returns seconds elapsed while `pending` is true, resetting to 0 otherwise. */
function useElapsedSeconds(pending: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!pending) {
      setElapsed(0);
      return;
    }
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [pending]);
  return elapsed;
}

// ─────────────────────────────────────────────────────────────────────────────
// Root component
// ─────────────────────────────────────────────────────────────────────────────

function PricingCheck() {
  const toolOutput = useToolOutput<PricingPayload>();
  const toolInput = useAdaptiveToolInput<PricingInput>();
  const callTool = useAdaptiveCallToolFn();
  const sendFollowUp = useSendFollowUp();
  const theme = useAdaptiveTheme();
  const maxHeight = useMaxHeight();
  const containerRef = useIntrinsicHeight();
  const loadingElapsed = useElapsedSeconds(!toolOutput);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Loading
  if (!toolOutput) {
    return (
      <StateFrame theme={theme} maxHeight={maxHeight}>
        <p className="text-sm text-secondary">
          {loadingElapsed < 5
            ? 'Checking pricing...'
            : 'Still probing endpoint — hang tight.'}
        </p>
      </StateFrame>
    );
  }

  // Auth required
  if (toolOutput.authRequired) {
    return (
      <StateFrame theme={theme} maxHeight={maxHeight}>
        <Alert
          color="warning"
          title="Authentication Required"
          description={`This endpoint requires provider authentication before the x402 payment flow.${
            toolOutput.message ? ' ' + toolOutput.message : ''
          }`}
        />
      </StateFrame>
    );
  }

  // Error / unavailable
  if (isPricingUnavailable(toolOutput)) {
    return (
      <StateFrame theme={theme} maxHeight={maxHeight}>
        <Alert
          color="danger"
          title="Pricing Unavailable"
          description={unavailableMessage(toolOutput)}
        />
      </StateFrame>
    );
  }

  // Free endpoint
  if (isFreeEndpoint(toolOutput)) {
    return (
      <StateFrame theme={theme} maxHeight={maxHeight}>
        <div className="rounded-2xl border border-default bg-surface p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="heading-sm">Endpoint Check</span>
            <Badge color="success">Free</Badge>
          </div>
          <p className="text-sm text-secondary">
            No payment required -- this endpoint is free to use.
          </p>
        </div>
      </StateFrame>
    );
  }

  // Paid — happy path
  const options = toolOutput.paymentOptions || [];
  const cheapestIndex = pickCheapestIndex(options);
  const selectedPrice =
    cheapestIndex >= 0 ? options[cheapestIndex].priceFormatted : null;

  const handleFetch = async () => {
    if (!toolInput?.url) return;
    await sendFollowUp({
      prompt: `Paying ${selectedPrice || 'the listed price'} to call ${toolInput.url}`,
      scrollToBottom: false,
    });
    await callTool('x402_fetch', {
      url: toolInput.url,
      method: toolInput.method || 'GET',
    });
  };

  return (
    <StateFrame
      theme={theme}
      maxHeight={maxHeight}
      scroll
      containerRef={containerRef}
    >
      <div
        className="relative overflow-hidden rounded-2xl border border-default bg-surface p-4 flex flex-col gap-4"
        style={{
          background:
            'linear-gradient(135deg, rgba(209,63,0,0.08) 0%, rgba(255,107,0,0.04) 52%, transparent 100%)',
        }}
      >
        <PricingHeader x402Version={toolOutput.x402Version} />
        {toolInput?.url && <ResourceUrl url={toolInput.url} />}
        <PaymentOptionList options={options} cheapestIndex={cheapestIndex} />
        {toolInput?.url && (
          <FetchAction selectedPrice={selectedPrice} onFetch={handleFetch} />
        )}
        <Alert
          color="info"
          variant="soft"
          description="Route and fee details are resolved live at execution time."
        />
        <DebugPanel widgetName="x402-pricing" />
      </div>
    </StateFrame>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mount
// ─────────────────────────────────────────────────────────────────────────────

const root = document.getElementById('x402-pricing-root');
if (root) {
  root.setAttribute('data-widget-build', '2026-03-04.2');
  createRoot(root).render(<PricingCheck />);
}

export default PricingCheck;
