/**
 * SessionFunding — the "your session is unfunded" branch of fetch_result.
 *
 * Visually distinct from the receipt: this isn't a receipt, this is a
 * checkpoint. We want the user to fund quickly and try again.
 *
 * Renders deposit address (with copy), QR for Solana Pay if available,
 * and an "open funding page" button.
 */

import { useEffect, useState } from 'react';
import { CopyButton } from '@openai/apps-sdk-ui/components/Button';

interface SessionFunding {
  amountAtomic?: string;
  amountUsdc?: number;
  walletAddress?: string;
  payTo?: string;
  txUrl?: string;
  solanaPayUrl?: string;
  reference?: string;
}

interface Props {
  message?: string;
  funding?: SessionFunding;
  expiresAt?: string;
  onOpenExternal: (url: string) => void;
}

function FundingCountdown({ expiresAt }: { expiresAt: string }) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, new Date(expiresAt).getTime() - Date.now());
      if (remaining <= 0) { setLabel('Expired'); return; }
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setLabel(`${mins}:${secs.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);
  return <span className="dx-receipt-funding__countdown">Expires in {label}</span>;
}

export function SessionFunding({ message, funding, expiresAt, onOpenExternal }: Props) {
  const walletAddress = funding?.walletAddress || funding?.payTo;
  const qrUrl = funding?.solanaPayUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(funding.solanaPayUrl)}`
    : null;

  return (
    <section className="dx-receipt-funding" aria-label="Session needs funding">
      <span className="dx-receipt-funding__eyebrow">Session · Needs funding</span>
      <p className="dx-receipt-funding__message">
        {message || 'Fund your OpenDexter session to execute this paid call.'}
      </p>

      {funding?.amountUsdc !== undefined && (
        <p className="dx-receipt-funding__target">
          Target: <strong>${Number(funding.amountUsdc).toFixed(2)} USDC</strong>
        </p>
      )}

      {walletAddress && (
        <div className="dx-receipt-funding__address">
          <span className="dx-receipt-funding__address-label">Deposit address</span>
          <code className="dx-receipt-funding__address-value">{walletAddress}</code>
          <CopyButton copyValue={walletAddress} variant="ghost" color="secondary" size="sm">
            Copy
          </CopyButton>
        </div>
      )}

      {qrUrl && (
        <div className="dx-receipt-funding__qr">
          <img src={qrUrl} alt="Solana Pay QR" width={170} height={170} />
        </div>
      )}

      <div className="dx-receipt-funding__actions">
        {funding?.txUrl && (
          <button type="button" onClick={() => onOpenExternal(funding.txUrl!)}>
            Open funding page <span aria-hidden>↗</span>
          </button>
        )}
        {funding?.solanaPayUrl && (
          <button type="button" onClick={() => onOpenExternal(funding.solanaPayUrl!)}>
            Solana Pay <span aria-hidden>↗</span>
          </button>
        )}
      </div>

      {expiresAt && <FundingCountdown expiresAt={expiresAt} />}
    </section>
  );
}
