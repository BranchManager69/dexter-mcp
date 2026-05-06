/**
 * ReceiptLoading — the "Dexter is processing this paid call" state.
 *
 * Reuses the shared <DexterLoading> primitive so the visual identity
 * matches search and passkey-onboard. Stage copy escalates with elapsed
 * time so it doesn't look frozen on slow endpoints.
 */

import { DexterLoading } from '../loading/DexterLoading';

interface Props {
  resourceLabel?: string | null;
}

export function ReceiptLoading({ resourceLabel }: Props) {
  return (
    <DexterLoading
      eyebrow="Dexter · Receipt"
      stages={[
        {
          upTo: 3,
          heading: 'Submitting payment…',
          supporting: 'Quoting the resource and preparing the on-chain transfer.',
        },
        {
          upTo: 9,
          heading: 'Awaiting settlement…',
          supporting: 'Facilitator is confirming the payment and forwarding to the seller.',
        },
        {
          upTo: 18,
          heading: 'Calling the endpoint…',
          supporting: 'Payment cleared; waiting on the seller to respond.',
        },
        {
          upTo: Infinity,
          heading: 'Still processing — endpoint is slow.',
          supporting: 'The settlement landed; the seller is taking longer than usual.',
        },
      ]}
      context={resourceLabel || null}
      contextLabel="endpoint"
    />
  );
}
