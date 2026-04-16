---
name: setup-opendexter
description: Install the OpenDexter MCP server to give your AI agent x402 payment tools.
---

# Install OpenDexter MCP

Set up the x402 gateway so your AI agent can search, price-check, and pay for any x402 API.

## Steps

1. Run the installer — it auto-detects your AI client and writes the MCP config:

```bash
npx @dexterai/opendexter install
```

Supports: Cursor, Claude Code, Codex, VS Code, Windsurf, Gemini CLI. Claude Code gets full plugin support (MCP server + 7 skills) in a single install.

2. The installer creates a local Solana wallet at `~/.dexterai-mcp/wallet.json`. Note the address it prints.

3. Fund the wallet with USDC on Solana. Send to the address from step 2. You also need a tiny amount of SOL for transaction fees (~0.001 SOL).

4. Verify it works — in your AI client, ask the agent to run:

```
x402_wallet
```

It should show your wallet address and USDC balance.

5. Test a search:

```
x402_search("test")
```

## Manual Configuration

If the installer doesn't support your client, add this to your MCP config:

```json
{
  "mcpServers": {
    "dexter-x402": {
      "command": "npx",
      "args": ["-y", "@dexterai/opendexter@latest"]
    }
  }
}
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DEXTER_PRIVATE_KEY` | Override wallet (base58 Solana private key) |
| `SOLANA_PRIVATE_KEY` | Alias for DEXTER_PRIVATE_KEY |
| `SOLANA_RPC_URL` | Custom Solana RPC endpoint |
