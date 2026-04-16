/**
 * @dexterai/x402-core — Capability search HTTP client
 *
 * ONE canonical search function that replaces the duplicated HTTP clients in:
 *   - packages/mcp/src/tools/search.ts (capabilitySearch)
 *   - dexter-x402-sdk/src/client/discovery.ts (capabilitySearch)
 *   - open-mcp-server.mjs (inline fetch)
 *   - toolsets/x402-client/index.mjs (inline fetch)
 */

import type {
  CapabilitySearchOptions,
  CapabilitySearchResult,
  RawCapabilityResponse,
} from './types.js';
import { formatResource } from './format.js';

const DEFAULT_ENDPOINT = 'https://x402.dexter.cash/api/x402gle/capability';
const DEFAULT_TIMEOUT = 20_000;

/**
 * Search the Dexter x402 marketplace using semantic capability search.
 *
 * Returns tiered results (strongResults + relatedResults) with every field
 * run through the canonical formatResource(). Handles synonym expansion and
 * cross-encoder LLM rerank internally — pass the user's natural-language
 * intent directly.
 *
 * @example
 * ```typescript
 * import { capabilitySearch } from '@dexterai/x402-core';
 *
 * const result = await capabilitySearch({ query: 'get ETH spot price' });
 * for (const api of result.strongResults) {
 *   console.log(`${api.name} (${api.tier}): ${api.price}`);
 * }
 * ```
 */
export async function capabilitySearch(
  options: CapabilitySearchOptions,
): Promise<CapabilitySearchResult> {
  if (!options?.query?.trim()) {
    throw new Error('capabilitySearch: query is required');
  }

  const {
    query,
    limit = 20,
    unverified,
    testnets,
    rerank,
    debug,
    endpoint = DEFAULT_ENDPOINT,
  } = options;

  const params = new URLSearchParams();
  params.set('q', query);
  params.set('limit', String(Math.min(Math.max(limit, 1), 50)));
  if (unverified) params.set('unverified', 'true');
  if (testnets) params.set('testnets', 'true');
  if (rerank === false) params.set('rerank', 'false');
  if (debug) params.set('debug', 'true');

  const url = `${endpoint}?${params.toString()}`;

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Capability search failed: ${response.status} ${body.slice(0, 400)}`,
    );
  }

  const data = (await response.json()) as RawCapabilityResponse;
  if (!data.ok) {
    throw new Error(
      `Capability search error${data.stage ? ` at stage ${data.stage}` : ''}: ${data.error ?? 'unknown'}`,
    );
  }

  return {
    query: data.query,
    strongResults: data.strongResults.map(formatResource),
    relatedResults: data.relatedResults.map(formatResource),
    strongCount: data.strongCount,
    relatedCount: data.relatedCount,
    topSimilarity: data.topSimilarity,
    noMatchReason: data.noMatchReason,
    rerank: {
      enabled: data.rerank.enabled,
      applied: data.rerank.applied,
      reason: data.rerank.reason,
    },
    intent: {
      capabilityText: data.intent.capabilityText,
      expandedCapabilityText: data.intent.expandedCapabilityText,
    },
    durationMs: data.durationMs,
  };
}
