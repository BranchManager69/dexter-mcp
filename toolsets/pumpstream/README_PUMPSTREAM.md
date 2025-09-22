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
| Input   | `pageSize`/`limit` (1–100), `offset` or `page` for pagination, `sort` (`marketCap` or `viewers`), `status`, `minMarketCapUsd`, `minViewers`, free-text `search`, `symbols`/`mintIds` filters, and `includeSpotlight` |
| Output  | JSON (as text) with generator metadata, aggregate totals, paging metadata (`pageSize`, `offset`, `currentPage`, `totalPages`, `hasMore`), filtered streams, and optional spotlight entries |

**Notes**
- Both SOL and USD market caps are included for each stream.
- `pageSize` defaults to 25 when omitted; `page` overrides `offset` for 1-based navigation.
- `symbols`/`mintIds` accept either a comma-separated string or an array of strings.
