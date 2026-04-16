---
name: x402-server
description: "Add x402 payment protection to any API endpoint using @dexterai/x402/server. Trigger when the user wants to monetize an API, add a paywall, accept crypto payments on their server, set up Stripe settlement, configure dynamic pricing, create access passes, or enable sponsored access (ads for agents)."
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

### Multi-chain accept

Accept payments on multiple chains simultaneously:

```typescript
app.get('/api/data',
  x402Middleware({
    payTo: {
      'solana:*': 'SolanaAddress...',
      'eip155:*': '0xEvmAddress...',
    },
    amount: '0.05',
    network: ['eip155:8453', 'eip155:137', 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'],
  }),
  handler
);
```

### Full X402MiddlewareConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `payTo` | string / PayToProvider / Record | required | Recipient address, Stripe provider, or per-network map |
| `amount` | string | required | USD amount (e.g., "0.01" for 1 cent) |
| `network` | string / string[] | Solana mainnet | CAIP-2 network(s) to accept payments on |
| `asset` | { address, decimals } | USDC | Token to accept |
| `facilitatorUrl` | string | `https://x402.dexter.cash` | Facilitator for verify/settle |
| `description` | string | | Human-readable resource description |
| `resourceUrl` | string | request URL | Override resource URL |
| `mimeType` | string | | Response MIME type |
| `timeoutSeconds` | number | 120 | Payment timeout |
| `verbose` | boolean | false | Debug logging |
| `getAmount` | (req) => string | | Dynamic amount per request |
| `getDescription` | (req) => string | | Dynamic description per request |
| `getResourceUrl` | (req) => string | | Dynamic resource URL per request |
| `sponsoredAccess` | boolean / object | false | Enable ad injection into response body |
| `onSettlement` | (info) => void | | Called after successful settlement |
| `onVerifyFailed` | (info) => void | | Called when verification fails |

After payment, `req.x402` contains `{ transaction, payer, network }`.

### Sponsored Access (Ads for Agents)

Inject sponsored recommendations into your API responses after settlement:

```typescript
// Default injection — adds _x402_sponsored field to response body
x402Middleware({ payTo: '...', amount: '0.05', sponsoredAccess: true })

// Custom injection
x402Middleware({
  payTo: '...', amount: '0.05',
  sponsoredAccess: {
    inject: (body, recs) => ({ ...body, related_tools: recs }),
    onMatch: (recs, settlement) => console.log(`Matched ${recs.length} sponsors`),
  }
})
```

### Settlement callbacks

```typescript
x402Middleware({
  payTo: '...', amount: '0.01',
  onSettlement: (info) => {
    console.log(`Paid: ${info.transaction} from ${info.payer} on ${info.network}`);
  },
  onVerifyFailed: (info) => {
    console.warn(`Verify failed: ${info.reason} for ${info.resourceUrl}`);
  },
})
```

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

### Multi-chain with Stripe fallback

```typescript
x402Middleware({
  payTo: {
    'eip155:8453': stripePayTo(process.env.STRIPE_SECRET_KEY!),
    '*': 'YourDirectAddress...',
  },
  amount: '0.05',
  network: ['eip155:8453', 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'],
})
```

## Access Passes

Pay once for time-limited unlimited access:

```typescript
import { x402AccessPass } from '@dexterai/x402/server';

app.use('/api',
  x402AccessPass({
    payTo: 'YourAddress...',
    tiers: {
      '5m': '0.10',   // 5 minutes for $0.10
      '1h': '0.50',   // 1 hour for $0.50
      '24h': '2.00',  // 24 hours for $2.00
      '7d': '10.00',  // 7 days for $10.00
    },
  })
);
```

### X402AccessPassConfig

| Option | Type | Description |
|--------|------|-------------|
| `payTo` | string | Recipient address |
| `tiers` | Record<string, string> | Tier IDs → USD prices. Duration parsed from key (5m, 1h, 24h, 7d). |
| `ratePerHour` | string | USD rate per hour for custom durations via `?duration=<seconds>` |
| `secret` | Buffer | HMAC secret for JWT signing (auto-generated if omitted) |
| `issuer` | string | JWT `iss` claim (default `x402-access-pass`) |
| `network` | string | CAIP-2 network (default Solana mainnet) |
| `asset` | { address, decimals } | Token to accept (default USDC) |
| `facilitatorUrl` | string | Facilitator URL |
| `verbose` | boolean | Debug logging |
| `description` | string | Description shown in 402 response |

Clients receive a JWT in the `ACCESS-PASS` header and send it as `Authorization: Bearer <jwt>` on subsequent requests.

## Dynamic Pricing

### Character-based

```typescript
import { createDynamicPricing, formatPricing } from '@dexterai/x402/server';

const pricing = createDynamicPricing({
  basePrice: 0.001,
  perCharacter: 0.00001,
});

app.post('/api/generate', async (req, res) => {
  const quote = pricing.getQuote(req.body.prompt);
  // Use quote.amountAtomic in x402Middleware or manual flow
});

console.log(formatPricing(pricing)); // Human-readable pricing summary
```

### Token-based (LLM-accurate with tiktoken)

```typescript
import { createTokenPricing, countTokens, formatTokenPricing } from '@dexterai/x402/server';

const pricing = createTokenPricing({ model: 'gpt-4o' });
const quote = pricing.getQuote({ inputText: prompt, estimatedOutputTokens: 500 });

// Utility functions
const tokens = await countTokens(prompt, 'gpt-4o');
console.log(formatTokenPricing('gpt-4o')); // Pricing summary
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
import {
  MODEL_REGISTRY,
  getModel,
  findModel,
  estimateCost,
  getModelsByTier,
  getActiveModels,
  getCheapestModel,
  formatModelPricing,
} from '@dexterai/x402/server';

const model = getModel('gpt-4o');           // throws if not found
const maybe = findModel('gpt-4o');          // returns undefined if not found
const cost = estimateCost('gpt-4o', 1000, 500); // input tokens, output tokens
const fast = getModelsByTier('fast');        // all fast-tier models
const active = getActiveModels();           // non-deprecated models
const cheap = getCheapestModel('standard'); // cheapest at standard tier or above
console.log(formatModelPricing('gpt-4o'));  // human-readable pricing
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
| `formatPricing` | Format dynamic pricing as human-readable string |
| `createTokenPricing` | Token-based LLM pricing |
| `countTokens` | Count tokens for a given text and model |
| `formatTokenPricing` | Format token pricing as human-readable string |
| `getAvailableModels` | List all models with pricing info |
| `isValidModel` | Check if a model ID is recognized |
| `MODEL_PRICING` | Raw model pricing data |
| `MODEL_REGISTRY` | Full model definitions array |
| `MODEL_PRICING_MAP` | Model pricing lookup by ID |
| `getModel` | Get model definition (throws if not found) |
| `findModel` | Get model definition (returns undefined if not found) |
| `estimateCost` | Estimate cost for input/output tokens |
| `formatModelPricing` | Format model pricing as string |
| `isValidModelId` | Check if a model ID exists in registry |
| `getAvailableModelIds` | List all model IDs |
| `getModelsByTier` | Filter models by tier (fast/standard/flagship) |
| `getModelsByFamily` | Filter models by family (gpt-4o, o1, etc.) |
| `getActiveModels` | Get non-deprecated models |
| `getTextModels` | Get text-capable models |
| `getCheapestModel` | Get cheapest model at or above a tier |
| `FacilitatorClient` | Direct facilitator API client |
| `DEXTER_FACILITATOR_URL` | `https://x402.dexter.cash` |
| `SOLANA_MAINNET_NETWORK` | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` |
| `BASE_MAINNET_NETWORK` | `eip155:8453` |
| `USDC_MINT` | Solana USDC mint address |
| `USDC_BASE` | Base USDC contract address |
