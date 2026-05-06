/**
 * AccessProof — "you didn't pay, you proved" stamp variant for x402_access.
 *
 * Same shape as the receipt stamp but with copy that reflects an
 * identity proof rather than a payment. No tx hash or settlement
 * time — the moment is the wallet/SIWE proof.
 */

import type { AccessProofData } from './types';

interface Props {
  data: AccessProofData;
}

export function AccessProof({ data }: Props) {
  return (
    <div className="dx-receipt-stamp-block">
      <div
        className="dx-receipt-stamp dx-receipt-stamp--access"
        role="img"
        aria-label={`Access proof verified via ${data.mode}.`}
      >
        <span className="dx-receipt-stamp__core">
          <span className="dx-receipt-stamp__paid">PROVEN</span>
          <span className="dx-receipt-stamp__amount">{data.mode.toUpperCase()}</span>
          {data.networkName && (
            <span className="dx-receipt-stamp__network">{data.networkName}</span>
          )}
        </span>
        <span className="dx-receipt-stamp__inner-ring" aria-hidden />
        <span className="dx-receipt-stamp__outer-ring" aria-hidden />
      </div>
      {data.signedAddress && (
        <span className="dx-receipt-stamp__link dx-receipt-stamp__link--static">
          Signed by {data.signedAddress}
        </span>
      )}
    </div>
  );
}
