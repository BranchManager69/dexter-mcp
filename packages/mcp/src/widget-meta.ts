import { X402_WIDGET_URIS } from "./widget-uris.js";

const WIDGET_DOMAIN = "https://dexter.cash";

const WIDGET_CSP = {
  resource_domains: [
    "https://cdn.dexscreener.com",
    "https://raw.githubusercontent.com",
    "https://metadata.jup.ag",
  ],
};

export function widgetMeta(templateUri: string, invoking: string, invoked: string, description: string) {
  return {
    // MCP Apps standard (Cursor, Claude Desktop, VS Code)
    ui: {
      resourceUri: templateUri,
      visibility: ["model", "app"] as const,
    },
    // ChatGPT Apps SDK (OpenAI-specific)
    "openai/outputTemplate": templateUri,
    "openai/resultCanProduceWidget": true,
    "openai/widgetAccessible": true,
    "openai/widgetDomain": WIDGET_DOMAIN,
    "openai/widgetPrefersBorder": true,
    "openai/widgetCSP": WIDGET_CSP,
    "openai/toolInvocation/invoking": invoking,
    "openai/toolInvocation/invoked": invoked,
    "openai/widgetDescription": description,
  };
}

export const SEARCH_META = widgetMeta(
  X402_WIDGET_URIS.search,
  "Searching marketplace\u2026",
  "Results ready",
  "Shows paid API search results as interactive cards with quality rings, prices, and fetch buttons.",
);

export const FETCH_META = widgetMeta(
  X402_WIDGET_URIS.fetch,
  "Calling API\u2026",
  "Response received",
  "Shows API response data with payment receipt, transaction link, and settlement status.",
);

export const CHECK_META = widgetMeta(
  X402_WIDGET_URIS.pricing,
  "Checking pricing\u2026",
  "Pricing loaded",
  "Shows endpoint pricing per blockchain with payment amounts and a pay button.",
);

export const WALLET_META = widgetMeta(
  X402_WIDGET_URIS.wallet,
  "Loading wallet\u2026",
  "Wallet loaded",
  "Shows wallet address with copy button, USDC/SOL balances, and deposit QR code.",
);
