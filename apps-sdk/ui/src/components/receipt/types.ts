/** Recommendation surfaced from the facilitator's match for the paid call. */
export interface ReceiptRecommendation {
  resourceUrl: string;
  method?: string;
  description: string;
  sponsor: string;
  bazaarId?: string;
}

export interface ReceiptStampData {
  /** USDC amount (already formatted, e.g. "$0.02"). Empty string when unknown. */
  priceLabel: string;
  /**
   * The display number for the stamp's "settle in N" line, in milliseconds.
   * Prefer `payment.details.settleDurationMs` when present (clean
   * facilitator timing, no roundtrip pollution); fall back to
   * `payment.details.settlementMs` (full open-mcp roundtrip) so older
   * facilitator deploys still get a number.
   */
  settlementMs?: number;
  /** Network short name (e.g. "Solana", "Base"). Empty string when unknown. */
  networkName: string;
  /** Full transaction hash. The stamp links to it on the right explorer. */
  txHash: string;
  /** Pre-built explorer URL — used as the stamp's `href`. */
  explorerUrl: string;
}

export interface AccessProofData {
  /** Auth mode the resource accepted ("siwx", "wallet", etc). */
  mode: string;
  /** The address that signed the access proof (truncated for display). */
  signedAddress?: string;
  /** Network the proof was signed on, if relevant. */
  networkName: string;
}
