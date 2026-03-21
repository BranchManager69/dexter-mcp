import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { LoadedWallet } from "../wallet/index.js";
import { getSolanaBalance, getEvmUsdcBalance } from "../wallet/index.js";
import { getApiBase } from "../config.js";
import { FETCH_META } from "../widget-meta.js";
import { loadSettings } from "../settings.js";

interface FetchOpts {
  dev: boolean;
  maxAmountUsdc?: number;
}

function extractPriceUsdc(accept: Record<string, unknown>): number | null {
  const amount = Number(accept.amount || 0);
  const extra = (accept.extra && typeof accept.extra === "object") ? accept.extra as Record<string, unknown> : null;
  const decimals = Number(extra?.decimals ?? 6);
  if (!Number.isFinite(amount) || !Number.isFinite(decimals)) return null;
  return amount / Math.pow(10, decimals);
}

async function getAvailableUsdcForNetwork(wallet: LoadedWallet, network: string): Promise<number> {
  if (network.startsWith("solana:") && wallet.info.solanaAddress) {
    const { usdc } = await getSolanaBalance(wallet.info.solanaAddress);
    return usdc;
  }
  if (network.startsWith("eip155:") && wallet.info.evmAddress) {
    return await getEvmUsdcBalance(wallet.info.evmAddress, network);
  }
  return 0;
}

async function evaluatePaymentRequirements(
  wallet: LoadedWallet,
  requirements: Record<string, unknown> | null,
  maxAmountUsdc?: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const accepts = Array.isArray(requirements?.accepts) ? requirements.accepts as Array<Record<string, unknown>> : [];
  if (accepts.length === 0) return { ok: true };

  const settings = loadSettings();
  const effectiveMaxAmount = maxAmountUsdc ?? settings.maxAmountUsdc;
  const evaluated = await Promise.all(
    accepts.map(async (accept) => {
      const network = String(accept.network || "");
      const priceUsdc = extractPriceUsdc(accept);
      const availableUsdc = network ? await getAvailableUsdcForNetwork(wallet, network) : 0;
      return { network, priceUsdc, availableUsdc };
    }),
  );

  const withinPolicy = evaluated.filter((row) => row.priceUsdc != null && row.priceUsdc <= effectiveMaxAmount);
  if (withinPolicy.length === 0) {
    const prices = evaluated
      .filter((row) => row.priceUsdc != null)
      .map((row) => `$${row.priceUsdc!.toFixed(2)} on ${row.network}`)
      .join(", ");
    return {
      ok: false,
      error: `Payment policy blocked this call. Available options: ${prices}. Current maxAmountUsdc is $${effectiveMaxAmount.toFixed(2)}. Use x402_settings to raise it.`,
    };
  }

  const funded = withinPolicy.filter((row) => row.priceUsdc != null && row.availableUsdc >= row.priceUsdc);
  if (funded.length === 0) {
    const balances = withinPolicy
      .map((row) => `${row.network}: have $${row.availableUsdc.toFixed(2)}, need $${row.priceUsdc!.toFixed(2)}`)
      .join("; ");
    return {
      ok: false,
      error: `Insufficient balance for this call. ${balances}`,
    };
  }

  return { ok: true };
}

async function parseResponse(res: Response): Promise<unknown> {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("json")) {
    try { return await res.json(); } catch { return await res.text(); }
  }
  return await res.text();
}

function extractSettlement(res: Response): unknown {
  const header = res.headers.get("payment-response") || res.headers.get("PAYMENT-RESPONSE");
  if (!header) return null;
  try { return JSON.parse(atob(header)); } catch {
    try { return JSON.parse(header); } catch { return null; }
  }
}

function parse402(body: unknown): { requirements: Record<string, unknown> | null; firstAccept: Record<string, unknown> | null } {
  const obj = body as Record<string, unknown> | null;
  if (!obj?.accepts || !Array.isArray(obj.accepts)) return { requirements: null, firstAccept: null };
  return {
    requirements: { accepts: obj.accepts, x402Version: obj.x402Version ?? 2, resource: obj.resource },
    firstAccept: obj.accepts[0] as Record<string, unknown> || null,
  };
}

async function x402Fetch(
  params: { url: string; method: string; body?: string; headers?: Record<string, string> },
  wallet: LoadedWallet | null,
  opts: FetchOpts,
): Promise<Record<string, unknown>> {
  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(params.headers || {}),
  };
  const fetchOpts: RequestInit = {
    method: params.method || "GET",
    headers: requestHeaders,
  };
  if (params.body && params.method !== "GET") {
    fetchOpts.body = params.body;
  }

  const probeRes = await fetch(params.url, { ...fetchOpts, signal: AbortSignal.timeout(15_000) });

  if (probeRes.status !== 402) {
    return { status: probeRes.status, data: await parseResponse(probeRes) };
  }

  let body402: unknown = null;
  try { body402 = await probeRes.json(); } catch {
    try { body402 = await probeRes.text(); } catch {}
  }

  const { requirements, firstAccept } = parse402(body402);

  // Mode 1: Local wallet auto-pay
  if (wallet) {
    try {
      const policyCheck = await evaluatePaymentRequirements(wallet, requirements, opts.maxAmountUsdc);
      if (!policyCheck.ok) {
        return { status: 402, error: policyCheck.error, requirements };
      }

      const { wrapFetch } = await import("@dexterai/x402/client");
      const x402FetchFn = wrapFetch(fetch, {
        walletPrivateKey: wallet.info.solanaPrivateKey,
        evmPrivateKey: wallet.info.evmPrivateKey,
      });

      const paidRes = await x402FetchFn(params.url, fetchOpts);
      const data = await parseResponse(paidRes);
      const settlement = extractSettlement(paidRes);

      const { getSponsoredRecommendations, fireImpressionBeacon } = await import("@dexterai/x402/client");
      let sponsoredRecs = getSponsoredRecommendations(paidRes);
      if (!sponsoredRecs && data && typeof data === "object" && Array.isArray((data as any)._x402_sponsored)) {
        sponsoredRecs = (data as any)._x402_sponsored;
      }
      if (sponsoredRecs) {
        fireImpressionBeacon(paidRes).catch(() => {});
      }

      const result: Record<string, unknown> = {
        status: paidRes.status,
        data,
        payment: settlement ? { settled: true, details: settlement } : { settled: false },
      };

      if (sponsoredRecs?.length) {
        result.recommendations = sponsoredRecs;
        result._recommendations_hint = `Sponsored: ${sponsoredRecs.map(r => `${r.sponsor} — ${r.description} (${r.resourceUrl})`).join('; ')}. Call with x402_fetch if relevant.`;
      }

      return result;
    } catch (err: any) {
      return { status: 402, error: `Payment failed: ${err.message}`, requirements };
    }
  }

  // No local signing wallet: return canonical x402 requirements only.
  // Clients must settle using x402 payment-signature flow and retry.
  return {
    status: 402,
    message: "Payment required. Configure DEXTER_PRIVATE_KEY (Solana) or EVM_PRIVATE_KEY (Base/Polygon/etc) for automatic settlement, or provide payment-signature manually.",
    requirements,
  };
}

export function registerFetchTool(
  server: McpServer,
  wallet: LoadedWallet | null,
  opts: FetchOpts,
): void {
  const hasWallet = wallet !== null;
  const description = hasWallet
    ? "Call any x402-protected API with automatic USDC payment across Solana, Base, Polygon, Arbitrum, Optimism, and Avalanche. " +
      "Signs and pays using your local wallet. Returns the API response directly."
    : "Call any x402-protected API. Returns payment requirements. " +
      "Configure DEXTER_PRIVATE_KEY (Solana) or EVM_PRIVATE_KEY (EVM chains) to enable automatic payment.";

  const inputSchema = {
    url: z.string().url().describe("The x402 resource URL to call"),
    method: z
      .enum(["GET", "POST", "PUT", "DELETE"])
      .default("GET")
      .describe("HTTP method"),
    body: z.string().optional().describe("JSON request body for POST/PUT"),
    maxAmountUsdc: z.number().positive().optional().describe("Optional per-call spend cap override in USDC."),
  };

  const runFetch = async (args: { url: string; method: "GET" | "POST" | "PUT" | "DELETE"; body?: string; maxAmountUsdc?: number }) => {
    try {
      const result = await x402Fetch(
        { url: args.url, method: args.method, body: args.body },
        wallet,
        { ...opts, maxAmountUsdc: args.maxAmountUsdc },
      );
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
        _meta: FETCH_META,
      } as any;
    } catch (err: any) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: err.message }) }],
        isError: true,
      };
    }
  };

  server.tool(
    "x402_fetch",
    description,
    inputSchema,
    runFetch,
  );

  server.tool(
    "x402_pay",
    "Alias of x402_fetch for clients that want an explicit payment verb. " +
      "Uses the same local-wallet x402 payment flow and returns the same settlement/result payload.",
    inputSchema,
    runFetch,
  );
}

export async function cliFetch(
  url: string,
  opts: { method: string; body?: string; dev: boolean; maxAmountUsdc?: number },
): Promise<void> {
  try {
    const { loadOrCreateWallet } = await import("../wallet/index.js");
    const wallet = await loadOrCreateWallet();
    const result = await x402Fetch(
      { url, method: opts.method, body: opts.body },
      wallet,
      opts,
    );
    console.log(JSON.stringify(result, null, 2));
  } catch (err: any) {
    const msg = err.cause?.code === "ENOTFOUND"
      ? `Could not reach ${url} — DNS lookup failed`
      : err.name === "TimeoutError"
        ? `Request to ${url} timed out`
        : err.message || String(err);
    console.log(JSON.stringify({ error: msg }, null, 2));
    process.exit(1);
  }
}
