# Dexter MCP Agents

## Toolset Overview
- **general** – `search` and `fetch` surface curated Dexter connector/OAuth documentation from a static in-memory index (`toolsets/general/index.mjs`). Update the `DOCUMENTS` array when knowledge sources change.
- **pumpstream** – `pumpstream_live_summary` queries `https://pump.dexter.cash/api/live` and returns a condensed stream snapshot. Input schema now supports `limit` (up to 50), `sort`, status filtering, minimum viewer / USD market-cap thresholds, and optional spotlight data.
- **wallet** – Session-aware wallet helpers (`resolve_wallet`, `list_my_wallets`, `set_session_wallet_override`, `auth_info`) backed by `/api/wallets/resolver`. Session overrides are stored in-memory and keyed by the MCP session header.

All toolsets register through `toolsets/index.mjs`. If `TOKEN_AI_MCP_TOOLSETS` is unset, every registered group loads; set the variable (comma-separated keys or `all`) to control selection.

## Harness Operations
- **Location** – `../dexter-agents/scripts/runHarness.js` with CLI entry `scripts/dexchat.js` (npm script `dexchat`).
- **Standard run** –
  ```bash
  npm run dexchat -- --prompt "<prompt>" --wait 15000
  ```
- **Artifacts** – Saved under `dexter-agents/harness-results/` unless `--no-artifact` is provided. Each JSON artifact records prompt, console logs, rendered transcript bubbles, and the structured event payloads from the app.
- **Monitoring** – Review console output for schema warnings (e.g., Zod `.optional()` without `.nullable()`) and treat them as regressions to be cleared before release.

## Operating Notes
- Keep this document evergreen: update tool descriptions when schemas, endpoints, or behaviors change.
- When adding tools, follow the conventions in `toolsets/ADDING_TOOLSETS.md` and document the new capabilities here.
- Harness artifacts provide the source of truth for recent behavioral checks; store long-lived analyses elsewhere so this guide remains an operating manual rather than a task list.
