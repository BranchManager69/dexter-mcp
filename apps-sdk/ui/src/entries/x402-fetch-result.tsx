import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/x402-fetch-result.css';

import { createRoot } from 'react-dom/client';
import { useState, useEffect } from 'react';
import { useOpenAIGlobal, useOpenExternal, useMaxHeight } from '../sdk';

const X402_WIDGET_BUILD = '2026-02-27.1';

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
    funding?: {
      amountAtomic?: string;
      amountUsdc?: number;
      walletAddress?: string;
      payTo?: string;
      txUrl?: string;
      solanaPayUrl?: string;
      reference?: string;
    };
    expiresAt?: string;
    state?: string;
  };
  requirements?: unknown;
  sessionFunding?: {
    amountAtomic?: string;
    amountUsdc?: number;
    walletAddress?: string;
    payTo?: string;
    txUrl?: string;
    solanaPayUrl?: string;
    reference?: string;
  };
  merchantSettlement?: Array<{
    network?: string | null;
    asset?: string | null;
    amountAtomic?: string;
    payTo?: string | null;
  }>;
};

function shortenHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

function getExplorerUrl(tx: string, network?: string): string {
  if (network?.startsWith('eip155:8453')) return `https://basescan.org/tx/${tx}`;
  if (network?.startsWith('eip155:137')) return `https://polygonscan.com/tx/${tx}`;
  return `https://solscan.io/tx/${tx}`;
}

function getNetworkName(network?: string): string {
  if (!network) return '';
  if (network.includes('solana')) return 'Solana';
  if (network.includes('8453')) return 'Base';
  if (network.includes('137')) return 'Polygon';
  if (network.includes('42161')) return 'Arbitrum';
  if (network.includes('10') && network.includes('eip155')) return 'Optimism';
  return network;
}

function formatPrice(requirements?: FetchPayload['payment']['details']['requirements']): string {
  if (!requirements?.amount) return '';
  const decimals = requirements.extra?.decimals ?? 6;
  const price = Number(requirements.amount) / Math.pow(10, decimals);
  return `$${price.toFixed(2)}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function syntaxHighlight(json: string): string {
  const safe = escapeHtml(json);
  return safe.replace(
    /("(\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      let cls = 'json-number';
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? 'json-key' : 'json-string';
      } else if (/true|false/.test(match)) {
        cls = 'json-bool';
      } else if (/null/.test(match)) {
        cls = 'json-null';
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );
}

function JsonViewer({ data }: { data: unknown }) {
  const [expanded, setExpanded] = useState(true);
  const jsonStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const isLong = jsonStr.length > 500;

  return (
    <div className="fetch-data">
      <div className="fetch-data__header">
        <span>Response Payload</span>
        {isLong && (
          <button className="fetch-data__toggle" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        )}
      </div>
      {expanded && (
        <div className="fetch-data__body"
          dangerouslySetInnerHTML={{ __html: syntaxHighlight(jsonStr) }} />
      )}
    </div>
  );
}

function ImageViewer({ url }: { url: string }) {
  return (
    <div className="fetch-data">
      <div className="fetch-data__header"><span>Image</span></div>
      <div className="fetch-data__body" style={{ padding: 0 }}>
        <img src={url} alt="Response" className="fetch-data__image" />
      </div>
    </div>
  );
}

function isImageUrl(data: unknown): string | null {
  if (typeof data !== 'object' || !data) return null;
  const obj = data as Record<string, unknown>;
  const url = obj.image_url || obj.imageUrl || obj.url;
  if (typeof url === 'string' && /\.(jpg|jpeg|png|gif|webp|svg)($|\?)/.test(url)) return url;
  return null;
}

function QrMode({ qr }: { qr: FetchPayload['qr'] }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (!qr?.expiresAt) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, new Date(qr.expiresAt!).getTime() - Date.now());
      if (remaining <= 0) { setTimeLeft('Expired'); return; }
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [qr?.expiresAt]);

  const qrImageUrl = qr?.solanaPayUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(qr.solanaPayUrl)}`
    : null;

  return (
    <div className="fetch-qr">
      {qrImageUrl && (
        <div className="fetch-qr__code">
          <img src={qrImageUrl} alt="Solana Pay QR code" width={200} height={200} style={{ borderRadius: 8 }} />
        </div>
      )}
      <span className="fetch-qr__instruction">Scan the QR code with Phantom or Solflare to pay</span>
      {timeLeft && <span className="fetch-qr__timer">Expires in {timeLeft}</span>}
      <span className="fetch-qr__poll">
        <span className="fetch-qr__poll-dot" />
        Waiting for payment...
      </span>
    </div>
  );
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

function FetchResult() {
  const toolOutput = useOpenAIGlobal('toolOutput') as FetchPayload | null;
  const openExternal = useOpenExternal();
  const maxHeight = useMaxHeight();

  if (!toolOutput) {
    return <div className="fetch" style={{ maxHeight: maxHeight ?? undefined }}><div className="fetch-card"><span>Loading...</span></div></div>;
  }

  // QR mode
  if (toolOutput.mode === 'session_required') {
    const session = toolOutput.session;
    const funding = toolOutput.sessionFunding || session?.funding;
    const walletAddress = funding?.walletAddress || funding?.payTo;
    const qr = funding?.solanaPayUrl ? { solanaPayUrl: funding.solanaPayUrl, expiresAt: session?.expiresAt } : null;
    return (
      <div className="fetch" style={{ maxHeight: maxHeight ?? undefined }}>
        <div className="fetch-card">
          <div className="fetch-card__title">x402 Execution Result</div>
          <div className="fetch-card__hero">Execution Ledger</div>
          <FetchRail state="pending" />
          <div className="fetch-status">
            <span className="fetch-badge fetch-badge--qr">Session Required</span>
          </div>
          <div className="fetch-session">
            <span className="fetch-session__line">{toolOutput.message || 'Fund an anonymous OpenDexter session to run canonical x402 fetch.'}</span>
            {session?.sessionId && <span className="fetch-session__line">Session: {session.sessionId}</span>}
            {session?.sessionToken && <span className="fetch-session__line">Token: {session.sessionToken}</span>}
            {funding?.amountUsdc !== undefined && (
              <span className="fetch-session__line">Funding target: ${Number(funding.amountUsdc).toFixed(2)} USDC</span>
            )}
            {funding?.amountAtomic && <span className="fetch-session__line">Amount atomic: {funding.amountAtomic}</span>}
            {walletAddress && <span className="fetch-session__line">Deposit wallet: {walletAddress}</span>}
            {funding?.reference && <span className="fetch-session__line">Reference: {funding.reference}</span>}
            {funding?.txUrl && (
              <button className="fetch-session__action" onClick={() => openExternal(funding.txUrl!)}>
                Open Funding Link
              </button>
            )}
            {funding?.solanaPayUrl && (
              <button className="fetch-session__action" onClick={() => openExternal(funding.solanaPayUrl!)}>
                Open Solana Pay
              </button>
            )}
            {session?.expiresAt && <span className="fetch-session__line">Expires: {new Date(session.expiresAt).toLocaleTimeString()}</span>}
          </div>
          {qr && <QrMode qr={qr} />}
          {toolOutput.merchantSettlement && toolOutput.merchantSettlement.length > 0 && (
            <div className="fetch-session fetch-session--warn">
              <span className="fetch-session__line">Merchant settlement destinations (DO NOT FUND DIRECTLY):</span>
              {toolOutput.merchantSettlement.map((m, i) => (
                <span key={`${m.payTo || 'payto'}-${i}`} className="fetch-session__line">
                  {getNetworkName(m.network || '') || m.network || 'Network'} · {m.asset || 'asset'} · {m.payTo || 'n/a'}
                </span>
              ))}
            </div>
          )}
          {toolOutput.requirements && <JsonViewer data={toolOutput.requirements} />}
        </div>
      </div>
    );
  }

  // Error
  if (toolOutput.error) {
    return (
      <div className="fetch" style={{ maxHeight: maxHeight ?? undefined }}>
        <div className="fetch-card">
          <div className="fetch-card__title">x402 Execution Result</div>
          <div className="fetch-card__hero">Execution Ledger</div>
          <FetchRail state="error" />
          <div className="fetch-status">
            <span className="fetch-badge fetch-badge--error">Error</span>
          </div>
          <div className="fetch-error">{toolOutput.error}</div>
        </div>
      </div>
    );
  }

  // Success with payment
  const payment = toolOutput.payment;
  const settled = payment?.settled;
  const details = payment?.details;
  const network = details?.network;
  const price = formatPrice(details?.requirements);
  const imageUrl = isImageUrl(toolOutput.data);

  return (
    <div className="fetch" style={{ maxHeight: maxHeight ?? undefined }}>
      <div className="fetch-card">
        <div className="fetch-card__title">x402 Execution Result</div>
        <div className="fetch-card__hero">Execution Ledger</div>
        <FetchRail state={settled ? 'success' : 'pending'} />
        <div className="fetch-status">
          {settled ? (
            <span className="fetch-badge fetch-badge--success">✓ Paid</span>
          ) : (
            <span className="fetch-badge fetch-badge--success">✓ {toolOutput.status}</span>
          )}
          {price && <span className="fetch-badge fetch-badge--network">{price} USDC</span>}
          {network && <span className="fetch-badge fetch-badge--network">{getNetworkName(network)}</span>}
        </div>

        {settled && details?.transaction && (
          <div className="fetch-receipt">
            <div className="fetch-receipt__field">
              <span className="fetch-receipt__label">Transaction</span>
              <button className="fetch-receipt__value fetch-receipt__link"
                onClick={() => openExternal(getExplorerUrl(details.transaction!, network))}>
                {shortenHash(details.transaction)}
              </button>
            </div>
            <div className="fetch-receipt__field">
              <span className="fetch-receipt__label">Payer</span>
              <span className="fetch-receipt__value">{details.payer ? shortenHash(details.payer) : '—'}</span>
            </div>
          </div>
        )}

        {imageUrl ? (
          <ImageViewer url={imageUrl} />
        ) : toolOutput.data !== undefined ? (
          <JsonViewer data={toolOutput.data} />
        ) : null}
      </div>
    </div>
  );
}

const root = document.getElementById('x402-fetch-result-root');
if (root) {
  root.setAttribute('data-widget-build', X402_WIDGET_BUILD);
  createRoot(root).render(<FetchResult />);
}

export default FetchResult;
