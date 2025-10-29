import path from 'node:path';
import fs from 'node:fs';
import { promises as fsp } from 'node:fs';

const SKYBRIDGE_MIME = 'text/html+skybridge';
const DEFAULT_WIDGET_DOMAIN = 'dexter-mcp';
const APPS_SDK_DIR = path.resolve(new URL('.', import.meta.url).pathname, '../public/apps-sdk');
const MCP_PUBLIC_URL = String(process.env.TOKEN_AI_MCP_PUBLIC_URL || 'http://localhost:3930/mcp');
const DEFAULT_ASSET_BASE = (() => {
  const raw = String(process.env.TOKEN_AI_APPS_SDK_ASSET_BASE || '').trim();
  const base = raw.length ? raw : `${MCP_PUBLIC_URL.replace(/\/+$/, '')}/app-assets`;
  return base.replace(/\/+$/, '');
})();
let assetOrigin = null;
try { assetOrigin = new URL(DEFAULT_ASSET_BASE).origin; } catch { assetOrigin = null; }
const scriptSources = [`'self'`, 'https://cdn.jsdelivr.net'];
const styleSources = [`'unsafe-inline'`];
if (assetOrigin) {
  scriptSources.push(assetOrigin);
  styleSources.push(assetOrigin);
}
const DEFAULT_WIDGET_CSP = `script-src ${scriptSources.join(' ')}; style-src ${styleSources.join(' ')};`;

function rewriteHtmlForAssets(html) {
  if (!html) return html;
  return html
    .replace(/(src|href)="\.\/assets\/([^"]+)"/g, (_, attr, file) => `${attr}="${DEFAULT_ASSET_BASE}/${file}"`)
    .replace(/\sdata-asset-base="[^"]*"/g, '');
}

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
      widgetCsp: DEFAULT_WIDGET_CSP,
      widgetDescription: 'Shows the wallets linked to the current Dexter session.',
    },
    {
      name: 'dexter_resolve_wallet',
      uri: 'openai://app-assets/dexter-mcp/resolve-wallet',
      file: 'resolve-wallet.html',
      title: 'Dexter resolve wallet widget',
      description: 'Shows how the active wallet was resolved for the current session.',
      widgetDomain: DEFAULT_WIDGET_DOMAIN,
      widgetCsp: DEFAULT_WIDGET_CSP,
      widgetDescription: 'Visualises which wallet is active and how it was chosen.',
    },
    {
      name: 'dexter_solana_token_lookup',
      uri: 'openai://app-assets/dexter-mcp/solana-token-lookup',
      file: 'solana-token-lookup.html',
      title: 'Dexter Solana token lookup widget',
      description: 'Displays token metadata results for Solana lookup queries.',
      widgetDomain: DEFAULT_WIDGET_DOMAIN,
      widgetCsp: DEFAULT_WIDGET_CSP,
      widgetDescription: 'Lists candidate Solana tokens with liquidity and FDV stats.',
    },
    {
      name: 'dexter_solana_swap_preview',
      uri: 'openai://app-assets/dexter-mcp/solana-swap-preview',
      file: 'solana-swap-preview.html',
      title: 'Dexter Solana swap preview widget',
      description: 'Renders swap quotes and expected output prior to execution.',
      widgetDomain: DEFAULT_WIDGET_DOMAIN,
      widgetCsp: DEFAULT_WIDGET_CSP,
      widgetDescription: 'Shows the preview quote for a Solana swap request.',
    },
    {
      name: 'dexter_solana_swap_execute',
      uri: 'openai://app-assets/dexter-mcp/solana-swap-execute',
      file: 'solana-swap-execute.html',
      title: 'Dexter Solana swap execution widget',
      description: 'Summarises executed swaps with transaction links.',
      widgetDomain: DEFAULT_WIDGET_DOMAIN,
      widgetCsp: DEFAULT_WIDGET_CSP,
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
        const text = rewriteHtmlForAssets(await fsp.readFile(assetPath, 'utf8'));
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

  // Register bundled assets (CSS/JS) so relative imports resolve in ChatGPT.
  const assetsDir = path.join(APPS_SDK_DIR, 'assets');
  if (fileExistsSync(assetsDir)) {
    const assetFiles = fs.readdirSync(assetsDir).filter((file) => /\.(js|css)$/i.test(file));
    for (const file of assetFiles) {
      const ext = path.extname(file).toLowerCase();
      const mimeType = ext === '.css' ? 'text/css' : 'application/javascript';
      const uri = `openai://app-assets/dexter-mcp/assets/${file}`;
      const absolutePath = path.join(assetsDir, file);
      server.registerResource(
        `dexter_asset_${file}`,
        uri,
        {
          title: `Dexter Apps SDK asset (${file})`,
          description: 'Supporting file for Dexter ChatGPT App components.',
          mimeType,
        },
        async () => {
          const text = await fsp.readFile(absolutePath, 'utf8');
          return {
            contents: [
              {
                uri,
                text,
                mimeType,
              },
            ],
          };
        },
      );
    }
  }
}
