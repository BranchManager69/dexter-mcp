import path from 'node:path';
import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import { buildWidgetBootstrapScript } from './bootstrap.js';

const SKYBRIDGE_MIME = 'text/html+skybridge';
const APPS_SDK_DIR = path.resolve(new URL('.', import.meta.url).pathname, '../public/apps-sdk');

/**
 * Resolves the widget domain from environment or derives from MCP public URL.
 * Must be a valid HTTPS origin per OpenAI Apps SDK requirements.
 * @see https://developers.openai.com/apps-sdk/reference
 */
function resolveWidgetDomain() {
  // Explicit override takes precedence
  const explicit = process.env.TOKEN_AI_WIDGET_DOMAIN;
  if (explicit) return explicit;

  // Derive from MCP public URL
  const mcpUrl = process.env.TOKEN_AI_MCP_PUBLIC_URL;
  if (mcpUrl) {
    try {
      return new URL(mcpUrl).origin;
    } catch {}
  }

  // Fallback to production default
  return 'https://dexter.cash';
}

function rewriteHtmlForAssets(html, assetBase) {
  if (!html) return html;
  return html
    .replace(/(src|href)="\.\/assets\/([^"]+)"/g, (_, attr, file) => `${attr}="${assetBase}/${file}"`)
    .replace(/\sdata-asset-base="[^"]*"/g, '');
}

function tagEntryScript(html, entryId) {
  if (!html) return html;
  let tagged = false;
  return html.replace(/<script\s+type="module"/, (match) => {
    if (tagged) return match;
    tagged = true;
    return `${match} data-dexter-entry="${entryId}"`;
  });
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

/**
 * Builds the OpenAI widgetCSP object per Apps SDK spec.
 * This tells ChatGPT's sandbox which domains the widget may contact.
 * @see https://developers.openai.com/apps-sdk/reference#component-resource-_meta-fields
 *
 * @param {string} assetBase - Base URL for widget assets
 * @returns {{ connect_domains: string[], resource_domains: string[] }}
 */
function buildWidgetCsp(assetBase) {
  const resourceDomains = [];
  const connectDomains = [];

  // Allow fetching assets from the asset base origin
  try {
    const origin = new URL(assetBase).origin;
    if (origin) {
      resourceDomains.push(origin);
    }
  } catch {}

  // Allow connecting to the Dexter API for tool calls from widget
  const apiBase = process.env.DEXTER_API_BASE_URL;
  if (apiBase) {
    try {
      const apiOrigin = new URL(apiBase).origin;
      if (apiOrigin && apiOrigin.startsWith('https://')) {
        connectDomains.push(apiOrigin);
      }
    } catch {}
  }

  // Production API fallback
  if (!connectDomains.some(d => d.includes('dexter.cash'))) {
    connectDomains.push('https://api.dexter.cash');
  }

  // OpenAI's CDN for static assets (fonts, etc.)
  resourceDomains.push('https://*.oaistatic.com');

  return {
    connect_domains: connectDomains,
    resource_domains: resourceDomains,
  };
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

  const MCP_PUBLIC_URL = String(process.env.TOKEN_AI_MCP_PUBLIC_URL || 'http://localhost:3930/mcp').replace(/\/+$/, '');
  const assetBase = (() => {
    const raw = String(process.env.TOKEN_AI_APPS_SDK_ASSET_BASE || '').trim();
    const base = raw.length ? raw : `${MCP_PUBLIC_URL}/app-assets`;
    return base.replace(/\/+$/, '');
  })();
  if (!assetBase.startsWith('https://')) {
    console.warn('[apps-sdk] asset base is not HTTPS, skipping widget registration:', assetBase);
    return;
  }

  const widgetDomain = resolveWidgetDomain();
  const widgetCSP = buildWidgetCsp(assetBase);

  console.log('[apps-sdk] Registering widgets with domain:', widgetDomain);

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
    {
      name: 'dexter_solana_send',
      templateUri: 'ui://dexter/solana-send',
      file: 'solana-send.html',
      title: 'Dexter Solana send widget',
      description: 'Displays confirmation prompts and execution summaries for Solana transfers.',
      widgetDescription: 'Transfers SOL or SPL tokens to another wallet and shows confirmation or completion details.',
      invoking: 'Submitting transfer…',
      invoked: 'Transfer summary ready',
    },
    {
      name: 'dexter_identity_status',
      templateUri: 'ui://dexter/identity-status',
      file: 'identity-status.html',
      title: 'Dexter Identity Status widget',
      description: 'Shows ERC-8004 identity status for the current user.',
      widgetDescription: 'Displays ERC-8004 identity information including chain status and agent details.',
      invoking: 'Checking identity…',
      invoked: 'Identity status ready',
    },
    {
      name: 'dexter_reputation_badge',
      templateUri: 'ui://dexter/reputation-badge',
      file: 'reputation-badge.html',
      title: 'Dexter Reputation Badge widget',
      description: 'Displays reputation score and feedback history for an agent.',
      widgetDescription: 'Shows agent reputation including ratings, scores, and recent feedback.',
      invoking: 'Loading reputation…',
      invoked: 'Reputation loaded',
    },
    {
      name: 'dexter_bundle_card',
      templateUri: 'ui://dexter/bundle-card',
      file: 'bundle-card.html',
      title: 'Dexter Bundle Card widget',
      description: 'Displays bundle information including tools, pricing, and access status.',
      widgetDescription: 'Shows tool bundle details with pricing, included tools, and purchase status.',
      invoking: 'Loading bundle…',
      invoked: 'Bundle loaded',
    },
    {
      name: 'dexter_solana_balances',
      templateUri: 'ui://dexter/solana-balances',
      file: 'solana-balances.html',
      title: 'Dexter Solana Balances widget',
      description: 'Displays token balances with prices, 24h changes, and portfolio totals.',
      widgetDescription: 'Shows wallet token holdings with USD values, price changes, and research links.',
      invoking: 'Loading balances…',
      invoked: 'Balances ready',
    },
    {
      name: 'dexter_pumpstream',
      templateUri: 'ui://dexter/pumpstream',
      file: 'pumpstream.html',
      title: 'Dexter Pumpstream widget',
      description: 'Displays live Pump.fun streams with thumbnails, viewer counts, and momentum.',
      widgetDescription: 'Shows active Pump.fun live streams with market cap and momentum indicators.',
      invoking: 'Loading live streams…',
      invoked: 'Streams ready',
    },
    {
      name: 'dexter_search',
      templateUri: 'ui://dexter/search',
      file: 'search.html',
      title: 'Dexter Search widget',
      description: 'Displays web search results with favicons, snippets, and AI summaries.',
      widgetDescription: 'Shows search results with site icons, descriptions, and optional AI answer.',
      invoking: 'Searching…',
      invoked: 'Search complete',
    },
    {
      name: 'dexter_onchain_activity',
      templateUri: 'ui://dexter/onchain-activity',
      file: 'onchain-activity.html',
      title: 'Dexter On-Chain Activity widget',
      description: 'Displays on-chain activity analysis with volume bars, net flow, and top traders.',
      widgetDescription: 'Shows token or wallet activity with buy/sell volumes, top traders, and recent trades.',
      invoking: 'Analyzing activity…',
      invoked: 'Activity loaded',
    },
    {
      name: 'dexter_wallet_list',
      templateUri: 'ui://dexter/wallet-list',
      file: 'wallet-list.html',
      title: 'Dexter Wallet List widget',
      description: 'Displays all wallets linked to the current user account.',
      widgetDescription: 'Shows linked wallets with addresses, labels, and default wallet indicator.',
      invoking: 'Loading wallets…',
      invoked: 'Wallets loaded',
    },
    {
      name: 'dexter_wallet_auth',
      templateUri: 'ui://dexter/wallet-auth',
      file: 'wallet-auth.html',
      title: 'Dexter Wallet Auth widget',
      description: 'Displays authentication diagnostics for the current session.',
      widgetDescription: 'Shows session wallet, user ID, and auth diagnostic information.',
      invoking: 'Loading auth info…',
      invoked: 'Auth info loaded',
    },
    {
      name: 'dexter_wallet_override',
      templateUri: 'ui://dexter/wallet-override',
      file: 'wallet-override.html',
      title: 'Dexter Wallet Override widget',
      description: 'Displays session wallet override status and confirmation.',
      widgetDescription: 'Shows whether session wallet override is active, cleared, or failed.',
      invoking: 'Processing override…',
      invoked: 'Override complete',
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
          'openai/widgetDomain': widgetDomain,
          'openai/widgetCSP': widgetCSP,
          'openai/widgetDescription': entry.widgetDescription || entry.description,
          'openai/widgetPrefersBorder': true,
        },
      },
      async () => {
        const rawHtml = await fsp.readFile(assetPath, 'utf8');
        const rewritten = tagEntryScript(rewriteHtmlForAssets(rawHtml, assetBase), entry.name);
        const html = injectBootstrap(rewritten, MCP_PUBLIC_URL);

        return {
          contents: [
            {
              uri: entry.templateUri,
              text: html,
              mimeType: SKYBRIDGE_MIME,
              _meta: {
                'openai/widgetDomain': widgetDomain,
                'openai/widgetCSP': widgetCSP,
                'openai/widgetDescription': entry.widgetDescription || entry.description,
                'openai/widgetPrefersBorder': true,
              },
            },
          ],
        };
      },
    );
  }
}
