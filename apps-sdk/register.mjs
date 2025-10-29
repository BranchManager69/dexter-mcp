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
          openai: {
            widgetDomain: entry.widgetDomain,
            widgetCsp: entry.widgetCsp,
          },
        },
      },
      async () => {
        const text = await fsp.readFile(assetPath, 'utf8');
        return {
          contents: [
            {
              uri: entry.uri,
              text,
            },
          ],
        };
      },
    );
  }
}
