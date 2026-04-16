---
name: x402-client
description: "Integrate x402 payments into any Node.js or browser application using @dexterai/x402/client. Trigger when the user wants to add x402 payment handling to their code, wrap fetch for automatic payments, create keypair wallets, build an x402 client, set up budget accounts for autonomous agents, or handle sponsored access recommendations."
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
| `onPaymentRequired` | (requirements: PaymentAccept) => boolean \| Promise<boolean> | Called before signing. Return false to reject the payment. |

## Pattern 2: createX402Client (Full Control)

More configuration options, multi-chain wallets, custom adapters:

```typescript
import { createX402Client, createKeypairWallet } from '@dexterai/x402/client';

const wallet = await createKeypairWallet(process.env.SOLANA_PRIVATE_KEY!);
const client = createX402Client({
  wallets: { solana: wallet },
  preferredNetwork: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
  maxAmountAtomic: '100000', // Max $0.10 per request
  verbose: true,
});

const response = await client.fetch('https://x402-api.example.com/data');
```

### X402ClientConfig

| Option | Type | Description |
|--------|------|-------------|
| `wallets` | WalletSet | Wallets per chain (`{ solana, evm }`) |
| `adapters` | ChainAdapter[] | Custom chain adapters (default: Solana + EVM) |
| `preferredNetwork` | string | CAIP-2 network to prefer |
| `rpcUrls` | Record<string, string> | Custom RPC URLs |
| `maxAmountAtomic` | string | Max payment per request |
| `fetch` | typeof fetch | Custom fetch implementation |
| `verbose` | boolean | Debug logging |
| `accessPass` | AccessPassClientConfig | Access pass configuration |
| `onPaymentRequired` | (requirements) => boolean \| Promise<boolean> | Pre-payment callback |
| `maxRetries` | number | Retry attempts for transient failures (default 0). Safe — EIP-3009 nonces prevent double payments. |
| `retryDelayMs` | number | Base delay between retries in ms (default 500, doubles each attempt) |

### Multi-chain with EVM

```typescript
import { createX402Client, createKeypairWallet, createEvmKeypairWallet } from '@dexterai/x402/client';

const client = createX402Client({
  wallets: {
    solana: await createKeypairWallet(process.env.SOLANA_PRIVATE_KEY!),
    evm: await createEvmKeypairWallet(process.env.EVM_PRIVATE_KEY!),
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

## Budget Accounts (Autonomous Agents)

Give an AI agent a spending budget with per-request and hourly limits:

```typescript
import { createBudgetAccount } from '@dexterai/x402/client';

const agent = createBudgetAccount({
  walletPrivateKey: process.env.SOLANA_PRIVATE_KEY!,
  budget: {
    total: '50.00',       // $50 total budget
    perRequest: '1.00',   // max $1 per request
    perHour: '10.00',     // max $10/hour
  },
  allowedDomains: ['api.example.com', 'data.example.com'],
});

const response = await agent.fetch('https://api.example.com/data');
console.log(agent.spent);       // '$0.05'
console.log(agent.remaining);   // '$49.95'
console.log(agent.payments);    // 1
```

### BudgetAccount properties

| Property | Type | Description |
|----------|------|-------------|
| `fetch` | typeof fetch | Payment-aware fetch with budget enforcement |
| `spent` | string | Total spent (formatted, e.g., '$12.34') |
| `remaining` | string | Remaining budget (formatted) |
| `payments` | number | Number of payments made |
| `spentAmount` | number | Total spent as raw number |
| `remainingAmount` | number | Remaining as raw number |
| `ledger` | PaymentRecord[] | Full payment history |

## Payment Receipts

Access typed payment receipts after a successful x402 call:

```typescript
import { getPaymentReceipt } from '@dexterai/x402/client';

const response = await x402Fetch(url);
const receipt = getPaymentReceipt(response);
if (receipt) {
  console.log(receipt.transaction);  // tx hash
  console.log(receipt.network);      // CAIP-2 network
  console.log(receipt.payer);        // payer address
}
```

## Sponsored Access (Ads for Agents)

Extract sponsored recommendations from x402 payment responses:

```typescript
import { getSponsoredRecommendations, fireImpressionBeacon } from '@dexterai/x402/client';

const response = await x402Fetch(url);
const recs = getSponsoredRecommendations(response);
if (recs) {
  for (const rec of recs) {
    console.log(`${rec.sponsor}: ${rec.description} — ${rec.resourceUrl}`);
  }
  await fireImpressionBeacon(response); // Confirm delivery to ad network
}
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

### AccessPassClientConfig

| Option | Type | Description |
|--------|------|-------------|
| `enabled` | boolean | Enable access pass mode (default true when config present) |
| `preferTier` | string | Preferred tier ID (e.g., '1h') |
| `preferDuration` | number | Preferred custom duration in seconds |
| `maxSpend` | string | Maximum willing to spend in USD |
| `autoRenew` | boolean | Auto-purchase when expired (default true) |

The client caches the JWT access pass per host and sends it as `Authorization: Bearer <jwt>` on subsequent requests.

## API Discovery

Search the Dexter marketplace for paid APIs:

```typescript
import { capabilitySearch } from '@dexterai/x402/client';

const result = await capabilitySearch({ query: 'get ETH spot price' });
for (const api of result.strongResults) {
  console.log(`${api.name}: ${api.price} — ${api.why}`);
}
```

## Error Handling

```typescript
import { X402Error } from '@dexterai/x402/client';

try {
  const res = await x402Fetch(url);
} catch (err) {
  if (err instanceof X402Error) {
    // err.code is one of the X402ErrorCode values
    // err.details has additional context
    switch (err.code) {
      // Client errors
      case 'insufficient_balance':          // Wallet needs more USDC
      case 'no_matching_payment_option':    // No wallet for available chains
      case 'amount_exceeds_max':            // Exceeds maxAmountAtomic
      case 'payment_rejected':              // Server rejected the payment
      case 'missing_fee_payer':             // Solana option missing feePayer
      case 'unsupported_network':           // No adapter for the required network
      case 'wallet_not_connected':          // Wallet not connected
      case 'user_rejected_signature':       // User declined signing
      case 'transaction_build_failed':      // Failed to build payment tx
      case 'rpc_timeout':                   // RPC call timed out
      case 'facilitator_timeout':           // Facilitator didn't respond
      // Server errors
      case 'facilitator_verify_failed':     // Facilitator rejected verification
      case 'facilitator_settle_failed':     // Settlement failed on-chain
      // Access pass errors
      case 'access_pass_expired':           // Pass expired
      case 'access_pass_tier_not_found':    // Requested tier unavailable
      case 'access_pass_exceeds_max_spend': // Tier costs more than maxSpend
    }
  }
}
```

## Exports

| Export | Description |
|--------|-------------|
| `wrapFetch` | Wrap any fetch with x402 auto-pay |
| `createX402Client` | Full-featured client with multi-chain support |
| `getPaymentReceipt` | Get typed payment receipt from a response |
| `createKeypairWallet` | Create Solana wallet from private key (async) |
| `createEvmKeypairWallet` | Create EVM wallet from private key (async) |
| `createBudgetAccount` | Autonomous agent with spending controls |
| `capabilitySearch` | Semantic search over the x402 marketplace |
| `getSponsoredRecommendations` | Extract sponsored recs from payment response |
| `getSponsoredAccessInfo` | Get full sponsored-access extension data |
| `fireImpressionBeacon` | Confirm sponsored rec delivery to ad network |
| `X402Error` | Error class with `.code` for programmatic handling |
| `DEXTER_FACILITATOR_URL` | `https://x402.dexter.cash` |
| `SOLANA_MAINNET` | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` |
| `BASE_MAINNET` | `eip155:8453` |
| `USDC_MINT` | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
