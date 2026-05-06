/**
 * SessionFunding — the "your session needs USDC" panel.
 *
 * The "no wallet at all" sub-state was real garbage — the previous
 * implementation rendered eyebrow + paragraph and called it a day.
 * Now the open-mcp side auto-bootstraps a session whenever a paid
 * call hits without one, so this widget always receives a populated
 * `funding` object. The "needs funding" state is the only state.
 *
 * Layout:
 *   - Eyebrow + headline
 *   - Deposit chip: address + copy button + chain pill
 *   - QR (when Solana Pay URL available)
 *   - Funding action buttons (open page / Solana Pay)
 *   - Expiry countdown
 *   - "I've funded — try again" button: reruns the original
 *     x402_fetch call. User-initiated only — no polling, no timers.
 *     Disabled while in flight; surfaces error inline if the retry
 *     itself fails.
 */

import { useEffect, useState } from 'react';
import { CopyButton } from '@openai/apps-sdk-ui/components/Button';
import { useCallToolFn } from '../../sdk/use-call-tool';

interface SessionFundingShape {
  amountAtomic?: string;
  amountUsdc?: number;
  walletAddress?: string;
  payTo?: string;
  txUrl?: string;
  solanaPayUrl?: string;
  reference?: string;
}

interface RetryCall {
  /** Original URL the user wanted to call. */
  url?: string;
  /** Original HTTP method. */
  method?: string;
}

interface Props {
  message?: string;
  funding?: SessionFundingShape;
  expiresAt?: string;
  retryCall?: RetryCall;
  onOpenExternal: (url: string) => void;
}

function FundingCountdown({ expiresAt }: { expiresAt: string }) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    const tick = () => {
      const remaining = Math.max(0, new Date(expiresAt).getTime() - Date.now());
      if (remaining <= 0) { setLabel('Expired'); return; }
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setLabel(`${mins}:${secs.toString().padStart(2, '0')}`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);
  return <span className="dx-receipt-funding__countdown">Session expires in {label}</span>;
}

function shortenAddress(addr: string, head = 6, tail = 4): string {
  if (addr.length <= head + tail + 1) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

export function SessionFunding({
  message,
  funding,
  expiresAt,
  retryCall,
  onOpenExternal,
}: Props) {
  const callTool = useCallToolFn();
  const walletAddress = funding?.walletAddress || funding?.payTo;
  const qrUrl = funding?.solanaPayUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(funding.solanaPayUrl)}`
    : null;
  const targetUsdc = funding?.amountUsdc;
  const amountStr = typeof targetUsdc === 'number' ? `$${targetUsdc.toFixed(2)} USDC` : '';

  const canRetry = Boolean(retryCall?.url);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const handleRetry = async () => {
    if (!retryCall?.url || retrying) return;
    setRetrying(true);
    setRetryError(null);
    try {
      await callTool('x402_fetch', {
        url: retryCall.url,
        method: retryCall.method || 'GET',
      });
      // Result will replace this widget's tool output via the host's
      // refresh — no further work needed here. If it stays as
      // session_required, this same widget re-renders with fresh data.
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Retry failed.';
      setRetryError(msg);
      setRetrying(false);
    }
  };

  return (
    <section className="dx-receipt-funding" aria-label="Session needs funding">
      <div className="dx-receipt-funding__head">
        <span className="dx-receipt-funding__eyebrow">Wallet · Needs funding</span>
        <h2 className="dx-receipt-funding__headline">
          {amountStr ? <>Send <strong>{amountStr}</strong> to continue.</> : 'Fund your wallet to continue.'}
        </h2>
        {message && <p className="dx-receipt-funding__sub">{message}</p>}
      </div>

      {walletAddress && (
        <div className="dx-receipt-funding__chip">
          <span className="dx-receipt-funding__chip-label">Deposit address</span>
          <code className="dx-receipt-funding__chip-value" title={walletAddress}>
            {shortenAddress(walletAddress, 8, 6)}
          </code>
          <CopyButton copyValue={walletAddress} variant="ghost" color="secondary" size="sm">
            Copy
          </CopyButton>
        </div>
      )}

      {qrUrl && (
        <div className="dx-receipt-funding__qr">
          <img src={qrUrl} alt="Solana Pay QR" width={196} height={196} />
        </div>
      )}

      <div className="dx-receipt-funding__actions">
        {funding?.solanaPayUrl && (
          <button
            type="button"
            className="dx-receipt-funding__btn dx-receipt-funding__btn--primary"
            onClick={() => onOpenExternal(funding.solanaPayUrl!)}
          >
            Open in Solana Pay <span aria-hidden>↗</span>
          </button>
        )}
        {funding?.txUrl && (
          <button
            type="button"
            className="dx-receipt-funding__btn"
            onClick={() => onOpenExternal(funding.txUrl!)}
          >
            Funding page <span aria-hidden>↗</span>
          </button>
        )}
      </div>

      {canRetry && (
        <div className="dx-receipt-funding__retry">
          <button
            type="button"
            className="dx-receipt-funding__retry-btn"
            onClick={handleRetry}
            disabled={retrying}
            aria-busy={retrying}
          >
            {retrying ? 'Trying again…' : "I've funded it — try again"}
          </button>
          {retryError && (
            <p className="dx-receipt-funding__retry-error" role="alert">{retryError}</p>
          )}
        </div>
      )}

      {expiresAt && <FundingCountdown expiresAt={expiresAt} />}
    </section>
  );
}
