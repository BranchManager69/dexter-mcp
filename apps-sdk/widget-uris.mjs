import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APPS_SDK_DIR = path.join(__dirname, '..', 'public', 'apps-sdk');

function versionedWidgetUri(baseUri, fileName) {
  try {
    const html = readFileSync(path.join(APPS_SDK_DIR, fileName), 'utf8');
    const hash = createHash('sha1').update(html).digest('hex').slice(0, 8);
    return `${baseUri}-${hash}`;
  } catch {
    return baseUri;
  }
}

export const X402_WIDGET_URIS = Object.freeze({
  search: versionedWidgetUri('ui://dexter/x402-marketplace-search', 'x402-marketplace-search.html'),
  fetch: versionedWidgetUri('ui://dexter/x402-fetch-result', 'x402-fetch-result.html'),
  pricing: versionedWidgetUri('ui://dexter/x402-pricing', 'x402-pricing.html'),
  wallet: versionedWidgetUri('ui://dexter/x402-wallet', 'x402-wallet.html'),
});
