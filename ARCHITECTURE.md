# OpenDexter Architecture

## Overview

One npm package (`@dexterai/opendexter`), two modes, three Cursor server entries.

Source code: `packages/mcp/`

```
┌─────────────────────────────────────────────────────────────┐
│                    SOURCE CODE                               │
│  packages/mcp/                                               │
│  Package: @dexterai/opendexter                               │
│  npm: https://www.npmjs.com/package/@dexterai/opendexter     │
│                                                              │
│  This is ONE npm package. It does everything.                │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ published to npm as
                           │ @dexterai/opendexter
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
     ┌─────────────────┐      ┌──────────────────┐
     │   CLI MODE       │      │   SERVER MODE     │
     │                  │      │   (MCP)           │
     │ opendexter       │      │                   │
     │   wallet         │      │ opendexter server │
     │   install        │      │   (default cmd)   │
     │   search         │      │                   │
     │   fetch          │      │ Runs as subprocess │
     │   pay            │      │ by Cursor/Claude   │
     │                  │      │                   │
     │ Runs in YOUR     │      │ 5 tools:          │
     │ terminal (TTY)   │      │  x402_search      │
     │                  │      │  x402_check       │
     │ Wallet creation  │      │  x402_fetch       │
     │ + progress bars  │      │  x402_pay         │
     │ happen here      │      │  x402_wallet      │
     └─────────────────┘      └────────┬──────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                   │
                    ▼                  ▼                   ▼
        ┌───────────────┐  ┌───────────────┐  ┌────────────────┐
        │ CURSOR SERVER │  │ CURSOR SERVER │  │ CURSOR SERVER  │
        │      #1       │  │      #2       │  │      #3        │
        │               │  │               │  │                │
        │ plugin-x402-  │  │ user-         │  │ user-          │
        │ dexter-x402   │  │ dexter-x402   │  │ OpenDexter     │
        │               │  │               │  │                │
        │ Installed by: │  │ Installed by: │  │ Installed by:  │
        │ Cursor x402   │  │ Manual add    │  │ Manual add     │
        │ marketplace   │  │ in Settings   │  │ in Settings    │
        │ plugin        │  │               │  │                │
        │               │  │ DUPLICATE     │  │ DIFFERENT MODE │
        │ Local wallet  │  │ OF #1         │  │ Session-based  │
        │ mode          │  │               │  │ wallets, not   │
        │               │  │               │  │ local wallet   │
        │ Runs:         │  │               │  │ QR code funding│
        │ npx @dexter-  │  │               │  │ 4 UI resources │
        │ ai/opendexter │  │               │  │                │
        │ @latest       │  │               │  │ For users who  │
        │               │  │               │  │ DON'T have     │
        │               │  │               │  │ their own key  │
        └───────┬───────┘  └───────┬───────┘  └───────┬────────┘
                │                  │                   │
                └──────────┬───────┘                   │
                           │                           │
                           ▼                           ▼
                ┌───────────────────┐      ┌────────────────────┐
                │ ~/.dexterai-mcp/  │      │ OpenDexter hosted  │
                │ wallet.json       │      │ session service    │
                │                   │      │                    │
                │ Local private key │      │ Ephemeral wallets  │
                │ Local addresses   │      │ managed by Dexter  │
                │                   │      │ servers            │
                │ Auto-created on   │      │                    │
                │ first CLI run     │      │ For external users │
                └───────────────────┘      └────────────────────┘
```

## Wallet Modes

### Local Wallet (Servers #1 and #2)

- Private key stored at `~/.dexterai-mcp/wallet.json`
- Auto-created on first `opendexter wallet` or `opendexter install`
- Dual-chain: Solana address + EVM address (same file)
- User funds it with USDC, agent pays for x402 APIs directly
- Vanity prefix: Solana starts with `dex`, EVM starts with `0x402DD`

### Session Wallet (Server #3 — OpenDexter)

- No local private key
- OpenDexter creates ephemeral session wallets on its servers
- Each session gets a Solana wallet + EVM wallet
- User funds via deposit address or Solana Pay QR code
- Session auto-selects cheapest payment chain
- Has 4 additional UI resources for rendering in Cursor

## Key Paths

| What | Path |
|------|------|
| Source code | `packages/mcp/src/` |
| Wallet creation | `packages/mcp/src/wallet/index.ts` |
| Vanity grinder | `packages/mcp/src/wallet/vanity.ts` |
| Vanity worker | `packages/mcp/src/wallet/vanity-worker.ts` |
| Progress display | `packages/mcp/src/wallet/vanity-progress.ts` |
| Config | `packages/mcp/src/config.ts` |
| MCP server | `packages/mcp/src/server/index.ts` |
| CLI entry | `packages/mcp/src/cli/` |
| Build config | `packages/mcp/tsup.config.ts` |
| Wallet file | `~/.dexterai-mcp/wallet.json` |
| Cursor plugin | `~/.cursor/plugins/x402/` |

## CLI Commands

```
opendexter server          # Start MCP server (default, runs as subprocess)
opendexter install         # Install into AI client (Cursor, Claude, etc.)
opendexter wallet          # Show/create wallet with progress bars
opendexter search <query>  # Search x402 marketplace
opendexter fetch <url>     # Fetch x402 resource with payment
opendexter pay <url>       # Alias for fetch
```

## Notes

- Server #1 and #2 in Cursor are duplicates. One can be removed.
- Wallet creation with vanity prefix grinding must ONLY happen in CLI mode (TTY), never during server startup (subprocess).
- The server should start in search-only mode if no wallet exists and instruct the user to run `opendexter wallet`.
