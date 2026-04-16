/**
 * @dexterai/x402-core — Endpoint pricing probe
 *
 * ONE canonical checkEndpointPricing() that replaces the duplicated copies in:
 *   - open-mcp-server.mjs (x402Check)
 *   - toolsets/x402-client/index.mjs (checkEndpointPricing)
 */

export interface PaymentOption {
  price: number;
  priceFormatted: string;
  network: string | null;
  scheme: string | null;
  asset: string | null;
  payTo: string | null;
}

export interface CheckResult {
  requiresPayment: boolean;
  statusCode: number;
  free?: boolean;
  error?: boolean | string;
  authRequired?: boolean;
  message?: string;
  x402Version?: number;
  paymentOptions?: PaymentOption[];
  resource?: unknown;
  schema?: unknown;
}

/**
 * Probe an endpoint for x402 payment requirements without paying.
 *
 * Handles:
 *   - 402 → parses accepts array, computes per-chain pricing
 *   - 401/403 → returns authRequired flag
 *   - 5xx → server error
 *   - Other 4xx → client error
 *   - 2xx → endpoint is free
 */
export async function checkEndpointPricing(
  args: { url: string; method?: string },
): Promise<CheckResult> {
  const method = args.method || 'GET';

  const res = await fetch(args.url, {
    method,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: method !== 'GET' ? '{}' : undefined,
    signal: AbortSignal.timeout(15_000),
  });

  if (res.status !== 402) {
    if (res.status === 401 || res.status === 403) {
      const bodyText = await res.text().catch(() => '');
      return {
        requiresPayment: false,
        error: true,
        statusCode: res.status,
        authRequired: true,
        message: bodyText || 'Provider authentication required before x402 payment flow.',
      };
    }
    if (res.status >= 500) {
      return { requiresPayment: false, error: true, statusCode: res.status, message: 'Server error' };
    }
    if (res.status >= 400) {
      return { requiresPayment: false, error: true, statusCode: res.status, message: `Client error: ${res.status}` };
    }
    return { requiresPayment: false, statusCode: res.status, free: true };
  }

  let body: any = null;
  try {
    body = await res.json();
  } catch { /* non-JSON 402 body */ }

  const accepts = body?.accepts;
  if (!Array.isArray(accepts) || !accepts.length) {
    return {
      requiresPayment: true,
      statusCode: 402,
      error: true,
      message: 'No payment options found',
    };
  }

  const paymentOptions: PaymentOption[] = accepts.map((a: any) => {
    const amount = Number(a.amount || a.maxAmountRequired || 0);
    const decimals = Number(a.extra?.decimals ?? 6);
    const price = amount / Math.pow(10, decimals);
    return {
      price,
      priceFormatted: `$${price.toFixed(decimals > 2 ? 4 : 2)}`,
      network: a.network || null,
      scheme: a.scheme || null,
      asset: a.asset || null,
      payTo: a.payTo || null,
    };
  });

  return {
    requiresPayment: true,
    statusCode: 402,
    x402Version: body?.x402Version ?? 2,
    paymentOptions,
    resource: body?.resource || null,
    schema: accepts[0]?.outputSchema || null,
  };
}
