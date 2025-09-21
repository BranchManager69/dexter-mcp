# Pumpstream Toolset

This folder contains the MCP toolset that calls `https://pump.dexter.cash/api/live` to return a short summary of live Pump streams.

## Files

- `index.mjs` — exports `registerPumpstreamToolset`, registering the `pumpstream_live_summary` tool.

## Tool Reference

### `pumpstream_live_summary`

| Field   | Description |
|---------|-------------|
| Name    | `pumpstream_live_summary` |
| Purpose | Fetch a real-time summary from the Pumpstream API |
| Input   | Supports `limit` (1–50), `sort` (`marketCap` or `viewers`), `status` filters, minimum viewer / USD market-cap thresholds, and `includeSpotlight` to append the highlight list |
| Output  | JSON (as text) with generator metadata, aggregate totals, filtered streams, and optional spotlight entries |

**Note:** The tool normalizes both SOL and USD market caps from the Pumpstream payload so callers can pick their preferred denomination.
