/**
 * ReceiptBody — renders the data the user actually paid for.
 *
 * Three render strategies in order of fidelity:
 *   1. If the response is an image (image_url / imageUrl / url ending in
 *      a known image extension), render the image full-width via the
 *      dexter-api proxy so CSP doesn't get in the way.
 *   2. If the response is a string, render it as paragraph text. Useful
 *      for text/plain or simple summaries.
 *   3. Otherwise, render via JsonViewer (existing primitive).
 */

import { JsonViewer } from '../x402';

interface Props {
  data: unknown;
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

export function ReceiptBody({ data }: Props) {
  if (data === undefined || data === null) {
    return (
      <div className="dx-receipt-body dx-receipt-body--empty">
        <span>No payload returned.</span>
      </div>
    );
  }

  const imageUrl = isImageUrl(data);
  if (imageUrl) {
    return (
      <div className="dx-receipt-body dx-receipt-body--image">
        <img src={proxyImageUrl(imageUrl)} alt="Response" />
      </div>
    );
  }

  if (typeof data === 'string') {
    return (
      <div className="dx-receipt-body dx-receipt-body--text">
        <p>{data}</p>
      </div>
    );
  }

  return (
    <div className="dx-receipt-body dx-receipt-body--json">
      <JsonViewer data={data} />
    </div>
  );
}
