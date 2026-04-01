---
name: x402-server
description: "Add x402 payment protection to any API endpoint using @dexterai/x402/server. Trigger when the user wants to monetize an API, add a paywall, accept crypto payments on their server, set up Stripe settlement, configure dynamic pricing, or create access passes."
---

# @dexterai/x402 Server SDK

Protect any API endpoint with x402 payments. One-liner Express middleware or manual verify/settle control.

```bash
npm install @dexterai/x402
```

## Express Middleware (Recommended)

One line to paywall any endpoint:

```typescript
import express from 'express';
import { x402Middleware } from '@dexterai/x402/server';

const app = express();

app.get('/api/data',
  x402Middleware({
    payTo: 'YourSolanaAddress...',
    amount: '0.01', // $0.01 USD per request
  }),
  (req, res) => {
    // Only runs after successful payment
    res.json({ data: 'premium content', payer: req.x402?.payer });
  }
);
```

### Full X402MiddlewareConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `payTo` | string / PayToProvider | required | Recipient address or Stripe provider |
| `amount` | string | required | USD amount (e.g., "0.01" for 1 cent) |
| `network` | string | Solana mainnet | CAIP-2 network identifier |
| `asset` | { address, decimals } | USDC | Token to accept |
| `facilitatorUrl` | string | `https://x402.dexter.cash` | Facilitator for verify/settle |
| `description` | string | | Human-readable resource description |
| `timeoutSeconds` | number | 120 | Payment timeout |
| `verbose` | boolean | false | Debug logging |
| `getAmount` | (req) => string | | Dynamic amount per request |
| `getDescription` | (req) => string | | Dynamic description per request |

After payment, `req.x402` contains `{ transaction, payer, network }`.

## Manual Server (Advanced)

Full control over the verify/settle flow:

```typescript
import { createX402Server } from '@dexterai/x402/server';

const server = createX402Server({
  payTo: 'YourSolanaAddress...',
  network: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
});

app.post('/api/data', async (req, res) => {
  const paymentSig = req.headers['payment-signature'];

  if (!paymentSig) {
    const requirements = await server.buildRequirements({
      amountAtomic: '50000', // $0.05
      resourceUrl: req.originalUrl,
    });
    res.setHeader('PAYMENT-REQUIRED', server.encodeRequirements(requirements));
    return res.status(402).json({ error: 'Payment required' });
  }

  const verify = await server.verifyPayment(paymentSig);
  if (!verify.isValid) return res.status(402).json({ error: verify.invalidReason });

  const settle = await server.settlePayment(paymentSig);
  if (!settle.success) return res.status(402).json({ error: settle.errorReason });

  res.json({ data: 'premium content', tx: settle.transaction });
});
```

## Stripe Machine Payments

Accept x402 payments that settle directly into your Stripe Dashboard:

```typescript
import { x402Middleware, stripePayTo } from '@dexterai/x402/server';

app.get('/api/data',
  x402Middleware({
    payTo: stripePayTo(process.env.STRIPE_SECRET_KEY!),
    amount: '0.05',
    // stripePayTo auto-configures Base network + Dexter facilitator
  }),
  handler
);
```

`stripePayTo` generates per-request deposit addresses via Stripe Crypto Onramp. Payments land in your Stripe Dashboard as crypto settlements.

## Access Passes

Pay once for time-limited unlimited access:

```typescript
import { x402AccessPass } from '@dexterai/x402/server';

app.use('/api',
  x402AccessPass({
    tiers: [
      { id: '1h', label: '1 Hour', seconds: 3600, price: '0.50', priceAtomic: '500000' },
      { id: '24h', label: '24 Hours', seconds: 86400, price: '2.00', priceAtomic: '2000000' },
    ],
    secret: process.env.ACCESS_PASS_SECRET!,
    payTo: 'YourAddress...',
  })
);
```

Clients receive a JWT in the `ACCESS-PASS` header and send it as `Authorization: Bearer <jwt>` on subsequent requests.

## Dynamic Pricing

### Character-based

```typescript
import { createDynamicPricing } from '@dexterai/x402/server';

const pricing = createDynamicPricing({
  basePrice: 0.001,
  perCharacter: 0.00001,
});

app.post('/api/generate', async (req, res) => {
  const quote = pricing.getQuote(req.body.prompt);
  // Use quote.amountAtomic in x402Middleware or manual flow
});
```

### Token-based (LLM-accurate with tiktoken)

```typescript
import { createTokenPricing } from '@dexterai/x402/server';

const pricing = createTokenPricing({ model: 'gpt-4o' });
const quote = pricing.getQuote({ inputText: prompt, estimatedOutputTokens: 500 });
```

## Browser Paywall

Render an HTML paywall for browser visitors hitting a 402:

```typescript
import { x402BrowserSupport } from '@dexterai/x402/server';

app.use(x402BrowserSupport({ theme: 'dark' }));
```

## Model Registry

Source of truth for OpenAI model pricing:

```typescript
import { MODEL_REGISTRY, estimateCost, getModel } from '@dexterai/x402/server';

const model = getModel('gpt-4o');
const cost = estimateCost('gpt-4o', 1000, 500); // input tokens, output tokens
```

## All Server Exports

| Export | Description |
|--------|-------------|
| `x402Middleware` | Express middleware for one-liner paywalls |
| `createX402Server` | Manual verify/settle server |
| `stripePayTo` | Stripe Crypto Onramp address provider |
| `x402AccessPass` | Time-limited access pass middleware |
| `x402BrowserSupport` | HTML paywall for browser 402s |
| `createDynamicPricing` | Character-based dynamic pricing |
| `createTokenPricing` | Token-based LLM pricing |
| `MODEL_REGISTRY` | OpenAI model definitions and pricing |
| `FacilitatorClient` | Direct facilitator API client |
