import '../styles/sdk.css';

import { createRoot } from 'react-dom/client';
import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@openai/apps-sdk-ui/components/Badge';
import { Button, CopyButton } from '@openai/apps-sdk-ui/components/Button';
import { Alert } from '@openai/apps-sdk-ui/components/Alert';
import { Warning } from '@openai/apps-sdk-ui/components/Icon';
import { useOpenAIGlobal, useOpenExternal, useMaxHeight, useTheme, useDisplayMode } from '../sdk';
import { JsonViewer, useIntrinsicHeight, DebugPanel, formatUsdc, shortenHash, getExplorerUrl, getChain } from '../components/x402';

const WORDMARK_URL = 'https://dexter.cash/wordmarks/dexter-wordmark.svg';
const LOGO_MARK_URL = 'https://dexter.cash/assets/pokedexter/dexter-logo.svg';

type FetchPayload = {
  status: number;
  data?: unknown;
  payment?: {
    settled: boolean;
    details?: {
      success?: boolean;
      transaction?: string;
      network?: string;
      payer?: string;
      requirements?: {
        amount?: string;
        asset?: string;
        payTo?: string;
        extra?: { decimals?: number; feePayer?: string };
      };
    };
  };
  error?: string;
  mode?: string;
  message?: string;
  session?: {
    sessionId?: string;
    sessionToken?: string;
    funding?: SessionFunding;
    expiresAt?: string;
    state?: string;
  };
  requirements?: unknown;
  sessionFunding?: SessionFunding;
  merchantSettlement?: Array<{ network?: string | null; asset?: string | null; amountAtomic?: string; payTo?: string | null }>;
};

type SessionFunding = {
  amountAtomic?: string;
  amountUsdc?: number;
  walletAddress?: string;
  payTo?: string;
  txUrl?: string;
  solanaPayUrl?: string;
  reference?: string;
};

function isImageUrl(data: unknown): string | null {
  if (typeof data !== 'object' || !data) return null;
  const obj = data as Record<string, unknown>;
  const url = obj.image_url || obj.imageUrl || obj.url;
  if (typeof url === 'string' && /\.(jpg|jpeg|png|gif|webp|svg)($|\?)/.test(url)) return url;
  return null;
}

function proxyImageUrl(url: string): string {
  return `https://api.dexter.cash/api/img?url=${encodeURIComponent(url)}`;
}

function QrCountdown({ expiresAt }: { expiresAt: string }) {
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, new Date(expiresAt).getTime() - Date.now());
      if (remaining <= 0) { setTimeLeft('Expired'); return; }
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);
  return <span className="text-xs text-tertiary">Expires in {timeLeft}</span>;
}

function SessionPanel({ payload }: { payload: FetchPayload }) {
  const openExternal = useOpenExternal();
  const session = payload.session;
  const funding = payload.sessionFunding || session?.funding;
  const walletAddress = funding?.walletAddress || funding?.payTo;
  const qrUrl = funding?.solanaPayUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(funding.solanaPayUrl)}`
    : null;

  return (
    <div className="flex flex-col gap-3">
      <Badge color="warning">Session Required</Badge>
      <p className="text-sm text-secondary">{payload.message || 'Fund an anonymous OpenDexter session to execute.'}</p>
      {funding?.amountUsdc !== undefined && (
        <p className="text-sm font-semibold">Funding target: ${Number(funding.amountUsdc).toFixed(2)} USDC</p>
      )}
      {walletAddress && (
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-tertiary">Deposit:</span>
          <span className="text-xs font-mono text-secondary truncate flex-1">{walletAddress}</span>
          <CopyButton copyValue={walletAddress} variant="ghost" color="secondary" size="sm">Copy</CopyButton>
        </div>
      )}
      {qrUrl && (
        <div className="flex justify-center">
          <div className="p-2 bg-white rounded-lg inline-block">
            <img src={qrUrl} alt="Solana Pay QR" width={140} height={140} />
          </div>
        </div>
      )}
      <div className="flex gap-2">
        {funding?.txUrl && (
          <Button variant="soft" color="secondary" size="sm" onClick={() => openExternal(funding.txUrl!)}>
            Open Funding Page
          </Button>
        )}
        {funding?.solanaPayUrl && (
          <Button variant="soft" color="secondary" size="sm" onClick={() => openExternal(funding.solanaPayUrl!)}>
            Solana Pay
          </Button>
        )}
      </div>
      {session?.expiresAt && <QrCountdown expiresAt={session.expiresAt} />}
      {payload.requirements && <JsonViewer data={payload.requirements} title="Payment Requirements" />}
    </div>
  );
}

function FetchResult() {
  const toolOutput = useOpenAIGlobal('toolOutput') as FetchPayload | null;
  const openExternal = useOpenExternal();
  const theme = useTheme();
  const maxHeight = useMaxHeight();
  const displayMode = useDisplayMode();
  const containerRef = useIntrinsicHeight();

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);
  const isFullscreen = displayMode === 'fullscreen';

  const toggleFullscreen = useCallback(() => {
    try {
      (window as any).openai?.requestDisplayMode?.({ mode: isFullscreen ? 'inline' : 'fullscreen' });
    } catch {}
  }, [isFullscreen]);

  const [loadingElapsed, setLoadingElapsed] = useState(0);
  useEffect(() => {
    if (toolOutput) return;
    const t = setInterval(() => setLoadingElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [toolOutput]);

  if (!toolOutput) {
    return (
      <div data-theme={theme} className="p-4 flex flex-col gap-2" style={{ maxHeight: maxHeight ?? undefined }}>
        <p className="text-sm text-secondary">
          {loadingElapsed < 3 ? 'Submitting payment...'
            : loadingElapsed < 8 ? 'Awaiting settlement confirmation...'
            : 'Still processing — the endpoint may be slow.'}
        </p>
        {loadingElapsed >= 3 && <div className="h-1 rounded-full bg-surface-secondary overflow-hidden"><div className="h-full bg-primary/40 rounded-full transition-all duration-1000" style={{ width: `${Math.min(95, loadingElapsed * 8)}%` }} /></div>}
      </div>
    );
  }

  const isSession = toolOutput.mode === 'session_required';
  const isError = !!toolOutput.error && !isSession;
  const payment = toolOutput.payment;
  const details = payment?.details;
  const networkName = details?.network ? getChain(details.network).name : '';
  const imageUrl = isImageUrl(toolOutput.data);
  const price = details?.requirements?.amount
    ? formatUsdc(details.requirements.amount, details.requirements.extra?.decimals ?? 6)
    : '';
  const dataStr = toolOutput.data !== undefined ? JSON.stringify(toolOutput.data) : '';
  const isLargePayload = dataStr.length > 500;

  return (
    <div
      data-theme={theme}
      ref={containerRef}
      className={`flex flex-col gap-4 ${isFullscreen ? 'p-6' : 'p-4'} overflow-y-auto`}
      style={{ maxHeight: isFullscreen ? undefined : (maxHeight ?? undefined) }}
    >
      <div
        className="rounded-2xl border border-default bg-surface p-4 flex flex-col gap-4"
        style={{ background: 'linear-gradient(135deg, rgba(209,63,0,0.08) 0%, rgba(255,107,0,0.04) 52%, transparent 100%)' }}
      >
        {/* Header */}
        <div className="relative overflow-hidden rounded-xl px-4 pt-4 pb-3 bg-surface/70">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <img src={LOGO_MARK_URL} alt="Dexter logo" width={24} height={24} style={{ width: 24, height: 24, flexShrink: 0 }} />
              <img src={WORDMARK_URL} alt="Dexter" height={22} style={{ height: 22, width: 'auto', opacity: 0.9 }} />
              <div>
                <span className="text-xs text-tertiary uppercase tracking-wider font-semibold">x402 Execution Result</span>
                <h2 className="heading-lg">Execution Ledger</h2>
              </div>
            </div>
            {isLargePayload && (
              <Button variant="soft" color="secondary" size="sm" onClick={toggleFullscreen}>
                {isFullscreen ? 'Minimize' : 'Expand'}
              </Button>
            )}
          </div>
          <div className="absolute bottom-0 left-4 right-4 h-px" style={{ background: 'linear-gradient(90deg, #ff6b00 0%, transparent 100%)', opacity: 0.18 }} />
        </div>

        {/* Progress rail */}
        <div className="flex gap-2">
          <Badge color={isError ? 'danger' : 'success'} variant="soft">Challenge</Badge>
          <Badge color={isError ? 'danger' : payment?.settled ? 'success' : 'warning'} variant="soft">Settle</Badge>
          <Badge color={isError ? 'danger' : payment?.settled ? 'success' : 'secondary'} variant="soft">Response</Badge>
        </div>

        {isSession ? (
          <SessionPanel payload={toolOutput} />
        ) : isError ? (
          <Alert color="danger" title="Error" description={toolOutput.error} />
        ) : (
          <>
            {/* Status badges */}
            <div className="flex items-center gap-2 flex-wrap">
              {payment?.settled ? (
                <Badge color="success">Paid</Badge>
              ) : (
                <Badge color="info">{toolOutput.status}</Badge>
              )}
              {price && <Badge color="info" variant="outline">{price} USDC</Badge>}
              {networkName && <Badge color="info" variant="outline">{networkName}</Badge>}
            </div>

            {/* Payment receipt */}
            {payment?.settled && details?.transaction && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-surface-secondary">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-tertiary uppercase">Transaction</span>
                  <div className="flex items-center gap-2">
                    <button
                      className="text-sm font-mono text-primary hover:underline cursor-pointer"
                      onClick={() => openExternal(getExplorerUrl(details.transaction!, details.network))}
                    >
                      {shortenHash(details.transaction)}
                    </button>
                    <CopyButton copyValue={details.transaction} variant="ghost" color="secondary" size="sm">
                      Copy
                    </CopyButton>
                  </div>
                </div>
                {details.payer && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-tertiary uppercase">Payer</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-secondary">{shortenHash(details.payer)}</span>
                      <CopyButton copyValue={details.payer} variant="ghost" color="secondary" size="sm">
                        Copy
                      </CopyButton>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Data */}
            {imageUrl ? (
              <div className="rounded-2xl overflow-hidden bg-surface-secondary">
                <div className="px-3 py-2 text-xs text-tertiary uppercase">Image</div>
                <img src={proxyImageUrl(imageUrl)} alt="Response" className="w-full" />
              </div>
            ) : toolOutput.data !== undefined ? (
              <JsonViewer data={toolOutput.data} />
            ) : null}
          </>
        )}
        <DebugPanel widgetName="x402-fetch-result" />
      </div>
    </div>
  );
}

const root = document.getElementById('x402-fetch-result-root');
if (root) {
  root.setAttribute('data-widget-build', '2026-03-04.2');
  createRoot(root).render(<FetchResult />);
}

export default FetchResult;
