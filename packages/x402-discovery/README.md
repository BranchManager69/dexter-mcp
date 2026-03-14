# @dexterai/x402-discovery

`@dexterai/x402-discovery` is the descriptive install alias for `@dexterai/opendexter`.

Use it when you want the package name itself to tell developers exactly what it does:

- search the x402 marketplace
- inspect pricing and schemas
- pay for and call x402 APIs

## Install

```bash
npx @dexterai/x402-discovery install
```

## Manual MCP config

```json
{
  "mcpServers": {
    "dexter-x402": {
      "command": "npx",
      "args": ["-y", "@dexterai/x402-discovery@latest"]
    }
  }
}
```

## Relationship to OpenDexter

- `@dexterai/opendexter` = the brand/product name
- `@dexterai/x402-discovery` = the descriptive alias for developer discovery

Both point to the same tool behavior.
