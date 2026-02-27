import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getApiBase, MARKETPLACE_PATH } from "../config.js";
import { SEARCH_META } from "../widget-meta.js";

interface SearchOpts {
  dev: boolean;
}

interface MarketplaceResource {
  resourceUrl: string;
  displayName?: string;
  description?: string | null;
  method?: string;
  priceUsdc?: number | null;
  priceLabel?: string | null;
  priceNetwork?: string | null;
  qualityScore?: number | null;
  verificationStatus?: string | null;
  totalSettlements?: number;
  totalVolumeUsdc?: number;
  category?: string | null;
  seller?: { displayName?: string | null };
  reputationScore?: number | null;
  authRequired?: boolean;
  authType?: string | null;
  authHint?: string | null;
}

function formatResource(r: MarketplaceResource) {
  return {
    name: r.displayName || r.resourceUrl,
    url: r.resourceUrl,
    method: r.method || "GET",
    price: r.priceLabel || (r.priceUsdc != null ? `$${r.priceUsdc.toFixed(2)}` : "free"),
    network: r.priceNetwork || null,
    description: r.description || "",
    category: r.category || "uncategorized",
    qualityScore: r.qualityScore ?? null,
    verified: r.verificationStatus === "pass",
    totalCalls: r.totalSettlements ?? 0,
    seller: r.seller?.displayName || null,
    sellerReputation: r.reputationScore ?? null,
    authRequired: Boolean(r.authRequired),
    authType: r.authType ?? null,
    authHint: r.authHint ?? null,
  };
}

async function searchMarketplace(
  params: {
    query?: string;
    category?: string;
    network?: string;
    maxPriceUsdc?: number;
    verifiedOnly?: boolean;
    sort?: string;
    limit?: number;
  },
  opts: SearchOpts,
) {
  const qs = new URLSearchParams();
  if (params.query) qs.set("search", params.query);
  if (params.category) qs.set("category", params.category);
  if (params.network) qs.set("network", params.network);
  if (params.maxPriceUsdc != null) qs.set("maxPrice", String(params.maxPriceUsdc));
  if (params.verifiedOnly) qs.set("verified", "true");
  qs.set("sort", params.sort || "marketplace");
  qs.set("limit", String(Math.min(params.limit || 20, 50)));

  const url = `${getApiBase(opts.dev)}${MARKETPLACE_PATH}?${qs}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`Marketplace returned ${res.status}: ${await res.text().catch(() => "")}`);
  }

  const data = await res.json() as { resources?: MarketplaceResource[] };
  return {
    resources: (data.resources || []).map(formatResource),
    total: data.resources?.length || 0,
  };
}

export function registerSearchTool(server: McpServer, opts: SearchOpts): void {
  server.tool(
    "x402_search",
    "Search the Dexter x402 marketplace for paid API resources. " +
      "Returns services with pricing, quality scores, and verification status. " +
      "Use this to discover APIs an agent can pay for and call with x402_fetch.",
    {
      query: z.string().optional().describe("Search term, e.g. 'token analysis', 'image generation'"),
      category: z.string().optional().describe("Filter by category"),
      network: z.string().optional().describe("Filter by payment network: 'solana', 'base', 'polygon'"),
      maxPriceUsdc: z.number().optional().describe("Maximum price per call in USDC"),
      verifiedOnly: z.boolean().optional().describe("Only return verified endpoints"),
      sort: z
        .enum(["relevance", "quality_score", "settlements", "volume", "recent", "marketplace"])
        .optional()
        .describe("Sort order (default: marketplace)"),
      limit: z.number().optional().default(20).describe("Max results (1-50)"),
    },
    async (args) => {
      try {
        const result = await searchMarketplace(args, opts);
        const data = {
          success: true,
          count: result.total,
          resources: result.resources,
          tip: "Use x402_fetch to call any of these endpoints.",
        };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
          structuredContent: data,
          _meta: SEARCH_META,
        } as any;
      } catch (err: any) {
        const payload = { error: err.message || "search_failed", success: false, count: 0, resources: [] };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
          structuredContent: payload,
          _meta: SEARCH_META,
          isError: true,
        } as any;
      }
    },
  );
}

export async function cliSearch(query: string, opts: { dev: boolean }): Promise<void> {
  try {
    const result = await searchMarketplace({ query }, opts);
    console.log(JSON.stringify({ success: true, count: result.total, resources: result.resources }, null, 2));
  } catch (err: any) {
    console.log(JSON.stringify({ error: err.message || String(err) }, null, 2));
    process.exit(1);
  }
}
