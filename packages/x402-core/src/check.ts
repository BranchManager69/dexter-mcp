/**
 * @dexterai/x402-core — Endpoint pricing probe
 *
 * ONE canonical checkEndpointPricing() that replaces the duplicated copies in:
 *   - open-mcp-server.mjs (x402Check)
 *   - toolsets/x402-client/index.mjs (checkEndpointPricing)
 *   - opendexter-ide/packages/mcp/src/tools/check.ts (swap in v1.2+)
 */

export interface PaymentOption {
  price: number;
  priceFormatted: string;
  network: string | null;
  scheme: string | null;
  asset: string | null;
  payTo: string | null;
}

/**
 * authMode classifies how an endpoint gates access.
 *
 * - `paid` — returns 402 with payment options (no SIWX)
 * - `siwx` — returns 402 with a `sign-in-with-x` extension and empty accepts (wallet proof, no payment)
 * - `apiKey` — returns 401/403 (API key required; x402 flow does not apply until the provider authenticates)
 * - `apiKey+paid` — has BOTH an API-key gate AND a 402 response (rare, usually a wrapped/proxied path)
 * - `unprotected` — 2xx on probe (no payment required)
 * - `unknown` — indeterminate (5xx, network error, non-standard response)
 */
export type AuthMode = 'paid' | 'siwx' | 'apiKey' | 'apiKey+paid' | 'unprotected' | 'unknown';

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
  /** @deprecated use inputSchema/outputSchema instead. Kept for backward compat with v1.0.x consumers. */
  schema?: unknown;
  /**
   * Request shape — what the caller should send. Extracted from `accepts[0].outputSchema.input`
   * per the x402scan schema convention. Null when the endpoint doesn't embed schemas.
   */
  inputSchema?: unknown;
  /**
   * Response shape — what the caller will receive. Extracted from `accepts[0].outputSchema.output`.
   * Null when the endpoint doesn't embed schemas.
   */
  outputSchema?: unknown;
  /**
   * How the endpoint gates access. See AuthMode.
   */
  authMode?: AuthMode;
}

/**
 * Probe an endpoint for x402 payment requirements without paying.
 *
 * Handles:
 *   - 402 with accepts[] → paid; parses accepts array, computes per-chain pricing, extracts schemas
 *   - 402 with empty accepts + `sign-in-with-x` extension → siwx (wallet-gated identity, no payment)
 *   - 401/403 → apiKey (provider-level auth, x402 not reached yet)
 *   - 5xx → server error
 *   - Other 4xx → client error
 *   - 2xx → unprotected (endpoint is free)
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
        authMode: 'apiKey',
        message: bodyText || 'Provider authentication required before x402 payment flow.',
      };
    }
    if (res.status >= 500) {
      return { requiresPayment: false, error: true, statusCode: res.status, authMode: 'unknown', message: 'Server error' };
    }
    if (res.status >= 400) {
      return { requiresPayment: false, error: true, statusCode: res.status, authMode: 'unknown', message: `Client error: ${res.status}` };
    }
    return { requiresPayment: false, statusCode: res.status, free: true, authMode: 'unprotected' };
  }

  let body: any = null;
  try {
    body = await res.json();
  } catch { /* non-JSON 402 body */ }

  const accepts = body?.accepts;
  const extensions = body?.extensions;
  const hasSiwx = extensions && typeof extensions === 'object' && 'sign-in-with-x' in extensions;
  const hasPaidAccepts = Array.isArray(accepts) && accepts.length > 0;

  // SIWX-only (wallet-gated identity, no payment)
  if (hasSiwx && !hasPaidAccepts) {
    return {
      requiresPayment: false,
      statusCode: 402,
      x402Version: body?.x402Version ?? 2,
      authMode: 'siwx',
      paymentOptions: [],
      resource: body?.resource || null,
    };
  }

  if (!hasPaidAccepts) {
    return {
      requiresPayment: true,
      statusCode: 402,
      error: true,
      authMode: 'unknown',
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

  // outputSchema can live at accepts[0].outputSchema OR accepts[0].extra.outputSchema
  // depending on the provider. x402scan schema convention puts it under `extra`;
  // some earlier Dexter routes put it at the top level of the accept. Check both.
  const rawSchema =
    accepts[0]?.outputSchema ||
    accepts[0]?.extra?.outputSchema ||
    null;
  const inputSchema = rawSchema && typeof rawSchema === 'object' && 'input' in rawSchema
    ? (rawSchema as any).input
    : null;
  const outputSchema = rawSchema && typeof rawSchema === 'object' && 'output' in rawSchema
    ? (rawSchema as any).output
    : null;

  // paid + siwx = hybrid
  const authMode: AuthMode = hasSiwx ? 'apiKey+paid' : 'paid';

  return {
    requiresPayment: true,
    statusCode: 402,
    x402Version: body?.x402Version ?? 2,
    paymentOptions,
    resource: body?.resource || null,
    schema: rawSchema,          // legacy field, kept for backward-compat
    inputSchema,
    outputSchema,
    authMode,
  };
}
