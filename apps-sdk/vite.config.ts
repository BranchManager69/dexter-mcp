import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const rootDir = path.resolve(__dirname, 'ui');

const BASE_URI = 'openai://app-assets/dexter-mcp/';

export default defineConfig({
  root: rootDir,
  base: BASE_URI,
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
      },
    },
  },
});
