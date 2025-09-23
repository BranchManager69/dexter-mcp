#!/usr/bin/env node
// Dual-mode harness helper: UI (Playwright) + API (direct MCP) to validate pumpstream pagination.

import path from 'node:path';
import process from 'node:process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const { runHarness } = require('../../dexter-agents/scripts/runHarness.js');

// Auto-load repo .env so HARNESS_* values can be defined once.
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

function resolveOutputDir(raw) {
  const defaultDir = path.resolve(process.cwd(), 'harness-results');
  if (!raw || typeof raw !== 'string') return defaultDir;
  const trimmed = raw.trim();
  // Never allow a literal tilde path; it can lead to dangerous shell deletions.
  if (trimmed === '~' || trimmed === '~/' || trimmed.startsWith('~/') || trimmed === '~\\' || trimmed.startsWith('~\\')) {
    process.stderr.write('HARNESS_OUTPUT_DIR starting with "~" is unsafe; using default harness-results/ instead.\n');
    return defaultDir;
  }
  // Resolve relative/absolute safely
  return path.resolve(trimmed);
}

function parseArgs(argv) {
  const args = {
    prompt: null,
    url: null,
    wait: null,
    headful: false,
    artifact: true,
    json: false,
    mode: 'both',
    pageSize: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--prompt' || arg === '-p') {
      args.prompt = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--url' || arg === '-u') {
      args.url = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--wait' || arg === '-w') {
      args.wait = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === '--headful') {
      args.headful = true;
      continue;
    }
    if (arg === '--no-artifact') {
      args.artifact = false;
      continue;
    }
    if (arg === '--json') {
      args.json = true;
      continue;
    }
    if (arg === '--mode') {
      const next = (argv[i + 1] || '').toLowerCase();
      if (next === 'ui' || next === 'api' || next === 'both') {
        args.mode = next;
        i += 1;
      }
      continue;
    }
    if (arg === '--page-size') {
      args.pageSize = Number(argv[i + 1]);
      i += 1;
      continue;
    }
  }
  return args;
}

function resolvePrompt(cliPrompt) {
  if (cliPrompt && cliPrompt.trim()) return cliPrompt.trim();
  if (process.env.HARNESS_PROMPT && process.env.HARNESS_PROMPT.trim()) {
    return process.env.HARNESS_PROMPT.trim();
  }
  return 'Give me the latest pumpstream summary. Use page size 5 and fetch the next page if more streams are available.';
}

function resolveUrl(cliUrl) {
  if (cliUrl && cliUrl.trim()) return cliUrl.trim();
  if (process.env.HARNESS_TARGET_URL && process.env.HARNESS_TARGET_URL.trim()) {
    return process.env.HARNESS_TARGET_URL.trim();
  }
  return 'https://beta.dexter.cash/';
}

function resolveWait(cliWait) {
  if (Number.isFinite(cliWait) && cliWait > 0) return cliWait;
  const envWait = Number(process.env.HARNESS_WAIT_MS);
  if (Number.isFinite(envWait) && envWait > 0) return envWait;
  return 45000;
}

function resolvePageSize(cliSize) {
  if (Number.isFinite(cliSize) && cliSize > 0) return cliSize;
  const envSize = Number(process.env.HARNESS_PAGE_SIZE);
  if (Number.isFinite(envSize) && envSize > 0) return envSize;
  return 5;
}

async function runUiHarness({ prompt, targetUrl, waitMs, headless, saveArtifact, outputDir }) {
  const options = {
    prompt,
    targetUrl,
    waitMs,
    headless,
    saveArtifact,
    outputDir,
  };

  const storageStatePath = typeof process.env.HARNESS_STORAGE_STATE === 'string'
    ? process.env.HARNESS_STORAGE_STATE.trim()
    : '';
  if (storageStatePath) {
    options.storageState = storageStatePath;
    process.stdout.write(`Using HARNESS_STORAGE_STATE: ${storageStatePath}\n`);
  }

  const { artifact, artifactPath } = await runHarness(options);
  if (artifactPath) {
    process.stdout.write(`Saved artifact: ${artifactPath}\n`);
  } else if (saveArtifact) {
    process.stdout.write('Run completed without writing an artifact.\n');
  }
  return artifact;
}

async function fetchJson(url, { method = 'GET', headers = {}, body, signal } = {}) {
  const response = await fetch(url, {
    method,
    headers,
    body,
    signal,
  });
  const text = await response.text();
  if (!response.ok) {
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {}
    const error = new Error(`HTTP ${response.status} ${response.statusText}`);
    error.status = response.status;
    error.body = parsed || text;
    throw error;
  }
  return text ? JSON.parse(text) : null;
}

async function createRealtimeSession({ supabaseToken }) {
  const payload = supabaseToken
    ? { supabaseAccessToken: supabaseToken }
    : {
        guestProfile: {
          label: 'Dexter Demo Wallet',
          instructions:
            'Operate using the shared Dexter demo wallet with limited funds. Disable irreversible actions when possible and direct the user to sign in for full access.',
        },
      };
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (process.env.HARNESS_AUTHORIZATION && process.env.HARNESS_AUTHORIZATION.trim()) {
    headers.set('Authorization', process.env.HARNESS_AUTHORIZATION.trim());
  }
  if (process.env.HARNESS_COOKIE && process.env.HARNESS_COOKIE.trim()) {
    headers.set('cookie', process.env.HARNESS_COOKIE.trim());
  }
  const session = await fetchJson(process.env.HARNESS_SESSION_URL || 'https://api.dexter.cash/realtime/sessions', {
    method: 'POST',
    headers: Object.fromEntries(headers.entries()),
    body: JSON.stringify(payload),
  });
  if (!session?.client_secret?.value) {
    throw new Error('Realtime session response missing client_secret');
}
  return session;
}

function buildSupabaseToken() {
  if (process.env.HARNESS_AUTHORIZATION && process.env.HARNESS_AUTHORIZATION.trim()) {
    const val = process.env.HARNESS_AUTHORIZATION.trim();
    const prefix = 'Bearer ';
    return val.startsWith(prefix) ? val.slice(prefix.length) : val;
  }
  if (process.env.HARNESS_COOKIE && process.env.HARNESS_COOKIE.includes('sb-')) {
    try {
      const match = process.env.HARNESS_COOKIE.match(/sb-[^=]+=([^;]+)/);
      if (match && match[1]) {
        const decoded = decodeURIComponent(match[1]);
        const arr = JSON.parse(decoded);
        if (Array.isArray(arr) && typeof arr[0] === 'string') return arr[0];
      }
    } catch {}
  }
  return null;
}

async function callMcpTool({ session, pageSize }) {
  const mcp = Array.isArray(session?.tools) ? session.tools.find((t) => t.type === 'mcp') : null;
  if (!mcp?.server_url) throw new Error('Session missing MCP connector info');

  const fallbackUrl = process.env.HARNESS_MCP_URL || 'https://mcp.dexter.cash/mcp';
  const serverUrl = typeof mcp.server_url === 'string' && !mcp.server_url.includes('<redacted>')
    ? mcp.server_url
    : fallbackUrl;

  const headers = new Headers({
    'Content-Type': 'application/json',
    Accept: 'application/json',
  });
  if (mcp?.headers && typeof mcp.headers === 'object') {
    for (const [key, value] of Object.entries(mcp.headers)) {
      if (typeof value === 'string') headers.set(key, value);
    }
  }
  const authHeader = headers.get('Authorization');
  if (!authHeader || authHeader.includes('<redacted>')) {
    const fallbackToken = process.env.HARNESS_MCP_TOKEN || process.env.TOKEN_AI_MCP_TOKEN;
    if (!fallbackToken) {
      console.warn('No MCP bearer supplied (HARNESS_MCP_TOKEN / TOKEN_AI_MCP_TOKEN); the call will likely fail.');
    } else {
      if (!process.env.HARNESS_MCP_TOKEN && process.env.TOKEN_AI_MCP_TOKEN) {
        console.warn('HARNESS_MCP_TOKEN missing; using TOKEN_AI_MCP_TOKEN fallback.');
      }
      headers.set('Authorization', fallbackToken.startsWith('Bearer ') ? fallbackToken : `Bearer ${fallbackToken}`);
    }
  }

  const requestPayload = {
    name: 'pumpstream_live_summary',
    arguments: {
      pageSize,
      includeSpotlight: true,
      sort: 'marketCap',
      status: 'live',
    },
  };

  const headerObject = Object.fromEntries(headers.entries());
  const transport = new StreamableHTTPClientTransport(serverUrl, {
    requestInit: { headers: headerObject },
  });
  const client = new McpClient({ name: 'pumpstream-harness', version: '1.0.0' });

  try {
    await client.connect(transport);
    const toolResult = await client.callTool(requestPayload);
    await client.close();
    return {
      request: requestPayload,
      response: toolResult,
      structured: toolResult?.structuredContent || toolResult?.structured_content || null,
      rawContent: toolResult?.content || null,
    };
  } catch (error) {
    await client.close().catch(() => {});
    const message = error?.message ? String(error.message) : String(error);
    const isAuthMissing = /not initialized|oauth token required|unauthorized/i.test(message);
    if (isAuthMissing) {
      error.message = `${message} - MCP call was rejected; set HARNESS_MCP_TOKEN (or TOKEN_AI_MCP_TOKEN) to provide a bearer.`;
    }
    throw error;
  }
}

async function runApiHarness({ pageSize }) {
  const supabaseToken = buildSupabaseToken();
  const session = await createRealtimeSession({ supabaseToken });
  if (process.env.HARNESS_DEBUG_SESSION === '1') {
    process.stdout.write(`Realtime session response:\n${JSON.stringify(session, null, 2)}\n`);
  }
  const toolResult = await callMcpTool({ session, pageSize });
  return {
    session: {
      id: session?.id ?? null,
      model: session?.model ?? null,
      sessionType: session?.dexter_session?.type ?? null,
    },
    tool: toolResult,
  };
}

function writeJsonSnapshot(filename, data) {
  try {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, JSON.stringify(data, null, 2), 'utf8');
    process.stdout.write(`API artifact written to ${filename}\n`);
  } catch (error) {
    console.warn('Failed to write API artifact:', error?.message || error);
  }
}

function summarizeApiResult(result) {
  const structured = result?.tool?.structured;
  if (!structured) {
    process.stdout.write('No structured pumpstream data returned.\n');
    return;
  }
  const paging = structured.paging || {};
  const summary = {
    generatedAt: structured.generatedAt,
    totalAvailable: structured.totalAvailable,
    totalAfterFilter: structured.totalAfterFilter,
    totalReturned: structured.totalReturned,
    pageSize: paging.pageSize,
    offset: paging.offset,
    currentPage: paging.currentPage,
    totalPages: paging.totalPages,
    hasMore: paging.hasMore,
    nextOffset: paging.nextOffset,
    streamsPreview: Array.isArray(structured.streams)
      ? structured.streams.slice(0, 3).map((s) => ({ mintId: s.mintId, name: s.name, marketCapUsd: s.marketCapUsd, viewers: s.currentViewers }))
      : [],
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const prompt = resolvePrompt(args.prompt);
  const targetUrl = resolveUrl(args.url);
  const waitMs = resolveWait(args.wait);
  const pageSize = resolvePageSize(args.pageSize);

  const saveArtifactEnv = process.env.HARNESS_SAVE_ARTIFACT;
  const headlessEnv = process.env.HARNESS_HEADLESS;
  const headless = args.headful ? false : headlessEnv === 'false' ? false : true;
  const saveArtifact = args.artifact ? (saveArtifactEnv === 'false' ? false : true) : false;

  const outputDir = resolveOutputDir(process.env.HARNESS_OUTPUT_DIR);

  const hasCookie = typeof process.env.HARNESS_COOKIE === 'string' && process.env.HARNESS_COOKIE.trim().length > 0;
  const hasBearer = typeof process.env.HARNESS_AUTHORIZATION === 'string' && process.env.HARNESS_AUTHORIZATION.trim().length > 0;
  const hasCreds = hasCookie || hasBearer;

  const results = [];

  if (args.mode === 'ui' || args.mode === 'both') {
    if (!hasCreds) {
      if (args.mode === 'ui') {
        console.error('HARNESS_COOKIE or HARNESS_AUTHORIZATION must be set for UI mode.');
        process.exit(1);
      } else {
        console.warn('HARNESS_COOKIE or HARNESS_AUTHORIZATION missing; skipping UI harness run.');
      }
    } else {
      process.stdout.write('\n=== UI Harness (Playwright) ===\n');
      try {
        const artifact = await runUiHarness({ prompt, targetUrl, waitMs, headless, saveArtifact, outputDir });
        results.push({ mode: 'ui', artifact });
        if (args.json) {
          process.stdout.write(`${JSON.stringify({ mode: 'ui', artifact }, null, 2)}\n`);
        }
      } catch (error) {
        console.error('UI harness run failed:', error?.message || error);
        results.push({ mode: 'ui', error: error?.message || String(error) });
        if (args.mode === 'ui') {
          process.exit(1);
        }
      }
    }
  }

  if (args.mode === 'api' || args.mode === 'both') {
    process.stdout.write('\n=== API Harness (direct MCP) ===\n');
    const apiResult = await runApiHarness({ pageSize });
    summarizeApiResult(apiResult);
    results.push({ mode: 'api', artifact: apiResult });
    if (args.json) {
      process.stdout.write(`${JSON.stringify({ mode: 'api', artifact: apiResult }, null, 2)}\n`);
    }
    if (saveArtifact) {
      const filename = path.join(outputDir, `pumpstream-api-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      writeJsonSnapshot(filename, apiResult);
    }
  }

  return results;
}

main()
  .catch((error) => {
    console.error('Pumpstream harness run failed:', error?.message || error);
    if (error?.body) console.error('Response body:', error.body);
    process.exitCode = 1;
  });
