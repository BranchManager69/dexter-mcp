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
 * @param {Object} [options.extra] - Additional _meta fields to merge
 * @returns {Object} _meta object for tool definition
 */
export function createWidgetMeta({
  templateUri,
  invoking,
  invoked,
  widgetDescription,
  widgetDomain,
  extra = {},
} = {}) {
  if (!templateUri) {
    throw new Error('createWidgetMeta requires a templateUri');
  }

  const domain = widgetDomain || resolveWidgetDomain();

  const meta = {
    'openai/outputTemplate': templateUri,
    'openai/resultCanProduceWidget': true,
    'openai/widgetAccessible': true,
    'openai/widgetDomain': domain,
    'openai/widgetPrefersBorder': true,
    ...extra,
  };

  if (invoking) meta['openai/toolInvocation/invoking'] = invoking;
  if (invoked) meta['openai/toolInvocation/invoked'] = invoked;
  if (widgetDescription) meta['openai/widgetDescription'] = widgetDescription;

  return meta;
}
