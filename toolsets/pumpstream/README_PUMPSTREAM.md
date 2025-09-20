# Pumpstream Toolset

This folder contains the MCP toolset that calls `https://pump.dexter.cash/api/live` to return a short summary of live Pump streams.

## Files

- `index.mjs` — exports `registerPumpstreamToolset`, registering the `pumpstream_live_summary` tool.

## Tool Reference

### `pumpstream_live_summary`

| Field   | Description                                                       |
|---------|-------------------------------------------------------------------|
| Name    | `pumpstream_live_summary`                                         |
| Purpose | Fetch a real-time summary from the Pumpstream API                 |
| Input   | Optional `limit` (number, 1-10) controlling the number of streams |
| Output  | JSON (as text) with `generatedAt`, `windowMinutes`, and streams   |

**Note:** Market caps are reported directly from Pumpstream. They currently appear denominated in SOL. If you want USD values, fetch the SOL/USD price and convert before returning.
