/**
 * ReceiptStamp — the wax-seal moment for a successful paid call.
 *
 * Visual vocabulary: a circular "PAID" stamp with the amount + settlement
 * time + network forming the outer ring, and a small Solscan link
 * underneath. The transaction hash is the destination, never the content
 * — anyone who wants to see it taps through to the explorer.
 *
 * The stamp uses CSS conic/radial gradients to suggest ink density rather
 * than a flat fill. The slight rotation (-3deg) keeps it from feeling
 * machine-stamped.
 */

import type { ReceiptStampData } from './types';

interface Props {
  data: ReceiptStampData;
  onOpen?: (url: string) => void;
}

function formatSettlementTime(ms?: number): string {
  if (!ms || ms <= 0) return '';
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 10) return `${seconds.toFixed(1)}s`;
  return `${Math.round(seconds)}s`;
}

export function ReceiptStamp({ data, onOpen }: Props) {
  const settle = formatSettlementTime(data.settlementMs);
  const explorerHost = data.explorerUrl
    ? (() => {
        try { return new URL(data.explorerUrl).hostname.replace(/^www\./, ''); }
        catch { return ''; }
      })()
    : '';

  const handleOpen = () => {
    if (data.explorerUrl && onOpen) onOpen(data.explorerUrl);
  };

  return (
    <div className="dx-receipt-stamp-block">
      <button
        type="button"
        className="dx-receipt-stamp"
        onClick={handleOpen}
        aria-label={`Paid ${data.priceLabel}${settle ? ` in ${settle}` : ''} on ${data.networkName}. Tap to view transaction on ${explorerHost || 'explorer'}.`}
      >
        <span className="dx-receipt-stamp__core">
          <span className="dx-receipt-stamp__paid">PAID</span>
          <span className="dx-receipt-stamp__amount">{data.priceLabel || '—'}</span>
          {settle && (
            <span className="dx-receipt-stamp__settle">{settle}</span>
          )}
          <span className="dx-receipt-stamp__network">{data.networkName || ''}</span>
        </span>
        <span className="dx-receipt-stamp__inner-ring" aria-hidden />
        <span className="dx-receipt-stamp__outer-ring" aria-hidden />
      </button>
      {data.explorerUrl && (
        <button
          type="button"
          className="dx-receipt-stamp__link"
          onClick={handleOpen}
        >
          View on {explorerHost || 'explorer'} <span aria-hidden>↗</span>
        </button>
      )}
    </div>
  );
}
