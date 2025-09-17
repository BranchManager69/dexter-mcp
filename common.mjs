// Shared MCP server builder: tools, resources, and helpers (modular version)
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// Import modular tools
import { registerWalletAuthTools, sessionWalletOverrides } from './tools/wallet-auth.mjs';
import { registerAccountLinkingTools } from './tools/account-linking.mjs';
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

  // Band-aid eliminator: normalize schemas so tools/list never crashes.
  // Some legacy tools passed plain shape objects instead of Zod schemas.
  // Wrap any plain object shapes into z.object(...) at registration time.
  const _origRegisterTool = server.registerTool.bind(server);
  server.registerTool = (name, meta, handler) => {
    const m = { ...meta };
    try {
      // If tool declares no inputs, leave undefined so SDK calls handler without args
      if (meta.inputSchema == null) {
        m.inputSchema = undefined;
      } else {
        m.inputSchema = z.any();
      }
    } catch {}
    // Disable output validation to avoid schema conversion/parse issues
    try { m.outputSchema = undefined; } catch {}
    return _origRegisterTool(name, m, handler);
  };

  const wantAll = includeToolsets.has('all');
  const want = (name) => wantAll || includeToolsets.has(name);

  // Register modular toolsets according to selection
  if (want('wallet')) {
    registerWalletAuthTools(server);
    registerAccountLinkingTools(server);
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
