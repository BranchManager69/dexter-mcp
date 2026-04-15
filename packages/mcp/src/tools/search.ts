import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getApiBase, CAPABILITY_PATH } from "../config.js";
import { SEARCH_META } from "../widget-meta.js";

/**
 * x402_search tool
 *
 * Thin client over dexter-api's /api/x402gle/capability endpoint. Takes a
 * natural-language query, returns tiered results (strong / related) plus
 * a flat legacy `resources[]` mirror so the ChatGPT/Cursor/Claude widget
 * (which pattern-matches legacy field names like priceUsdc, verified,
 * totalCalls, seller) keeps rendering until it's rebuilt for the new shape.
 *
 * The model sees BOTH shapes and should prefer strongResults/relatedResults
 * for reasoning about matches; the widget reads the flat resources[] array.
 */

interface SearchOpts {
  dev: boolean;
}

// ============================================================================
// Response shape returned by /api/x402gle/capability
// ============================================================================

interface CapabilityPricing {
  usdc: number | null;
  network: string | null;
  asset: string | null;
}

interface CapabilityVerification {
  status: string;
  paid: boolean;
  qualityScore: number | null;
  lastVerifiedAt: string | null;
  responseStatus: number | null;
}

interface CapabilityUsage {
  totalSettlements: number;
  totalVolumeUsdc: number;
  lastSettlementAt: string | null;
}

interface CapabilityGaming {
  flags: string[];
  suspicious: boolean;
}

interface CapabilityResult {
  resourceId: string;
  resourceUrl: string;
  displayName: string | null;
  description: string | null;
  category: string | null;
  host: string | null;
  method: string;
  icon: string | null;
  pricing: CapabilityPricing;
  verification: CapabilityVerification;
  usage: CapabilityUsage;
  gaming: CapabilityGaming;
  score: number;
  similarity: number;
  why: string;
  tier: "strong" | "related";
}

interface CapabilityResponse {
  ok: boolean;
  query: string;
  intent: {
    capabilityText: string;
    expandedCapabilityText?: string;
    maxPriceUsdc: number | null;
    minPriceUsdc: number | null;
    minQualityScore: number | null;
    networks: string[] | null;
    categories: string[] | null;
    requireVerified: boolean;
  };
  strongResults: CapabilityResult[];
  relatedResults: CapabilityResult[];
  results: CapabilityResult[];
  totalCandidates: number;
  strongCount: number;
  relatedCount: number;
  topSimilarity: number | null;
  noMatchReason: "below_similarity_threshold" | "below_strong_threshold" | null;
  thresholds: { similarityFloor: number; strongMatch: number };
  rerank: { enabled: boolean; applied: boolean; reason?: string; reasoning?: string };
  embeddingTokens: number;
  durationMs: number;
  error?: string;
  stage?: string;
}

// ============================================================================
// Flat widget-facing shape (legacy compatibility mirror)
//
// The apps-sdk React widget (apps-sdk/ui/src/entries/x402-marketplace-search.tsx)
// consumes `SearchResource` with flat field names. We produce this shape from
// CapabilityResult so the widget keeps rendering without a rewrite. New fields
// (tier, similarity, why) are grafted on so the widget CAN surface them when
// it's upgraded.
// ============================================================================

interface FlatSearchResource {
  resourceId: string;
  name: string;
  url: string;
  method: string;
  price: string;
  priceUsdc: number | null;
  network: string | null;
  description: string;
  category: string;
  qualityScore: number | null;
  verified: boolean;
  verificationStatus: string;
  totalCalls: number;
  totalVolumeUsdc: number;
  iconUrl: string | null;
  seller: string | null;
  sellerMeta: {
    payTo: string | null;
    displayName: string | null;
    logoUrl: string | null;
    twitterHandle: string | null;
  };
  gamingFlags: string[];
  gamingSuspicious: boolean;
  // New capability-search-native fields
  tier: "strong" | "related";
  similarity: number;
  why: string;
  score: number;
}

function flattenResult(r: CapabilityResult): FlatSearchResource {
  const priceUsdc = r.pricing.usdc;
  const priceLabel =
    priceUsdc == null
      ? "price on request"
      : priceUsdc === 0
        ? "free"
        : priceUsdc < 0.01
          ? `$${priceUsdc.toFixed(4)}`
          : `$${priceUsdc.toFixed(2)}`;

  return {
    resourceId: r.resourceId,
    name: r.displayName ?? r.resourceUrl,
    url: r.resourceUrl,
    method: r.method || "GET",
    price: priceLabel,
    priceUsdc,
    network: r.pricing.network,
    description: r.description ?? "",
    category: r.category ?? "uncategorized",
    qualityScore: r.verification.qualityScore,
    verified: r.verification.status === "pass",
    verificationStatus: r.verification.status,
    totalCalls: r.usage.totalSettlements,
    totalVolumeUsdc: r.usage.totalVolumeUsdc,
    iconUrl: r.icon,
    seller: r.host, // widget just wants a label; host is the best proxy we have
    sellerMeta: {
      payTo: null,
      displayName: r.host,
      logoUrl: r.icon,
      twitterHandle: null,
    },
    gamingFlags: r.gaming.flags,
    gamingSuspicious: r.gaming.suspicious,
    tier: r.tier,
    similarity: Math.round(r.similarity * 1000) / 1000,
    why: r.why,
    score: r.score,
  };
}

// ============================================================================
// HTTP client
// ============================================================================

async function capabilitySearch(
  params: {
    query: string;
    limit?: number;
    unverified?: boolean;
    testnets?: boolean;
    rerank?: boolean;
    debug?: boolean;
  },
  opts: SearchOpts,
): Promise<CapabilityResponse> {
  const qs = new URLSearchParams();
  qs.set("q", params.query);
  qs.set("limit", String(Math.min(Math.max(params.limit ?? 20, 1), 50)));
  if (params.unverified) qs.set("unverified", "true");
  if (params.testnets) qs.set("testnets", "true");
  if (params.rerank === false) qs.set("rerank", "false");
  if (params.debug) qs.set("debug", "true");

  const url = `${getApiBase(opts.dev)}${CAPABILITY_PATH}?${qs}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Capability search returned ${res.status}: ${body.slice(0, 400)}`);
  }

  const data = (await res.json()) as CapabilityResponse;
  if (!data.ok) {
    throw new Error(`Capability search failed${data.stage ? ` at stage ${data.stage}` : ""}: ${data.error ?? "unknown"}`);
  }
  return data;
}

// ============================================================================
// MCP tool registration
// ============================================================================

export function registerSearchTool(server: McpServer, opts: SearchOpts): void {
  server.tool(
    "x402_search",
    "Search the Dexter x402 marketplace for paid API resources using semantic capability search. " +
      "Returns two tiers: strong matches (high-confidence capability hits) and related matches " +
      "(adjacent services that cleared the similarity floor but not the strong threshold). " +
      "Handles synonyms and alternate phrasings internally — pass the user's natural-language " +
      "intent directly. Use x402_fetch to call any result.",
    {
      query: z
        .string()
        .describe(
          "Natural-language description of the capability you want. " +
            "e.g. 'check wallet balance on Base', 'generate an image', 'ETH price feed', " +
            "'translate text'. Do NOT pre-filter by chain or category — the search layer " +
            "handles expansion and ranking.",
        ),
      limit: z
        .number()
        .min(1)
        .max(50)
        .optional()
        .default(20)
        .describe("Max results across strong + related tiers combined (1-50, default 20)"),
      unverified: z
        .boolean()
        .optional()
        .describe("Include unverified resources in results (default false)"),
      testnets: z
        .boolean()
        .optional()
        .describe("Include testnet-only resources (default false — testnets hidden by default)"),
      rerank: z
        .boolean()
        .optional()
        .describe(
          "Cross-encoder LLM rerank of top strong results (default true). Set false for " +
            "deterministic order or lowest-latency path.",
        ),
    },
    async (args) => {
      try {
        const result = await capabilitySearch(args, opts);

        const flat = [...result.strongResults, ...result.relatedResults].map(flattenResult);

        const data = {
          success: true,
          count: flat.length,
          // Flat legacy mirror — consumed by the ChatGPT/Cursor/Claude widget.
          resources: flat,
          // Full capability search shape — consumed by the LLM.
          strongResults: result.strongResults.map(flattenResult),
          relatedResults: result.relatedResults.map(flattenResult),
          strongCount: result.strongCount,
          relatedCount: result.relatedCount,
          topSimilarity: result.topSimilarity,
          noMatchReason: result.noMatchReason,
          rerank: result.rerank,
          intent: {
            capabilityText: result.intent.capabilityText,
            expandedCapabilityText: result.intent.expandedCapabilityText,
          },
          searchMeta: {
            mode:
              result.strongCount > 0
                ? "direct"
                : result.relatedCount > 0
                  ? "related_only"
                  : "empty",
            note:
              result.strongCount > 0
                ? `${result.strongCount} strong matches${result.rerank.applied ? " (LLM-reranked)" : ""}`
                : result.relatedCount > 0
                  ? "No exact matches — showing closest related services"
                  : "No results in the index match this query",
          },
          tip:
            result.strongCount > 0
              ? "Use x402_fetch to call any of these endpoints. Strong matches are high-confidence; related matches are adjacent capabilities."
              : result.relatedCount > 0
                ? "No exact match. These are the closest related services — confirm with the user before calling."
                : "Nothing in the index matches this query yet. Try a broader phrasing.",
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
          structuredContent: data,
          _meta: SEARCH_META,
        } as any;
      } catch (err: any) {
        const payload = {
          error: err.message || "search_failed",
          success: false,
          count: 0,
          resources: [],
          strongResults: [],
          relatedResults: [],
          strongCount: 0,
          relatedCount: 0,
        };
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

// ============================================================================
// CLI entrypoint (used by the `opendexter` binary)
// ============================================================================

export async function cliSearch(query: string, opts: { dev: boolean }): Promise<void> {
  try {
    const result = await capabilitySearch({ query }, opts);
    const flat = [...result.strongResults, ...result.relatedResults].map(flattenResult);
    console.log(
      JSON.stringify(
        {
          success: true,
          count: flat.length,
          strongCount: result.strongCount,
          relatedCount: result.relatedCount,
          topSimilarity: result.topSimilarity,
          noMatchReason: result.noMatchReason,
          rerank: result.rerank,
          resources: flat,
        },
        null,
        2,
      ),
    );
  } catch (err: any) {
    console.log(JSON.stringify({ error: err.message || String(err) }, null, 2));
    process.exit(1);
  }
}
