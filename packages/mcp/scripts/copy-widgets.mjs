#!/usr/bin/env node
/**
 * Post-build: copy the 4 x402 widget HTML files from the apps-sdk build
 * into dist/widgets/ so they ship inside the @dexterai/opendexter package.
 *
 * These are served as MCP Apps ui:// resources at runtime.
 */

import { cpSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APPS_SDK_BUILD = join(__dirname, '..', '..', '..', 'public', 'apps-sdk');
const DEST = join(__dirname, '..', 'dist', 'widgets');

const WIDGETS = [
  'x402-marketplace-search.html',
  'x402-fetch-result.html',
  'x402-pricing.html',
  'x402-wallet.html',
];

mkdirSync(DEST, { recursive: true });

let copied = 0;
for (const file of WIDGETS) {
  const src = join(APPS_SDK_BUILD, file);
  if (existsSync(src)) {
    cpSync(src, join(DEST, file));
    copied++;
    console.log(`  ✓ ${file}`);
  } else {
    console.warn(`  ⚠ ${file} not found at ${src} (widget will use fallback renderer)`);
  }
}

console.log(`\nCopied ${copied}/${WIDGETS.length} widget HTML files to dist/widgets/`);
