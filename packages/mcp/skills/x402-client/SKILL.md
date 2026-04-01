---
name: x402-client
description: "Integrate x402 payments into any Node.js or browser application using @dexterai/x402/client. Trigger when the user wants to add x402 payment handling to their code, wrap fetch for automatic payments, create keypair wallets, or build an x402 client."
---

# @dexterai/x402 Client SDK

Add automatic x402 payment handling to any application. The client detects 402 responses, signs a USDC payment, and retries — all transparently.

```bash
npm install @dexterai/x402
```

## Pattern 1: wrapFetch (Simplest — Recommended for Node.js)

One function, wraps `fetch`, handles everything:

```typescript
import { wrapFetch } from '@dexterai/x402/client';

const x402Fetch = wrapFetch(fetch, {
  walletPrivateKey: process.env.SOLANA_PRIVATE_KEY!,
});

const response = await x402Fetch('https://x402-api.example.com/data');
const data = await response.json();
```

### Dual-chain support

Pass both keys to pay on Solana or EVM chains automatically:

```typescript
const x402Fetch = wrapFetch(fetch, {
  walletPrivateKey: process.env.SOLANA_PRIVATE_KEY!,
  evmPrivateKey: process.env.EVM_PRIVATE_KEY,
  preferredNetwork: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
});
```

### Full WrapFetchOptions

| Option | Type | Description |
|--------|------|-------------|
| `walletPrivateKey` | string / number[] / Uint8Array | Solana private key (base58 or byte array) |
| `evmPrivateKey` | string | EVM private key (hex with 0x prefix) |
| `preferredNetwork` | string | CAIP-2 network to prefer when multiple options exist |
| `facilitatorUrl` | string | Override facilitator (default: `https://x402.dexter.cash`) |
| `rpcUrls` | Record<string, string> | Custom RPC URLs by network |
| `maxAmountAtomic` | string | Reject payments exceeding this amount (safety limit) |
| `verbose` | boolean | Enable debug logging |
| `accessPass` | AccessPassClientConfig | Prefer time-limited passes over per-request payments |

## Pattern 2: createX402Client (Full Control)

More configuration options, multi-chain wallets, custom adapters:

```typescript
import { createX402Client, createKeypairWallet } from '@dexterai/x402/client';

const wallet = createKeypairWallet(process.env.SOLANA_PRIVATE_KEY!);
const client = createX402Client({
  wallets: { solana: wallet },
  preferredNetwork: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
  maxAmountAtomic: '100000', // Max $0.10 per request
  verbose: true,
});

const response = await client.fetch('https://x402-api.example.com/data');
```

### Multi-chain with EVM

```typescript
import { createX402Client, createKeypairWallet, createEvmKeypairWallet } from '@dexterai/x402/client';

const client = createX402Client({
  wallets: {
    solana: createKeypairWallet(process.env.SOLANA_PRIVATE_KEY!),
    evm: createEvmKeypairWallet(process.env.EVM_PRIVATE_KEY!),
  },
});
```

### Browser with wallet adapters

```typescript
import { createX402Client } from '@dexterai/x402/client';

const client = createX402Client({
  wallets: {
    solana: phantomWallet,  // from @solana/wallet-adapter
    evm: wagmiWallet,       // from wagmi useAccount()
  },
});
```

## Access Passes

Pay once for time-limited unlimited access instead of per-request:

```typescript
const x402Fetch = wrapFetch(fetch, {
  walletPrivateKey: process.env.SOLANA_PRIVATE_KEY!,
  accessPass: {
    preferTier: '1h',       // Prefer the 1-hour tier
    maxSpend: '2.00',       // Don't spend more than $2
    autoRenew: true,        // Auto-purchase when expired
  },
});
```

The client caches the JWT access pass per host and sends it as `Authorization: Bearer <jwt>` on subsequent requests.

## Error Handling

```typescript
import { X402Error } from '@dexterai/x402/client';

try {
  const res = await x402Fetch(url);
} catch (err) {
  if (err instanceof X402Error) {
    switch (err.code) {
      case 'insufficient_balance': // Wallet needs more USDC
      case 'no_matching_payment_option': // No wallet for available chains
      case 'amount_exceeds_max': // Exceeds maxAmountAtomic
      case 'payment_rejected': // Server rejected the payment
      case 'missing_fee_payer': // Solana option missing feePayer
    }
  }
}
```

## Exports

| Export | Description |
|--------|-------------|
| `wrapFetch` | Wrap any fetch with x402 auto-pay |
| `createX402Client` | Full-featured client with multi-chain support |
| `createKeypairWallet` | Create Solana wallet from private key |
| `createEvmKeypairWallet` | Create EVM wallet from private key |
| `X402Error` | Error class with `.code` for programmatic handling |
| `DEXTER_FACILITATOR_URL` | `https://x402.dexter.cash` |
| `SOLANA_MAINNET` | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` |
| `BASE_MAINNET` | `eip155:8453` |
| `USDC_MINT` | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
