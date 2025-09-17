// Shared MCP server builder: tools, resources, and helpers (modular version)
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// Import modular tools
import { registerWalletAuthTools, sessionWalletOverrides } from './tools/wallet-auth.mjs';
import { registerProgramAccountsTools } from './tools/program-accounts.mjs';
import { registerAgentRunTools } from './tools/agent-run.mjs';
import { registerReportAnalysisTools } from './tools/report-analysis.mjs';
import { registerVoiceDebugTools } from './tools/voice-debug.mjs';
import { registerWebResearchTools } from './tools/web-research.mjs';
import { registerDexscreenerTools } from './tools/dexscreener.mjs';
import { registerWebsitesTools } from './tools/websites.mjs';
import { registerOhlcvTools } from './tools/ohlcv.mjs';
import { registerSocialsOrchestrateTools } from './tools/socials-orchestrate.mjs';
import { registerSocialsDataTools } from './tools/socials-data.mjs';
import { registerTradingTools } from './tools/trading.mjs';
import { registerPredictionTools } from './tools/predictions.mjs';
import { registerFoundationTools } from './tools/foundation.mjs';
import { registerWalletExtraTools } from './tools/wallet-extra.mjs';
import { registerWalletAliasTools } from './tools/wallet-aliases.mjs';

function headersFromExtra(extra){
  try {
    if (extra?.requestInfo?.headers) return extra.requestInfo.headers;
  } catch {}
  try {
    if (extra?.httpRequest?.headers) return extra.httpRequest.headers;
  } catch {}
  try {
    if (extra?.request?.headers) return extra.request.headers;
  } catch {}
  return {};
}

function extractSessionId(extra, args){
  try {
    const h = headersFromExtra(extra);
    const sid = h['mcp-session-id'] || h['Mcp-Session-Id'] || h['MCP-SESSION-ID'];
    if (sid) return String(sid);
  } catch {}
  try {
    if (args && typeof args === 'object' && args.sessionId) {
      return String(args.sessionId);
    }
  } catch {}
  return 'stdio';
}

function describeCaller(extra, args){
  try {
    const headers = headersFromExtra(extra);
    const email = headers['x-user-email'] || headers['X-User-Email'];
    if (email) return String(email);
    const sub = headers['x-user-sub'] || headers['X-User-Sub'] || args?.__sub;
    if (sub) return `sub:${String(sub)}`;
    if (args?.__issuer) return `issuer:${String(args.__issuer)}`;
  } catch {}
  return null;
}

function summarizeArgs(args){
  try {
    if (!args || typeof args !== 'object') return '';
    const summary = {};
    const highlightKeys = ['wallet_id','make_default','mint_address','mint','token_mint','chain_id','symbol','url','twitter_url','telegram_url','limit','query'];
    for (const [key, value] of Object.entries(args)) {
      if (key.startsWith('__')) {
        const pretty = key.replace(/^__+/, '');
        summary[pretty] = typeof value === 'string' ? sanitizeText(value) : value;
        continue;
      }
      if (key === 'signal' || key === 'requestInfo' || key === 'httpRequest') continue;
      if (key === 'sessionId' || key === 'requestId') continue;
      if (!highlightKeys.includes(key) && typeof value === 'object') continue;
      if (typeof value === 'string') {
        summary[key] = value.length > 80 ? `${value.slice(0,77)}…` : value;
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        summary[key] = value;
      } else if (Array.isArray(value)) {
        summary[key] = `[len=${value.length}]`;
      } else if (value && typeof value === 'object') {
        summary[key] = '{…}';
      } else {
        summary[key] = value;
      }
    }
    const json = JSON.stringify(summary);
    if (!json) return '';
    return json.length > 180 ? `${json.slice(0,177)}…` : json;
  } catch {}
  return '';
}

const COLORS = { start: '\x1b[36m', ok: '\x1b[32m', err: '\x1b[31m', info: '\x1b[35m', reset: '\x1b[0m' };

function summarizeResult(result){
  try {
    if (!result || typeof result !== 'object') return '';
    if (result.isError) {
      let text = '';
      try {
        if (Array.isArray(result.content)) {
          const first = result.content.find((c) => c && typeof c.text === 'string');
          if (first) text = first.text;
        }
        if (!text && typeof result.error === 'object' && result.error?.message) text = result.error.message;
      } catch {}
      const sanitized = sanitizeText(text || 'error');
      return `isError=true${sanitized ? ` message=${sanitized}` : ''}`;
    }
    if (result.structuredContent && typeof result.structuredContent === 'object') {
      const sc = result.structuredContent;
      const highlights = [];
      if (Array.isArray(sc.wallets)) highlights.push(`wallets.len=${sc.wallets.length}`);
      if (Array.isArray(sc.links)) highlights.push(`links.len=${sc.links.length}`);
      if (Array.isArray(sc.results)) highlights.push(`results.len=${sc.results.length}`);
      if ('wallet_id' in sc) highlights.push(`wallet_id=${sanitizeText(sc.wallet_id) || '∅'}`);
      if ('source' in sc) highlights.push(`source=${sanitizeText(sc.source) || '∅'}`);
      if ('status' in sc) highlights.push(`status=${sanitizeText(sc.status) || '∅'}`);
      if ('mint_address' in sc) highlights.push(`mint=${sanitizeText(sc.mint_address) || '∅'}`);
      if ('issuer' in sc) highlights.push(`issuer=${sanitizeText(sc.issuer) || '∅'}`);
      if ('subject' in sc) highlights.push(`subject=${sanitizeText(sc.subject) || '∅'}`);
      if ('bearer_preview' in sc) highlights.push(`bearer=${sanitizeText(sc.bearer_preview) || '∅'}`);
      if (!highlights.length) {
        const keys = Object.keys(sc);
        if (keys.length) highlights.push(`keys=${keys.join(',')}`);
      }
      return `structured=${highlights.join(' ')}`;
    }
    if (Array.isArray(result.content)) {
      const texts = result.content
        .filter((c) => c && typeof c.text === 'string')
        .map((c) => sanitizeText(c.text))
        .filter(Boolean);
      if (texts.length) return `content.len=${result.content.length} preview=${texts[0]}`;
      return `content.len=${result.content.length}`;
    }
  } catch {}
  return '';
}

function sanitizeText(input){
  try {
    const text = String(input || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    return text.replace(/[A-Za-z0-9]{24,}/g, '***');
  } catch { return ''; }
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_AI_DIR = path.resolve(HERE, '..');
const REPORTS_DIR = path.join(TOKEN_AI_DIR, 'reports', 'ai-token-analyses');
const RESEARCH_DIR = path.join(TOKEN_AI_DIR, 'reports', 'deep-research');

const ENABLE_RUN_TOOLS = String(process.env.TOKEN_AI_MCP_ENABLE_RUN_TOOLS || '1') !== '0';

// Parse toolset selection from a comma-separated string.
// Supported names: all, wallet, program, runs, reports, voice, web, trading
function parseToolsets(arg) {
  const raw = Array.isArray(arg) ? arg.join(',') : String(arg || '').trim();
  if (!raw) return new Set(['all']);
  const parts = raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (parts.includes('all')) return new Set(['all']);
  const allowed = new Set(['wallet','program','runs','reports','voice','web','trading']);
  const out = new Set();
  for (const p of parts) { if (allowed.has(p)) out.add(p); }
  return out.size ? out : new Set(['all']);
}

// Trading mode is advanced-only; minimal mode removed to reduce complexity

// Helper functions for resources
function extractMintFromReport(j, filename){
  try {
    let m = j?.tokenAddress || j?.mint || j?.metadata?.tokenAddress || j?.metadata?.token_address || j?.metadata?.token?.address || j?.token?.address || '';
    if (typeof m === 'string') m = m.trim(); else m = '';
    if (m.startsWith('--mint=')) m = m.slice(7);
    if (m && !m.startsWith('--')) return m;
    // Fallback: filename patterns
    const name = String(filename || '');
    const mintEq = name.match(/mint=([A-Za-z0-9_-]+)/);
    if (mintEq && mintEq[1]) return mintEq[1];
    const base58Matches = name.match(/[1-9A-HJ-NP-Za-km-z]{32,64}/g);
    if (base58Matches && base58Matches.length) {
      return base58Matches.sort((a,b)=> b.length - a.length)[0];
    }
  } catch {}
  return null;
}

function extractMeta(j){
  try {
    const symbol = j?.symbol || j?.ticker || j?.token?.symbol || null;
    const name = j?.name || j?.token?.name || null;
    const created_at = j?.created_at || j?.metadata?.timestamp || j?.metadata?.started_at || null;
    const market = j?.metadata?.market || j?.market || {};
    const fdv = (typeof market?.fdv === 'number') ? market.fdv : null;
    const liquidity = (typeof market?.liquidity === 'number') ? market.liquidity : null;
    const volume24h = (typeof market?.volume24h === 'number' || typeof market?.volume_24h === 'number') ? (market.volume24h ?? market.volume_24h) : null;
    return { symbol: symbol || null, name: name || null, created_at: created_at || null, fdv, liquidity, volume24h };
  } catch {
    return { symbol: null, name: null, created_at: null, fdv: null, liquidity: null, volume24h: null };
  }
}

export function buildMcpServer(options = {}){
  const includeToolsets = options.includeToolsets
    ? parseToolsets(options.includeToolsets)
    : parseToolsets(process.env.TOKEN_AI_MCP_TOOLSETS || 'all');

  const instructionsLines = [
    'Tools and resources for Token-AI analyses.',
    '- Resources: report://ai-token-analyses/{file} (application/json), report://ai-token-analyses/by-mint/{mint}.',
    '- Configure toolsets: TOKEN_AI_MCP_TOOLSETS=all|wallet,program,runs,reports,voice,web,trading'
  ];
  const server = new McpServer({ name: 'token-ai-mcp', version: '0.2.0' }, {
    capabilities: { logging: {}, tools: { listChanged: true } },
    instructions: instructionsLines.join('\n')
  });

  const _origRegisterTool = server.registerTool.bind(server);

  function coerceSchema(schema, fallback) {
    if (schema === undefined || schema === null) {
      return fallback;
    }
    if (schema instanceof z.ZodObject) {
      return schema._def.shape();
    }
    if (schema instanceof z.ZodType) {
      throw new TypeError('registerTool: pass a raw object shape, not a Zod schema instance');
    }
    if (schema && typeof schema === 'object') {
      const out = {};
      for (const [key, value] of Object.entries(schema)) {
        if (!(value instanceof z.ZodType)) {
          throw new TypeError(`registerTool: schema for "${key}" must be a Zod schema`);
        }
        out[key] = value;
      }
      return out;
    }
    throw new TypeError('registerTool: unsupported schema type');
  }

  server.registerTool = (name, meta, handler) => {
    const m = { ...meta };
    if (Object.prototype.hasOwnProperty.call(meta, 'inputSchema')) {
      m.inputSchema = coerceSchema(meta.inputSchema, {});
    }
    if (Object.prototype.hasOwnProperty.call(meta, 'outputSchema')) {
      m.outputSchema = coerceSchema(meta.outputSchema, undefined);
    }
    try {
      const inDesc = m.inputSchema ? 'RawShape' : 'undefined';
      const outDesc = m.outputSchema ? 'RawShape' : 'undefined';
      console.log(`[schema] register tool ${name} input=${inDesc} output=${outDesc}`);
    } catch {}

    const wrappedHandler = async (args, extra) => {
      const started = Date.now();
      const sid = extractSessionId(extra, args);

      const caller = describeCaller(extra, args);
      const preview = summarizeArgs(args);
      try {
        const callerInfo = caller ? ` user=${caller}` : '';
        const argInfo = preview ? ` args=${preview}` : '';
        console.log(`${COLORS.start}[mcp-tool] start${COLORS.reset} name=${name} sid=${sid}${callerInfo}${argInfo}`);
      } catch {}
      try {
        const result = await handler(args, extra);
        try {
          const duration = Date.now() - started;
          const outcome = summarizeResult(result);
          const outcomeInfo = outcome ? ` ${outcome}` : '';
          console.log(`${COLORS.ok}[mcp-tool] ok${COLORS.reset} name=${name} sid=${sid} ms=${duration}${outcomeInfo}`);
        } catch {}
        return result;
      } catch (err) {
        try {
          const duration = Date.now() - started;
          const message = err?.stack || err?.message || String(err);
          console.error(`${COLORS.err}[mcp-tool] err${COLORS.reset} name=${name} sid=${sid} ms=${duration} error=${message}`);
        } catch {}
        throw err;
      }
    };

    return _origRegisterTool(name, m, wrappedHandler);
  };

  const wantAll = includeToolsets.has('all');
  const want = (name) => wantAll || includeToolsets.has(name);

  // Register modular toolsets according to selection
  if (want('wallet')) {
    registerWalletAuthTools(server);
    registerWalletAliasTools(server);
  }
  if (want('program')) registerProgramAccountsTools(server);
  if (want('runs') && ENABLE_RUN_TOOLS) registerAgentRunTools(server);
  if (want('reports')) registerReportAnalysisTools(server);
  if (want('voice')) registerVoiceDebugTools(server);
  if (want('web')) {
    registerWebResearchTools(server);
    registerWebsitesTools(server);
    registerDexscreenerTools(server);
    registerOhlcvTools(server);
    registerSocialsDataTools(server);
  }
  if (want('trading')) registerTradingTools(server);
  if (want('trading')) registerWalletExtraTools(server);
  // Predictions and DB foundation helpers are broadly useful; include under 'web' or 'reports'
  if (want('web') || want('reports')) registerPredictionTools(server);
  if (want('web') || want('reports')) registerFoundationTools(server);
  if (want('runs') && ENABLE_RUN_TOOLS) {
    // registerAgentRunTools already handled above; add orchestrate aggregator
    registerSocialsOrchestrateTools(server);
  }

  // Resources (use McpServer.resource API)
  // report://ai-token-analyses/{file}
  server.resource(
    'ai-token-analyses:file',
    new ResourceTemplate('report://ai-token-analyses/{file}', {
      // Make recent reports discoverable via resources/list
      list: async () => {
        let files = [];
        try {
          files = (fs.readdirSync(REPORTS_DIR) || [])
            .filter((f) => f.endsWith('.json'))
            .map((f) => ({
              name: f,
              mtime: (() => {
                try {
                  return fs.statSync(path.join(REPORTS_DIR, f)).mtimeMs || 0;
                } catch {
                  return 0;
                }
              })(),
            }))
            .sort((a, b) => b.mtime - a.mtime)
            .slice(0, 50);
        } catch {}
        const resources = [];
        for (const it of files) {
          try {
            // Best-effort metadata for nicer display
            const raw = fs.readFileSync(path.join(REPORTS_DIR, it.name), 'utf8');
            let j = null;
            try { j = JSON.parse(raw); } catch {}
            const mint = extractMintFromReport(j, it.name) || null;
            const meta = extractMeta(j || {}) || {};
            const symbol = meta.symbol || null;
            const titleParts = [symbol ? symbol : null, mint ? `(${mint.slice(0,6)}…${mint.slice(-4)})` : null].filter(Boolean);
            const title = titleParts.length ? titleParts.join(' ') : it.name;
            const descParts = [];
            if (meta.name) descParts.push(meta.name);
            if (meta.fdv != null) descParts.push(`FDV ${meta.fdv}`);
            if (meta.liquidity != null) descParts.push(`Liq ${meta.liquidity}`);
            const description = descParts.length ? `AI analysis • ${descParts.join(' • ')}` : 'AI analysis report';
            resources.push({
              name: it.name,
              title,
              description,
              uri: `report://ai-token-analyses/${it.name}`,
              mimeType: 'application/json',
            });
          } catch {}
        }
        return { resources };
      },
    }),
    async (_uri, vars) => {
      const file = vars?.file;
      if (!/^[A-Za-z0-9._-]+\.json$/.test(String(file))) throw new Error('Invalid filename');
      const abs = path.join(REPORTS_DIR, String(file));
      if (!fs.existsSync(abs)) throw new Error('File not found');
      const data = fs.readFileSync(abs, 'utf8');
      return { contents: [{ uri: _uri, mimeType: 'application/json', type: 'text', text: data }] };
    }
  );

  // report://ai-token-analyses/by-mint/{mint}
  server.resource(
    'ai-token-analyses:by-mint',
    new ResourceTemplate('report://ai-token-analyses/by-mint/{mint}', {
      // Optional: provide basic completion for {mint} via recent files
      complete: {
        mint: async (prefix) => {
          const p = String(prefix || '').toLowerCase();
          try {
            const files = (fs.readdirSync(REPORTS_DIR) || [])
              .filter((f) => f.endsWith('.json'))
              .slice(0, 200);
            const sugg = [];
            for (const f of files) {
              try {
                const j = JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, f), 'utf8'));
                const m = String(extractMintFromReport(j, f) || '').toLowerCase();
                if (m && (!p || m.includes(p))) sugg.push(m);
                if (sugg.length >= 100) break;
              } catch {}
            }
            // Return unique suggestions
            return Array.from(new Set(sugg));
          } catch {
            return [];
          }
        },
      },
    }),
    async (_uri, vars) => {
      const mint = vars?.mint;
      // Find most recent report for this mint
      try {
        const files = (fs.readdirSync(REPORTS_DIR) || [])
          .filter(f => f.endsWith('.json'))
          .map(f => ({
            file: path.join(REPORTS_DIR, f),
            name: f,
            mtime: (()=>{ try { return fs.statSync(path.join(REPORTS_DIR, f)).mtimeMs || 0; } catch { return 0; } })()
          }))
          .sort((a,b)=> b.mtime - a.mtime);

        const m = String(mint || '').toLowerCase();
        for (const f of files) {
          try {
            const raw = fs.readFileSync(f.file, 'utf8');
            const j = JSON.parse(raw);
            const jm = String(extractMintFromReport(j, f.name) || '').toLowerCase();
            if (jm && (jm === m || jm.includes(m))) {
              return { contents: [{ uri: _uri, mimeType: 'application/json', type: 'text', text: raw }] };
            }
          } catch {}
        }
      } catch {}
      throw new Error('No report found for mint');
    }
  );

  // research://deep-research/notes/{id}
  server.resource(
    'deep-research:note',
    new ResourceTemplate('research://deep-research/notes/{id}', {
      list: async () => {
        const notesDir = path.join(RESEARCH_DIR, 'notes');
        let files = [];
        try {
          files = (fs.readdirSync(notesDir) || [])
            .filter((f) => f.endsWith('.json'))
            .slice(0, 100);
        } catch {}
        const resources = files.map((f) => ({
          name: f.replace(/\.json$/, ''),
          title: `Note ${f.replace(/\.json$/, '')}`,
          description: 'Deep research note',
          uri: `research://deep-research/notes/${f.replace(/\.json$/, '')}`,
          mimeType: 'application/json',
        }));
        return { resources };
      },
    }),
    async (_uri, vars) => {
      const id = vars?.id;
      const safe = String(id||'').replace(/[^A-Za-z0-9_-]/g,'');
      const file = path.join(RESEARCH_DIR, 'notes', `${safe}.json`);
      if (!fs.existsSync(file)) throw new Error('Note not found');
      const data = fs.readFileSync(file, 'utf8');
      return { contents: [{ uri: _uri, mimeType: 'application/json', type: 'text', text: data }] };
    }
  );

  // research://deep-research/{file}
  server.resource(
    'deep-research:file',
    new ResourceTemplate('research://deep-research/{file}', {
      list: async () => {
        const repDir = path.join(RESEARCH_DIR, 'reports');
        let files = [];
        try {
          files = (fs.readdirSync(repDir) || [])
            .filter((f) => f.endsWith('.json'))
            .map((f) => ({ name: f, mtime: (()=>{ try { return fs.statSync(path.join(repDir, f)).mtimeMs||0; } catch { return 0; } })() }))
            .sort((a,b)=> b.mtime - a.mtime)
            .slice(0, 50)
            .map((it) => it.name);
        } catch {}
        const resources = files.map((f) => ({
          name: f,
          title: f,
          description: 'Deep research report',
          uri: `research://deep-research/${f}`,
          mimeType: 'application/json',
        }));
        return { resources };
      },
    }),
    async (_uri, vars) => {
      const file = vars?.file;
      if (!/^[A-Za-z0-9._-]+\.json$/.test(String(file))) throw new Error('Invalid filename');
      const abs = path.join(RESEARCH_DIR, 'reports', String(file));
      if (!fs.existsSync(abs)) throw new Error('File not found');
      const data = fs.readFileSync(abs, 'utf8');
      return { contents: [{ uri: _uri, mimeType: 'application/json', type: 'text', text: data }] };
    }
  );

  return server;
}

// Make helper functions and maps available for backward compatibility
export { sessionWalletOverrides, extractMintFromReport, extractMeta };
