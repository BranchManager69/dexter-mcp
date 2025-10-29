import path from 'node:path';
import fs from 'node:fs';
import { promises as fsp } from 'node:fs';

const SKYBRIDGE_MIME = 'text/html+skybridge';
const DEFAULT_WIDGET_DOMAIN = 'dexter-mcp';
const APPS_SDK_DIR = path.resolve(new URL('.', import.meta.url).pathname, '../public/apps-sdk');

function isAppsSdkEnabled() {
  const raw = String(process.env.TOKEN_AI_ENABLE_APPS_SDK || '1').toLowerCase();
  return !['0', 'false', 'no', 'off'].includes(raw);
}

function fileExistsSync(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export function registerAppsSdkResources(server, options = {}) {
  if (!server || typeof server.registerResource !== 'function') return;
  if (!isAppsSdkEnabled()) return;

  const entries = [
    {
      name: 'dexter_portfolio_status',
      uri: 'openai://app-assets/dexter-mcp/portfolio-status',
      file: 'portfolio-status.html',
      title: 'Dexter portfolio widget',
      description: 'ChatGPT App SDK component for displaying managed wallet summaries.',
      widgetDomain: DEFAULT_WIDGET_DOMAIN,
      widgetCsp: "script-src 'self' https://cdn.jsdelivr.net; style-src 'unsafe-inline';",
      widgetDescription: 'Shows the wallets linked to the current Dexter session.',
    },
    {
      name: 'dexter_resolve_wallet',
      uri: 'openai://app-assets/dexter-mcp/resolve-wallet',
      file: 'resolve-wallet.html',
      title: 'Dexter resolve wallet widget',
      description: 'Shows how the active wallet was resolved for the current session.',
      widgetDomain: DEFAULT_WIDGET_DOMAIN,
      widgetCsp: "script-src 'self' https://cdn.jsdelivr.net; style-src 'unsafe-inline';",
      widgetDescription: 'Visualises which wallet is active and how it was chosen.',
    },
    {
      name: 'dexter_solana_token_lookup',
      uri: 'openai://app-assets/dexter-mcp/solana-token-lookup',
      file: 'solana-token-lookup.html',
      title: 'Dexter Solana token lookup widget',
      description: 'Displays token metadata results for Solana lookup queries.',
      widgetDomain: DEFAULT_WIDGET_DOMAIN,
      widgetCsp: "script-src 'self' https://cdn.jsdelivr.net; style-src 'unsafe-inline';",
      widgetDescription: 'Lists candidate Solana tokens with liquidity and FDV stats.',
    },
    {
      name: 'dexter_solana_swap_preview',
      uri: 'openai://app-assets/dexter-mcp/solana-swap-preview',
      file: 'solana-swap.html',
      title: 'Dexter Solana swap preview widget',
      description: 'Renders swap quotes and expected output prior to execution.',
      widgetDomain: DEFAULT_WIDGET_DOMAIN,
      widgetCsp: "script-src 'self' https://cdn.jsdelivr.net; style-src 'unsafe-inline';",
      widgetDescription: 'Shows the preview quote for a Solana swap request.',
    },
    {
      name: 'dexter_solana_swap_execute',
      uri: 'openai://app-assets/dexter-mcp/solana-swap-execute',
      file: 'solana-swap.html',
      title: 'Dexter Solana swap execution widget',
      description: 'Summarises executed swaps with transaction links.',
      widgetDomain: DEFAULT_WIDGET_DOMAIN,
      widgetCsp: "script-src 'self' https://cdn.jsdelivr.net; style-src 'unsafe-inline';",
      widgetDescription: 'Summarises the executed Solana swap and links to Solscan.',
    },
  ];

  for (const entry of entries) {
    const assetPath = path.join(APPS_SDK_DIR, entry.file);
    const available = fileExistsSync(assetPath);
    if (!available) {
      console.warn('[apps-sdk] missing asset', assetPath);
      continue;
    }

    server.registerResource(
      entry.name,
      entry.uri,
      {
        title: entry.title,
        description: entry.description,
        mimeType: SKYBRIDGE_MIME,
        _meta: {
          'openai/widgetDomain': entry.widgetDomain,
          'openai/widgetCsp': entry.widgetCsp,
          'openai/widgetDescription': entry.widgetDescription || entry.description,
        },
      },
      async () => {
        const text = await fsp.readFile(assetPath, 'utf8');
        return {
          contents: [
            {
              uri: entry.uri,
              text,
              mimeType: SKYBRIDGE_MIME,
              _meta: {
                'openai/widgetDomain': entry.widgetDomain,
                'openai/widgetCsp': entry.widgetCsp,
                'openai/widgetDescription': entry.widgetDescription || entry.description,
              },
            },
          ],
        };
      },
    );
  }
}
