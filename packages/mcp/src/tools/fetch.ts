import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { LoadedWallet } from "../wallet/index.js";
import { getApiBase } from "../config.js";
import { FETCH_META } from "../widget-meta.js";

interface FetchOpts {
  dev: boolean;
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

async function createQrSession(
  accept: Record<string, unknown>,
  resourceUrl: string,
  dev: boolean,
): Promise<Record<string, unknown>> {
  const sessionRes = await fetch(`${getApiBase(dev)}/v2/pay/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      payTo: accept.payTo,
      amount: String(accept.amount || accept.maxAmountRequired),
      asset: accept.asset,
      feePayer: (accept.extra as Record<string, unknown>)?.feePayer || "",
      resourceUrl,
    }),
  });
  return await sessionRes.json() as Record<string, unknown>;
}

async function pollSessionStatus(nonce: string, dev: boolean, maxAttempts = 60): Promise<Record<string, unknown>> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await fetch(`${getApiBase(dev)}/v2/pay/status/${nonce}`);
    const status = await res.json() as Record<string, unknown>;
    if (status.state === "paid" || status.state === "expired") return status;
  }
  return { state: "timeout" };
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
      const { wrapFetch } = await import("@dexterai/x402/client");
      const x402FetchFn = wrapFetch(fetch, {
        walletPrivateKey: wallet.info.solanaPrivateKey,
      });

      const paidRes = await x402FetchFn(params.url, fetchOpts);
      const data = await parseResponse(paidRes);
      const settlement = extractSettlement(paidRes);

      return {
        status: paidRes.status,
        data,
        payment: settlement ? { settled: true, details: settlement } : { settled: false },
      };
    } catch (err: any) {
      return { status: 402, error: `Payment failed: ${err.message}`, requirements };
    }
  }

  // Mode 2: QR pay (no local wallet)
  if (firstAccept && String(firstAccept.network || "").startsWith("solana")) {
    try {
      const session = await createQrSession(firstAccept, params.url, opts.dev);

      if (!session.ok) {
        return { status: 402, error: "Failed to create payment session", requirements };
      }

      return {
        status: 402,
        mode: "qr",
        message: "Scan the QR code with Phantom or Solflare to pay, then this tool will automatically complete the request.",
        qr: {
          solanaPayUrl: session.solanaPayUrl,
          nonce: session.nonce,
          expiresAt: session.expiresAt,
        },
        pollUrl: `${getApiBase(opts.dev)}/v2/pay/status/${session.nonce}`,
        requirements,
      };
    } catch {
      // Fall through to manual mode
    }
  }

  // Fallback: return raw requirements
  return {
    status: 402,
    message: "Payment required. Set DEXTER_PRIVATE_KEY for auto-pay, or use a Solana wallet to pay manually.",
    requirements,
  };
}

export function registerFetchTool(
  server: McpServer,
  wallet: LoadedWallet | null,
  opts: FetchOpts,
): void {
  const hasWallet = wallet !== null;

  server.tool(
    "x402_fetch",
    hasWallet
      ? "Call any x402-protected API with automatic payment. " +
        "Signs and pays using your local wallet. Returns the API response directly."
      : "Call any x402-protected API. Returns payment requirements. " +
        "Configure DEXTER_PRIVATE_KEY to enable automatic payment.",
    {
      url: z.string().url().describe("The x402 resource URL to call"),
      method: z
        .enum(["GET", "POST", "PUT", "DELETE"])
        .default("GET")
        .describe("HTTP method"),
      body: z.string().optional().describe("JSON request body for POST/PUT"),
    },
    async (args) => {
      try {
        const result = await x402Fetch(
          { url: args.url, method: args.method, body: args.body },
          wallet,
          opts,
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
    },
  );
}

export async function cliFetch(
  url: string,
  opts: { method: string; body?: string; dev: boolean },
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
