import path from 'node:path';
import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import { buildWidgetBootstrapScript } from './bootstrap.js';

const SKYBRIDGE_MIME = 'text/html+skybridge';
const DEFAULT_WIDGET_DOMAIN = 'dexter-mcp';
const APPS_SDK_DIR = path.resolve(new URL('.', import.meta.url).pathname, '../public/apps-sdk');
const MCP_PUBLIC_URL = String(process.env.TOKEN_AI_MCP_PUBLIC_URL || 'http://localhost:3930/mcp').replace(/\/+$/, '');
const DEFAULT_ASSET_BASE = (() => {
  const raw = String(process.env.TOKEN_AI_APPS_SDK_ASSET_BASE || '').trim();
  const base = raw.length ? raw : `${MCP_PUBLIC_URL}/app-assets`;
  return base.replace(/\/+$/, '');
})();

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

function buildWidgetCsp() {
  const extraOrigins = [];
  try {
    const origin = new URL(DEFAULT_ASSET_BASE).origin;
    if (origin) {
      extraOrigins.push(origin);
    }
  } catch {}

  const scriptSources = [`'self'`, `'unsafe-inline'`, ...extraOrigins];
  const styleSources = [`'self'`, `'unsafe-inline'`, ...extraOrigins];

  return `script-src ${scriptSources.join(' ')}; style-src ${styleSources.join(' ')}`;
}

function injectBootstrap(html, baseHref) {
  const normalizedBase = baseHref.endsWith('/') ? baseHref : `${baseHref}/`;
  const baseTag = `<base href="${normalizedBase}">`;
  const bootstrapScript = buildWidgetBootstrapScript(normalizedBase);

  if (html.includes('<head>')) {
    return html.replace('<head>', `<head>\n${baseTag}\n${bootstrapScript}\n`);
  }

  return `${baseTag}\n${bootstrapScript}\n${html}`;
}

export function registerAppsSdkResources(server) {
  if (!server || typeof server.registerResource !== 'function') return;
  if (!isAppsSdkEnabled()) return;

  const widgetCsp = buildWidgetCsp();

  const entries = [
    {
      name: 'dexter_portfolio_status',
      templateUri: 'ui://dexter/portfolio-status',
      file: 'portfolio-status.html',
      title: 'Dexter portfolio widget',
      description: 'ChatGPT App SDK component for displaying managed wallet summaries.',
      widgetDescription: 'Shows the wallets linked to the current Dexter session.',
      invoking: 'Loading wallet overview…',
      invoked: 'Wallet overview ready',
    },
    {
      name: 'dexter_resolve_wallet',
      templateUri: 'ui://dexter/resolve-wallet',
      file: 'resolve-wallet.html',
      title: 'Dexter resolve wallet widget',
      description: 'Shows how the active wallet was resolved for the current session.',
      widgetDescription: 'Visualises which wallet is active and how it was chosen.',
      invoking: 'Resolving wallet…',
      invoked: 'Wallet resolved',
    },
    {
      name: 'dexter_solana_token_lookup',
      templateUri: 'ui://dexter/solana-token-lookup',
      file: 'solana-token-lookup.html',
      title: 'Dexter Solana token lookup widget',
      description: 'Displays token metadata results for Solana lookup queries.',
      widgetDescription: 'Lists candidate Solana tokens with liquidity and FDV stats.',
      invoking: 'Searching tokens…',
      invoked: 'Token results ready',
    },
    {
      name: 'dexter_solana_swap_preview',
      templateUri: 'ui://dexter/solana-swap-preview',
      file: 'solana-swap-preview.html',
      title: 'Dexter Solana swap preview widget',
      description: 'Renders swap quotes and expected output prior to execution.',
      widgetDescription: 'Shows the preview quote for a Solana swap request.',
      invoking: 'Building swap preview…',
      invoked: 'Swap preview ready',
    },
    {
      name: 'dexter_solana_swap_execute',
      templateUri: 'ui://dexter/solana-swap-execute',
      file: 'solana-swap-execute.html',
      title: 'Dexter Solana swap execution widget',
      description: 'Summarises executed swaps with transaction links.',
      widgetDescription: 'Summarises the executed Solana swap and links to Solscan.',
      invoking: 'Finalising swap…',
      invoked: 'Swap executed',
    },
  ];

  for (const entry of entries) {
    const assetPath = path.join(APPS_SDK_DIR, entry.file);
    if (!fileExistsSync(assetPath)) {
      console.warn('[apps-sdk] missing asset', assetPath);
      continue;
    }

    server.registerResource(
      entry.name,
      entry.templateUri,
      {
        title: entry.title,
        description: entry.description,
        mimeType: SKYBRIDGE_MIME,
        _meta: {
          'openai/widgetDomain': DEFAULT_WIDGET_DOMAIN,
          'openai/widgetCsp': widgetCsp,
          'openai/widgetDescription': entry.widgetDescription || entry.description,
        },
      },
      async () => {
        const rawHtml = await fsp.readFile(assetPath, 'utf8');
        const rewritten = rewriteHtmlForAssets(rawHtml);
        const html = injectBootstrap(rewritten, MCP_PUBLIC_URL);

        return {
          contents: [
            {
              uri: entry.templateUri,
              text: html,
              mimeType: SKYBRIDGE_MIME,
              _meta: {
                'openai/widgetDomain': DEFAULT_WIDGET_DOMAIN,
                'openai/widgetCsp': widgetCsp,
                'openai/widgetDescription': entry.widgetDescription || entry.description,
              },
            },
          ],
        };
      },
    );
  }
}
