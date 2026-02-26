import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CHECK_META } from "../widget-meta.js";

interface CheckOpts {
  dev: boolean;
}

async function checkEndpoint(url: string, method: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: method !== "GET" ? "{}" : undefined,
    signal: AbortSignal.timeout(15_000),
  });

  if (res.status !== 402) {
    if (res.status >= 500) {
      return { error: true, statusCode: res.status, message: "Server error" };
    }
    if (res.status >= 400) {
      return { error: true, statusCode: res.status, message: `Client error: ${res.status}` };
    }
    return { requiresPayment: false, statusCode: res.status, free: true };
  }

  let body: Record<string, unknown> | null = null;
  try {
    body = await res.json() as Record<string, unknown>;
  } catch {}

  const accepts = body?.accepts as Array<Record<string, unknown>> | undefined;
  if (!accepts?.length) {
    return {
      requiresPayment: true,
      statusCode: 402,
      error: "No payment options found in 402 response",
    };
  }

  const paymentOptions = accepts.map((a) => {
    const amount = Number(a.amount || a.maxAmountRequired || 0);
    const decimals = Number(a.extra && typeof a.extra === "object" && "decimals" in a.extra
      ? (a.extra as Record<string, unknown>).decimals
      : 6);
    return {
      price: amount / Math.pow(10, decimals),
      priceFormatted: `$${(amount / Math.pow(10, decimals)).toFixed(decimals > 2 ? 4 : 2)}`,
      network: a.network,
      scheme: a.scheme,
      asset: a.asset,
      payTo: a.payTo,
    };
  });

  return {
    requiresPayment: true,
    statusCode: 402,
    x402Version: body?.x402Version ?? 2,
    paymentOptions,
    resource: body?.resource,
  };
}

export function registerCheckTool(server: McpServer, opts: CheckOpts): void {
  server.tool(
    "x402_check",
    "Check if an endpoint requires x402 payment and see its pricing. " +
      "Does NOT make a payment — just probes for requirements.",
    {
      url: z.string().url().describe("The URL to check"),
      method: z
        .enum(["GET", "POST", "PUT", "DELETE"])
        .default("GET")
        .describe("HTTP method to probe with"),
    },
    async (args) => {
      try {
        const result = await checkEndpoint(args.url, args.method);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
          _meta: CHECK_META,
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
