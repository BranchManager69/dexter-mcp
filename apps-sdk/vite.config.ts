import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const rootDir = path.resolve(__dirname, 'ui');

export default defineConfig({
  root: rootDir,
  base: './',
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, '../public/apps-sdk'),
    emptyOutDir: true,
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        'portfolio-status': path.resolve(rootDir, 'portfolio-status.html'),
        'resolve-wallet': path.resolve(rootDir, 'resolve-wallet.html'),
        'solana-token-lookup': path.resolve(rootDir, 'solana-token-lookup.html'),
        'solana-swap-preview': path.resolve(rootDir, 'solana-swap-preview.html'),
        'solana-swap-execute': path.resolve(rootDir, 'solana-swap-execute.html'),
        'solana-send': path.resolve(rootDir, 'solana-send.html'),
        'identity-status': path.resolve(rootDir, 'identity-status.html'),
        'reputation-badge': path.resolve(rootDir, 'reputation-badge.html'),
        'bundle-card': path.resolve(rootDir, 'bundle-card.html'),
        'solana-balances': path.resolve(rootDir, 'solana-balances.html'),
        'pumpstream': path.resolve(rootDir, 'pumpstream.html'),
        'search': path.resolve(rootDir, 'search.html'),
        'onchain-activity': path.resolve(rootDir, 'onchain-activity.html'),
        'wallet-list': path.resolve(rootDir, 'wallet-list.html'),
        'wallet-auth': path.resolve(rootDir, 'wallet-auth.html'),
        'wallet-override': path.resolve(rootDir, 'wallet-override.html'),
        'hyperliquid': path.resolve(rootDir, 'hyperliquid.html'),
        'codex': path.resolve(rootDir, 'codex.html'),
        'studio': path.resolve(rootDir, 'studio.html'),
        'pokedexter': path.resolve(rootDir, 'pokedexter.html'),
      },
    },
  },
});
