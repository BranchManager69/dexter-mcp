# Dexter MCP Tool Inventory

This document tracks the capabilities of the Dexter MCP server, distinguishing between locally implemented tools and dynamic x402 resources fetched at runtime.

## Summary Counts

| Category | Count | Description |
| :--- | :--- | :--- |
| **Total Capabilities** | **49** | Combined total of all available tools. |
| **Local Native** | **16** | Pure logic implemented locally (e.g., wallet management, solana swaps). |
| **Local Bridge** | **19** | Local files that wrap x402 paid resources (Stream, Onchain, Hyperliquid, Bundles). |
| **Dynamic x402** | **14** | Purely dynamic tools fetched from the API (Jupiter, Games, AI Jobs). |

---

## 1. Local Native Tools (16)
*Hardcoded logic residing in `dexter-mcp/toolsets`. These run locally or hit free public RPCs.*

### 📦 General
- `search`: Search Dexter documentation.
- `fetch`: Fetch documentation pages.

### 📦 PumpStream
- `pumpstream_live_summary`: Fetch live Pump.fun market summaries.

### 📦 Wallet
- `resolve_wallet`: Resolve a wallet address from an alias or user ID.
- `list_my_wallets`: List authenticated user's connected wallets.
- `set_session_wallet_override`: Override the active wallet for the current session.
- `auth_info`: Diagnostic tool for Supabase/OAuth session state.

### 📦 Solana
- `solana_resolve_token`: Resolve a token mint address from a ticker/name.
- `solana_list_balances`: Fetch token balances for a wallet.
- `solana_send`: Send SOL or SPL tokens.
- `solana_swap_preview`: Get a quote for a swap (Jupiter Free API).
- `solana_swap_execute`: Execute a swap.

### 📦 Codex
- `codex_start`: Start a new Codex session.
- `codex_reply`: Send a message to Codex.
- `codex_exec`: Execute a Codex command.

### 📦 Markets
- `markets_fetch_ohlcv`: Fetch OHLCV candle data (Birdeye).

---

## 2. Local Bridge Tools (9)
*Hardcoded wrappers in `dexter-mcp/toolsets` that call paid/metered x402 endpoints.*

### 📦 Stream
- `stream_public_shout`: Send a message to the stream overlay.
- `stream_shout_feed`: Read the stream shout queue.

### 📦 Onchain
- `onchain_activity_overview`: Premium wallet/token analytics.
- `onchain_entity_insight`: Deep dive analytics for entities.

### 📦 Hyperliquid
- `hyperliquid_markets`: List available perp markets.
- `hyperliquid_opt_in`: Register a sub-account.
- `hyperliquid_fund`: Bridge funds to Hyperliquid.
- `hyperliquid_bridge_deposit`: Deposit to L1 bridge.
- `hyperliquid_perp_trade`: Execute a perp trade.

### 📦 Bundles
- `list_bundles`: Browse and search available tool bundles.
- `get_bundle`: Get detailed info about a specific bundle.
- `get_my_bundles`: List bundles you've created as curator.
- `create_bundle`: Create a new tool bundle (starts as draft).
- `update_bundle`: Update bundle name, description, pricing.
- `publish_bundle`: Publish a draft bundle for purchase.
- `add_bundle_item`: Add a marketplace tool to your bundle.
- `remove_bundle_item`: Remove a tool from your bundle.
- `check_bundle_access`: Check access status for a purchased bundle.
- `get_my_purchases`: List all bundles you've purchased.

---

## 3. Dynamic x402 Tools (~14)
*Fetched at runtime from `api.dexter.cash`. These have NO local code definition.*

### 📦 x402 (General Bundle)
- `jupiter_quote_pro`: Premium routing for Jupiter swaps.
- `jupiter_quote_preview`: (Often overlaps with local, but exists as dynamic resource).
- `tools_solscan_trending_pro`: Premium trending token data.
- `solscan_trending_tokens`: Standard trending token data.
- `slippage_sentinel`: AI-driven slippage analysis.
- `x402_scan_stats`: Network diagnostics for the x402 protocol.
- `twitter_topic_analysis`: Social sentiment analysis.

### 📦 Games
- `games_story_append`: Add to the AI story chain.
- `games_story_read`: Read the AI story chain.
- `games_king_usurp`: Pay to become the "King" of the hill.
- `games_king_state`: Check current King status.

### 📦 Creative Jobs
- `sora_video_job`: Generate video with Sora.
- `meme_generator_job`: Generate AI memes.

---

## Architecture Visualization

```text
 ┌──────────────────────────────────────────────────────────────────────────────────────┐
 │                             DEXTER MCP SERVER ARCHITECTURE                           │
 │                                [ Total Capabilities: 39 ]                            │
 └───────────────────────────────────────────┬──────────────────────────────────────────┘
                                             │
      ┌──────────────────────────────────────┼──────────────────────────────────────┐
      │                                      │                                      │
┌─────▼──────────────────────┐     ┌─────────▼────────────────────┐     ┌───────────▼─────────────────────┐
│ 1. LOCAL NATIVE [16]       │     │ 2. LOCAL BRIDGE [9]          │     │ 3. DYNAMIC x402 [14]            │
│ "The Built-Ins"            │     │ "The Hardcoded Wrappers"     │     │ "The Store-Bought"              │
╞════════════════════════════╡     ╞══════════════════════════════╡     ╞═════════════════════════════════╡
│ • Code: LIVES HERE (Disk)  │     │ • Code: LIVES HERE (Wrapper) │     │ • Code: NONE (Fetched JSON)     │
│ • Exec: LOCALLY / Public   │     │ • Exec: REMOTE (Dexter API)  │     │ • Exec: REMOTE (Dexter API)     │
│ • Cost: FREE               │     │ • Cost: PAID / METERED       │     │ • Cost: PAID / METERED          │
│ • Updates: Require Restart │     │ • Updates: Require Restart   │     │ • Updates: INSTANT (Hot-Swap)   │
└────────────┬───────────────┘     └──────────────┬───────────────┘     └───────────────┬─────────────────┘
             │                                    │                                     │
    ┌────────▼────────┐                  ┌────────▼────────┐                   ┌────────▼────────┐
    │ 📦 GENERAL      │                  │ 📦 STREAM       │                   │ 📦 GENERAL x402 │
    │ • search        │                  │ • public_shout  │                   │ • jupiter_quote_│
    │ • fetch         │                  │ • shout_feed    │                   │   pro           │
    │                 │                  │                 │                   │ • tools_solscan_│
    │ 📦 PUMPSTREAM   │                  │ 📦 ONCHAIN      │                   │   trending_pro  │
    │ • live_summary  │                  │ • activity_over-│                   │ • solscan_trend-│
    │                 │                  │   view          │                   │   ing_tokens    │
    │ 📦 WALLET       │                  │ • entity_insight│                   │ • slippage_sen- │
    │ • resolve_wallet│                  │                 │                   │   tinel         │
    │ • list_wallets  │                  │ 📦 HYPERLIQUID  │                   │ • scan_stats    │
    │ • set_override  │                  │ • perp_trade    │                   │ • twitter_analy-│
    │ • auth_info     │                  │ • opt_in        │                   │   sis           │
    │                 │                  │ • fund          │                   │ • jupiter_quote_│
    │ 📦 SOLANA       │                  │ • bridge_deposit│                   │   preview       │
    │ • resolve_token │                  │ • markets       │                   │                 │
    │   (PORT ME!)    │                  └────────┬────────┘                   │ 📦 GAMES        │
    │ • list_balances │                           │                            │ • story_append  │
    │ • send          │                           │                            │ • story_read    │
    │ • swap_preview  │                           │                            │ • king_usurp    │
    │ • swap_execute  │                           │                            │ • king_state    │
    │                 │                           │                            │                 │
    │ 📦 CODEX        │                           │                            │ 📦 CREATIVE     │
    │ • start         │                           │                            │ • sora_video_job│
    │ • reply         │                           │                            │ • meme_gen_job  │
    │ • exec          │                           │                            │                 │
    │                 │                           │                            └────────┬────────┘
    │ 📦 MARKETS      │                           │                                     │
    │ • fetch_ohlcv   │                           │                                     │
    └────────┬────────┘                           │                                     │
             │                                    │                                     │
             ▼                                    ▼                                     ▼
 ┌────────────────────────┐          ┌────────────────────────┐            ┌────────────────────────┐
 │   Executes on CPU or   │          │   Calls Dexter API     │            │   Calls Dexter API     │
 │   Public RPC (free)    │          │   (Authenticated)      │            │   (Authenticated)      │
 └────────────────────────┘          └────────────────────────┘            └────────────────────────┘
```

## The "Big Three" Explained

### 1. Local Native (The "Old World")
*   **What it is:** Pure JavaScript code sitting in your `toolsets/` folder.
*   **How it runs:** Your server runs it directly. It might talk to public APIs like Solana RPC or Birdeye, but it does the heavy lifting itself.
*   **Pros:** Fast, free, works offline (mostly), full control.
*   **Cons:** If you want to change logic, you must redeploy the server. No revenue generation.
*   **Example:** `solana_resolve_token` (Your server queries a token list JSON file locally or hits a public RPC).

### 2. Local Bridge (The "Hybrid")
*   **What it is:** You wrote code in `toolsets/`, but that code is just a **dummy wrapper**. It doesn't do the work; it just forwards the request to `api.dexter.cash`.
*   **How it runs:** Your server accepts the input -> Signs a request -> Sends it to Dexter API -> Returns the result.
*   **Pros:** Allows you to use Paid/x402 features while keeping the "feeling" of a local tool (custom input schemas, special handling).
*   **Cons:** Worst of both worlds? You have to maintain local code AND the remote API.
*   **Example:** `stream_public_shout` (Lives in your code, but effectively just POSTs to the API to display on screen).

### 3. Dynamic x402 (The "New World")
*   **What it is:** **No Code.** Your server wakes up, asks the API "What do you have?", and the API sends back a menu (JSON). Your server auto-generates the tools on the fly.
*   **How it runs:** Same as Bridge (calls API), but setup is automatic.
*   **Pros:** **Zero Maintenance.** You can add a new tool to the API database, and *every* Dexter MCP server instantly gets it without updating software. This is the "App Store" model.
*   **Cons:** Relies 100% on the API being online (hence the 504 errors earlier).
*   **Example:** `sora_video_job` (You never wrote code for this; it just appeared because the API offered it).
