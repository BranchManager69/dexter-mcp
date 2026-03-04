import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/x402-fetch-result.css';

import { createRoot } from 'react-dom/client';
import { useState, useEffect, useCallback } from 'react';
import { useOpenAIGlobal, useOpenExternal, useMaxHeight, useTheme, useDisplayMode } from '../sdk';
import { JsonViewer, CopyButton, DebugPanel, useIntrinsicHeight, shortenHash, getExplorerUrl, formatUsdc } from '../components/x402';

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
  qr?: { solanaPayUrl?: string; nonce?: string; expiresAt?: string };
  pollUrl?: string;
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

function getNetworkName(network?: string): string {
  if (!network) return '';
  if (network.includes('solana')) return 'Solana';
  if (network.includes('8453')) return 'Base';
  if (network.includes('137')) return 'Polygon';
  if (network.includes('42161')) return 'Arbitrum';
  return network;
}

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

function FetchRail({ state }: { state: 'success' | 'pending' | 'error' }) {
  return (
    <div className="fetch-rail" aria-label="Execution progress">
      <span className={`fetch-rail__step ${state !== 'error' ? 'is-done' : ''}`}>Challenge</span>
      <span className={`fetch-rail__step ${state === 'success' ? 'is-done' : state === 'pending' ? 'is-active' : ''}`}>Settle</span>
      <span className={`fetch-rail__step ${state === 'success' ? 'is-done' : state === 'error' ? 'is-active' : ''}`}>Response</span>
    </div>
  );
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
  return <span className="fetch-qr__timer">Expires in {timeLeft}</span>;
}

function SessionPanel({ payload }: { payload: FetchPayload }) {
  const openExternal = useOpenExternal();
  const session = payload.session;
  const funding = payload.sessionFunding || session?.funding;
  const walletAddress = funding?.walletAddress || funding?.payTo;
  const qrUrl = funding?.solanaPayUrl;

  return (
    <>
      <FetchRail state="pending" />
      <div className="fetch-status">
        <span className="fetch-badge fetch-badge--qr">Session Required</span>
      </div>
      <div className="fetch-session">
        <span className="fetch-session__line">{payload.message || 'Fund an anonymous OpenDexter session to execute.'}</span>
        {funding?.amountUsdc !== undefined && (
          <span className="fetch-session__line">Funding target: ${Number(funding.amountUsdc).toFixed(2)} USDC</span>
        )}
        {walletAddress && (
          <span className="fetch-session__line">
            Deposit wallet: {walletAddress}
            <CopyButton text={walletAddress} className="fetch-session__copy" />
          </span>
        )}
        {funding?.txUrl && (
          <button className="fetch-session__action" onClick={() => openExternal(funding.txUrl!)}>Open Funding Link</button>
        )}
        {qrUrl && (
          <button className="fetch-session__action" onClick={() => openExternal(qrUrl!)}>Open Solana Pay</button>
        )}
        {session?.expiresAt && <QrCountdown expiresAt={session.expiresAt} />}
      </div>
      {payload.requirements && <JsonViewer data={payload.requirements} title="Payment Requirements" />}
    </>
  );
}

function FetchResult() {
  const toolOutput = useOpenAIGlobal('toolOutput') as FetchPayload | null;
  const openExternal = useOpenExternal();
  const theme = useTheme();
  const maxHeight = useMaxHeight();
  const displayMode = useDisplayMode();
  const containerRef = useIntrinsicHeight();
  const isFullscreen = displayMode === 'fullscreen';

  const toggleFullscreen = useCallback(() => {
    try {
      (window as any).openai?.requestDisplayMode?.({ mode: isFullscreen ? 'inline' : 'fullscreen' });
    } catch {}
  }, [isFullscreen]);

  if (!toolOutput) {
    return <div className="fetch" data-theme={theme} style={{ maxHeight: maxHeight ?? undefined }}><div className="fetch-card"><span>Loading...</span></div></div>;
  }

  const isSession = toolOutput.mode === 'session_required';
  const isError = !!toolOutput.error && !isSession;
  const payment = toolOutput.payment;
  const details = payment?.details;
  const imageUrl = isImageUrl(toolOutput.data);
  const price = details?.requirements?.amount
    ? formatUsdc(details.requirements.amount, details.requirements.extra?.decimals ?? 6)
    : '';

  const dataStr = toolOutput.data !== undefined ? JSON.stringify(toolOutput.data) : '';
  const isLargePayload = dataStr.length > 500;

  return (
    <div
      className={`fetch ${isFullscreen ? 'fetch--fullscreen' : ''}`}
      data-theme={theme}
      ref={containerRef}
      style={{ maxHeight: isFullscreen ? undefined : (maxHeight ?? undefined) }}
    >
      <div className="fetch-card">
        <div className="fetch-card__header">
          <div>
            <div className="fetch-card__title">x402 Execution Result</div>
            <div className="fetch-card__hero">Execution Ledger</div>
          </div>
          {isLargePayload && (
            <button className="fetch-expand-btn" onClick={toggleFullscreen}>
              {isFullscreen ? 'Minimize' : 'Expand'}
            </button>
          )}
        </div>

        {isSession ? (
          <SessionPanel payload={toolOutput} />
        ) : isError ? (
          <>
            <FetchRail state="error" />
            <div className="fetch-status">
              <span className="fetch-badge fetch-badge--error">Error</span>
            </div>
            <div className="fetch-error">{toolOutput.error}</div>
          </>
        ) : (
          <>
            <FetchRail state={payment?.settled ? 'success' : 'pending'} />
            <div className="fetch-status">
              {payment?.settled ? (
                <span className="fetch-badge fetch-badge--success">Paid</span>
              ) : (
                <span className="fetch-badge fetch-badge--success">{toolOutput.status}</span>
              )}
              {price && <span className="fetch-badge fetch-badge--network">{price} USDC</span>}
              {details?.network && <span className="fetch-badge fetch-badge--network">{getNetworkName(details.network)}</span>}
            </div>

            {payment?.settled && details?.transaction && (
              <div className="fetch-receipt">
                <div className="fetch-receipt__field">
                  <span className="fetch-receipt__label">Transaction</span>
                  <button
                    className="fetch-receipt__value fetch-receipt__link"
                    onClick={() => openExternal(getExplorerUrl(details.transaction!, details.network))}
                  >
                    {shortenHash(details.transaction)}
                  </button>
                  <CopyButton text={details.transaction} label="Copy" className="fetch-receipt__copy" />
                </div>
                {details.payer && (
                  <div className="fetch-receipt__field">
                    <span className="fetch-receipt__label">Payer</span>
                    <span className="fetch-receipt__value">{shortenHash(details.payer)}</span>
                    <CopyButton text={details.payer} label="Copy" className="fetch-receipt__copy" />
                  </div>
                )}
              </div>
            )}

            {imageUrl ? (
              <div className="fetch-data">
                <div className="fetch-data__header"><span>Image</span></div>
                <div className="fetch-data__body" style={{ padding: 0 }}>
                  <img src={proxyImageUrl(imageUrl)} alt="Response" className="fetch-data__image" />
                </div>
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
  root.setAttribute('data-widget-build', '2026-03-04.1');
  createRoot(root).render(<FetchResult />);
}

export default FetchResult;
