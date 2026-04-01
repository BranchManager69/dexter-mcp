---
name: x402-react
description: "Add x402 payment UI to React applications using @dexterai/x402/react. Trigger when the user wants React payment hooks, x402 payment components, wallet-connected payment flows, or useX402Payment/useAccessPass integration."
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
    balances,
    connectedChains,
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
| `maxAmountAtomic` | string | Safety limit |
| `verbose` | boolean | Debug logging |
| `accessPass` | AccessPassClientConfig | Prefer time-limited passes |

### UseX402PaymentReturn

| Field | Type | Description |
|-------|------|-------------|
| `fetch` | function | x402-enabled fetch |
| `isLoading` | boolean | Payment in progress |
| `balances` | BalanceInfo[] | USDC balances per chain |
| `connectedChains` | { solana, evm } | Which chains have wallets |

## useAccessPass

Manage time-limited access passes in React:

```tsx
import { useAccessPass } from '@dexterai/x402/react';

function ProtectedContent() {
  const {
    hasPass,
    passExpiresAt,
    purchase,
    isPurchasing,
    fetchWithPass,
  } = useAccessPass({
    url: 'https://api.example.com',
    wallets: { solana: wallet },
    preferTier: '1h',
  });

  if (!hasPass) {
    return (
      <button onClick={purchase} disabled={isPurchasing}>
        {isPurchasing ? 'Purchasing...' : 'Buy 1h Access ($0.50)'}
      </button>
    );
  }

  return <div>Access until {new Date(passExpiresAt!).toLocaleTimeString()}</div>;
}
```

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

## Exports

| Export | Description |
|--------|-------------|
| `useX402Payment` | Main payment hook with fetch, loading, balances |
| `useAccessPass` | Time-limited access pass management |
| `X402Error` | Error class with `.code` |
