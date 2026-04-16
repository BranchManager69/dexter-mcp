---
name: setup-x402-server
description: Add an x402 paywall to an Express API endpoint using @dexterai/x402.
---

# Add x402 Paywall to Your Server

Protect any Express endpoint with x402 payments. Users pay USDC to access your API.

## Steps

1. Install the SDK:

```bash
npm install @dexterai/x402
```

2. Add the middleware to any Express route:

```typescript
import express from 'express';
import { x402Middleware } from '@dexterai/x402/server';

const app = express();

app.get('/api/premium-data',
  x402Middleware({
    payTo: 'YOUR_SOLANA_ADDRESS', // Replace with your wallet address
    amount: '0.01',               // $0.01 per request
  }),
  (req, res) => {
    // This only runs after successful payment
    res.json({
      data: 'premium content',
      payer: req.x402?.payer,
      transaction: req.x402?.transaction,
    });
  }
);

app.listen(3000);
```

3. Test with curl — first request gets a 402:

```bash
curl -i http://localhost:3000/api/premium-data
# HTTP/1.1 402 Payment Required
# PAYMENT-REQUIRED: eyJ4NDAy...
```

4. Test with a funded x402 client:

```typescript
import { wrapFetch } from '@dexterai/x402/client';

const x402Fetch = wrapFetch(fetch, {
  walletPrivateKey: process.env.SOLANA_PRIVATE_KEY!,
});

const res = await x402Fetch('http://localhost:3000/api/premium-data');
console.log(await res.json());
// { data: "premium content", payer: "2SB3V...", transaction: "5xK9..." }
```

## Options

- **Stripe settlement**: Use `stripePayTo(process.env.STRIPE_SECRET_KEY)` as the `payTo` value to settle payments into Stripe.
- **Dynamic pricing**: Use `getAmount: (req) => calculatePrice(req.body)` for request-dependent pricing.
- **EVM chains**: Set `network: 'eip155:8453'` for Base instead of Solana.
- **Access passes**: Use `x402AccessPass()` for time-limited unlimited access.

## List on Marketplace

Once your endpoint is live, register it on the Dexter Marketplace at https://dexter.cash/onboard so agents can discover it via `x402_search`.
