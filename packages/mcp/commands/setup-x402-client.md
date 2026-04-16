---
name: setup-x402-client
description: Add x402 payment handling to a Node.js project using @dexterai/x402.
---

# Add x402 Client to Your Project

Set up automatic x402 payment handling so your application can call paid APIs.

## Steps

1. Install the SDK:

```bash
npm install @dexterai/x402
```

2. Create a payment-enabled fetch wrapper. Add this file to your project:

```typescript
// lib/x402.ts
import { wrapFetch } from '@dexterai/x402/client';

export const x402Fetch = wrapFetch(fetch, {
  walletPrivateKey: process.env.SOLANA_PRIVATE_KEY!,
  maxAmountAtomic: '1000000', // Safety limit: max $1.00 per request
  verbose: process.env.NODE_ENV === 'development',
});
```

3. Add your private key to `.env`:

```
SOLANA_PRIVATE_KEY=your-base58-private-key-here
```

4. Use it anywhere in your application:

```typescript
import { x402Fetch } from './lib/x402';

const response = await x402Fetch('https://x402-api.example.com/data');
const data = await response.json();
```

5. For dual-chain support (Solana + EVM), add the EVM key:

```typescript
export const x402Fetch = wrapFetch(fetch, {
  walletPrivateKey: process.env.SOLANA_PRIVATE_KEY!,
  evmPrivateKey: process.env.EVM_PRIVATE_KEY,
});
```

## Verify

Test with the Dexter test endpoint:

```typescript
const res = await x402Fetch('https://x402.dexter.cash/api/v2-test', { method: 'POST' });
console.log(await res.json()); // Should return test data + payment receipt
```
