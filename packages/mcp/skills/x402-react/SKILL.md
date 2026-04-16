---
name: x402-react
description: "Add x402 payment UI to React applications using @dexterai/x402/react. Trigger when the user wants React payment hooks, x402 payment components, wallet-connected payment flows, useX402Payment/useAccessPass integration, or sponsored access recommendations in React."
---

# @dexterai/x402 React Hooks

React hooks for x402 v2 payments. Works with Solana wallet adapters and wagmi/viem for EVM.

```bash
npm install @dexterai/x402 @solana/wallet-adapter-react
```

## useX402Payment

Main hook for payment-enabled fetch with wallet state:

```tsx
import { useX402Payment } from '@dexterai/x402/react';
import { useWallet } from '@solana/wallet-adapter-react';

function PayButton() {
  const solanaWallet = useWallet();

  const {
    fetch: x402Fetch,
    isLoading,
    status,
    error,
    balances,
    connectedChains,
    transactionUrl,
    sponsoredRecommendations,
  } = useX402Payment({
    wallets: { solana: solanaWallet },
  });

  return (
    <div>
      <p>Solana: {connectedChains.solana ? 'Connected' : 'Disconnected'}</p>
      {balances.map(b => (
        <p key={b.network}>{b.chainName}: ${b.balance.toFixed(2)} {b.asset}</p>
      ))}
      <button
        onClick={async () => {
          const res = await x402Fetch('https://api.example.com/paid-data');
          const data = await res.json();
          console.log(data);
        }}
        disabled={isLoading}
      >
        {isLoading ? 'Paying...' : 'Get Data ($0.01)'}
      </button>
      {status === 'error' && <p>Error: {error?.message}</p>}
      {transactionUrl && <a href={transactionUrl}>View tx</a>}
      {sponsoredRecommendations?.map(r => (
        <p key={r.resourceUrl}>{r.sponsor}: {r.description}</p>
      ))}
    </div>
  );
}
```

### Multi-chain with wagmi

```tsx
import { useX402Payment } from '@dexterai/x402/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAccount } from 'wagmi';

function MultiChainPay() {
  const solanaWallet = useWallet();
  const evmAccount = useAccount();

  const { fetch: x402Fetch, connectedChains, balances } = useX402Payment({
    wallets: {
      solana: solanaWallet,
      evm: evmAccount,
    },
    preferredNetwork: 'eip155:8453', // Prefer Base
  });

  // ...
}
```

### UseX402PaymentConfig

| Option | Type | Description |
|--------|------|-------------|
| `wallets` | { solana?, evm? } | Wallet instances per chain |
| `preferredNetwork` | string | CAIP-2 network to prefer |
| `rpcUrls` | Record<string, string> | Custom RPC URLs |
| `verbose` | boolean | Debug logging |

### UseX402PaymentReturn

| Field | Type | Description |
|-------|------|-------------|
| `fetch` | function | x402-enabled fetch (same signature as global fetch) |
| `isLoading` | boolean | Payment in progress |
| `status` | PaymentStatus | `'idle'` / `'pending'` / `'success'` / `'error'` |
| `error` | Error \| null | Error from last payment attempt |
| `transactionId` | string \| null | Transaction hash on success |
| `transactionNetwork` | string \| null | CAIP-2 network the payment was made on |
| `transactionUrl` | string \| null | Explorer URL for the transaction |
| `balances` | BalanceInfo[] | USDC balances per chain |
| `connectedChains` | { solana, evm } | Which chains have wallets |
| `isAnyWalletConnected` | boolean | True if at least one wallet connected |
| `reset` | () => void | Clear errors and transaction info |
| `refreshBalances` | () => Promise<void> | Manually refresh balances |
| `accessPass` | object \| null | Access pass state (use `useAccessPass` for full control) |
| `sponsoredRecommendations` | SponsoredRecommendation[] \| null | Sponsored recs from most recent payment |

## useAccessPass

Manage time-limited access passes with tier discovery and purchase:

```tsx
import { useAccessPass } from '@dexterai/x402/react';

function DataDashboard() {
  const {
    tiers,
    pass,
    isPassValid,
    purchasePass,
    isPurchasing,
    purchaseError,
    fetch: apFetch,
  } = useAccessPass({
    wallets: { solana: solanaWallet },
    resourceUrl: 'https://api.example.com',
  });

  return (
    <div>
      {!isPassValid && tiers && (
        <div>
          {tiers.map(t => (
            <button key={t.id} onClick={() => purchasePass(t.id)} disabled={isPurchasing}>
              {t.label} — ${t.price}
            </button>
          ))}
        </div>
      )}
      {isPassValid && <p>Pass active! Expires: {pass?.expiresAt}</p>}
      {purchaseError && <p>Error: {purchaseError.message}</p>}
      <button onClick={() => apFetch('/api/data').then(r => r.json()).then(console.log)}>
        Fetch Data
      </button>
    </div>
  );
}
```

### UseAccessPassConfig

| Option | Type | Description |
|--------|------|-------------|
| `wallets` | { solana?, evm? } | Wallet instances per chain |
| `preferredNetwork` | string | CAIP-2 network to prefer |
| `rpcUrls` | Record<string, string> | Custom RPC URLs |
| `resourceUrl` | string | Base URL of the x402 resource (required) |
| `autoConnect` | boolean | Auto-fetch tier info on mount (default true) |
| `verbose` | boolean | Debug logging |

### UseAccessPassReturn

| Field | Type | Description |
|-------|------|-------------|
| `tiers` | AccessPassTier[] \| null | Available tiers from the server (null until fetched) |
| `customRatePerHour` | string \| null | Per-hour rate for custom durations (if server supports it) |
| `isLoadingTiers` | boolean | Whether tier info is being loaded |
| `pass` | object \| null | Current pass: `{ jwt, tier, expiresAt, remainingSeconds }` |
| `isPassValid` | boolean | Whether the current pass is valid and not expired |
| `fetchTiers` | () => Promise<void> | Manually fetch tier info from server |
| `purchasePass` | (tier?, durationSeconds?) => Promise<void> | Purchase a pass for a tier or custom duration |
| `isPurchasing` | boolean | Whether a purchase is in progress |
| `purchaseError` | Error \| null | Error from last purchase attempt |
| `fetch` | (path, init?) => Promise<Response> | Fetch with automatic pass inclusion |

Pass JWTs are stored in `sessionStorage` (cleared on browser close). The server re-verifies the JWT signature on every request.

## Wallet Provider Setup

Wrap your app with the appropriate wallet providers:

```tsx
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WagmiConfig } from 'wagmi';

function App() {
  return (
    <ConnectionProvider endpoint="https://api.mainnet-beta.solana.com">
      <WalletProvider wallets={[new PhantomWalletAdapter()]}>
        <WagmiConfig config={wagmiConfig}>
          <YourApp />
        </WagmiConfig>
      </WalletProvider>
    </ConnectionProvider>
  );
}
```

## Sponsored Access in React

Sponsored recommendations are automatically extracted after each payment:

```tsx
const { fetch, sponsoredRecommendations } = useX402Payment({ wallets });

// After a successful payment, sponsoredRecommendations is populated
// Impression beacons are fired automatically by the hook
```

For manual control, import the helpers directly:

```tsx
import { getSponsoredRecommendations, fireImpressionBeacon } from '@dexterai/x402/react';
```

## Exports

| Export | Description |
|--------|-------------|
| `useX402Payment` | Main payment hook with fetch, loading, balances, tx info |
| `useAccessPass` | Access pass lifecycle: tiers, purchase, validation, auto-fetch |
| `getSponsoredRecommendations` | Extract sponsored recs from payment response |
| `fireImpressionBeacon` | Confirm sponsored rec delivery to ad network |
| `X402Error` | Error class with `.code` |
