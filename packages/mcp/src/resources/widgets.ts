/**
 * MCP Apps widget resource registration.
 *
 * Registers ui:// resources for each x402 widget so MCP Apps-capable hosts
 * (Cursor, Claude Desktop, VS Code) can render interactive UI.
 *
 * Widget HTML files are bundled at build time into dist/widgets/.
 * When no bundled file exists (dev mode), falls back to a minimal
 * placeholder that displays the tool output as JSON.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const MCP_APP_MIME = "text/html;profile=mcp-app";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WIDGETS_DIR = join(__dirname, "..", "widgets");

const ASSET_CDN = "https://dexter.cash/mcp/app-assets";

interface WidgetDef {
  id: string;
  uri: string;
  name: string;
  description: string;
  file: string;
}

const WIDGET_DEFS: WidgetDef[] = [
  {
    id: "x402-marketplace-search-v2",
    uri: "ui://dexter/x402-marketplace-search-v2",
    name: "x402 Marketplace Search",
    description: "Interactive marketplace search results with quality rings, prices, and action buttons.",
    file: "x402-marketplace-search.html",
  },
  {
    id: "x402-fetch-result",
    uri: "ui://dexter/x402-fetch-result",
    name: "x402 Fetch Result",
    description: "API response viewer with payment receipt, transaction link, and settlement status.",
    file: "x402-fetch-result.html",
  },
  {
    id: "x402-pricing",
    uri: "ui://dexter/x402-pricing",
    name: "x402 Pricing",
    description: "Endpoint pricing per blockchain with payment amounts and pay button.",
    file: "x402-pricing.html",
  },
  {
    id: "x402-wallet",
    uri: "ui://dexter/x402-wallet",
    name: "x402 Wallet",
    description: "Wallet dashboard with address, USDC/SOL balances, and deposit QR code.",
    file: "x402-wallet.html",
  },
];

function loadWidgetHtml(file: string): string | null {
  try {
    let html = readFileSync(join(WIDGETS_DIR, file), "utf-8");
    html = html.replace(/(src|href)="\.\/assets\//g, `$1="${ASSET_CDN}/assets/`);
    html = html.replace(
      "</head>",
      `<script>window.__isMcpApp=true;</script>\n</head>`,
    );
    return html;
  } catch {
    return null;
  }
}

function fallbackHtml(name: string): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>${name}</title>
<style>
  body { font-family: system-ui, sans-serif; padding: 16px; margin: 0;
    background: #1a1a2e; color: #e0e0e0; }
  pre { white-space: pre-wrap; word-break: break-word; font-size: 13px;
    background: #16213e; padding: 12px; border-radius: 8px; overflow: auto; }
  h3 { margin: 0 0 8px; color: #a78bfa; font-size: 14px; }
</style></head><body>
<h3>${name}</h3>
<pre id="output">Waiting for tool output…</pre>
<script>
  window.addEventListener('message', function(e) {
    var d = e.data;
    if (!d || d.jsonrpc !== '2.0') return;
    if (d.method === 'ui/notifications/tool-result') {
      var sc = d.params && d.params.structuredContent;
      var text = d.params && d.params.content;
      var data = sc || (text && text[0] && text[0].text);
      try { data = typeof data === 'string' ? JSON.parse(data) : data; } catch(ex) {}
      document.getElementById('output').textContent = JSON.stringify(data, null, 2);
    }
  });
  window.parent.postMessage({ jsonrpc: '2.0', id: 1, method: 'ui/initialize',
    params: { protocolVersion: '2025-03-26', capabilities: {} } }, '*');
</script></body></html>`;
}

export function registerWidgetResources(server: McpServer): void {
  for (const def of WIDGET_DEFS) {
    const html = loadWidgetHtml(def.file) ?? fallbackHtml(def.name);

    server.resource(
      def.id,
      def.uri,
      {
        description: def.description,
        mimeType: MCP_APP_MIME,
      },
      async () => ({
        contents: [
          {
            uri: def.uri,
            mimeType: MCP_APP_MIME,
            text: html,
          },
        ],
      }),
    );
  }
}
