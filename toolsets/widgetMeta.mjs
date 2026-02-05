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

/**
 * Default resource domains allowed in widget CSP for loading external images/assets.
 * These domains are added to the iframe's img-src CSP directive.
 */
const DEFAULT_RESOURCE_DOMAINS = [
  'https://cdn.dexscreener.com',      // Token logos
  'https://raw.githubusercontent.com', // Token metadata images
  'https://arweave.net',              // Decentralized storage
  'https://ipfs.io',                  // IPFS gateway
  'https://cloudflare-ipfs.com',      // Cloudflare IPFS gateway
  'https://metadata.jup.ag',          // Jupiter token metadata
  'https://tokens.jup.ag',            // Jupiter token list images
];

/**
 * Creates OpenAI Apps SDK _meta object for tool definitions.
 * This metadata tells ChatGPT how to render the widget for tool responses.
 *
 * @see https://developers.openai.com/apps-sdk/reference#tool-descriptor-parameters
 *
 * @param {Object} options
 * @param {string} options.templateUri - Resource URI for the widget template (e.g., 'ui://dexter/swap-preview')
 * @param {string} [options.invoking] - Status text shown while tool is running (max 64 chars)
 * @param {string} [options.invoked] - Status text shown after tool completes (max 64 chars)
 * @param {string} [options.widgetDescription] - Human-readable widget description
 * @param {string} [options.widgetDomain] - HTTPS origin for the widget (defaults to resolved domain)
 * @param {string[]} [options.resourceDomains] - Additional domains to allow in CSP for images/assets
 * @param {Object} [options.extra] - Additional _meta fields to merge
 * @returns {Object} _meta object for tool definition
 */
export function createWidgetMeta({
  templateUri,
  invoking,
  invoked,
  widgetDescription,
  widgetDomain,
  resourceDomains = [],
  extra = {},
} = {}) {
  if (!templateUri) {
    throw new Error('createWidgetMeta requires a templateUri');
  }

  const domain = widgetDomain || resolveWidgetDomain();
  
  // Merge default resource domains with any custom ones
  const allResourceDomains = [...new Set([...DEFAULT_RESOURCE_DOMAINS, ...resourceDomains])];

  const meta = {
    'openai/outputTemplate': templateUri,
    'openai/resultCanProduceWidget': true,
    'openai/widgetAccessible': true,
    'openai/widgetDomain': domain,
    'openai/widgetPrefersBorder': true,
    'openai/widgetCSP': {
      resource_domains: allResourceDomains,
    },
    ...extra,
  };

  if (invoking) meta['openai/toolInvocation/invoking'] = invoking;
  if (invoked) meta['openai/toolInvocation/invoked'] = invoked;
  if (widgetDescription) meta['openai/widgetDescription'] = widgetDescription;

  return meta;
}
