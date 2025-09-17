#!/usr/bin/env node
// MCP stdio server (spawns via stdio)
// Usage: node mcp/server.mjs

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { buildMcpServer } from './common.mjs';
import dotenv from 'dotenv';
import path from 'node:path';

// Ensure env vars are loaded from repo root, legacy token-ai/.env, and local MCP folder
try {
  const HERE = path.resolve(path.dirname(new URL(import.meta.url).pathname));
  const ALPHA_ROOT = path.resolve(HERE, '..');
  const REPO_ROOT = path.resolve(ALPHA_ROOT, '..');
  const LEGACY_TOKEN_AI = path.join(REPO_ROOT, 'token-ai');
  dotenv.config({ path: path.join(REPO_ROOT, '.env') });
  dotenv.config({ path: path.join(LEGACY_TOKEN_AI, '.env') });
  dotenv.config({ path: path.join(HERE, '.env') });
} catch {}

// CLI flags (mirror HTTP `?tools=` semantics)
const ARGS = process.argv.slice(2);
function getFlag(name, def){
  for (let i=0;i<ARGS.length;i++){
    const a = ARGS[i];
    if (a === `--${name}`) return ARGS[i+1] || def;
    if (a.startsWith(`--${name}=`)) return a.split('=')[1] || def;
  }
  return def;
}

// Allow per-process toolset selection: `--tools=wallet,web` (same groups as HTTP)
// Recognized groups: wallet, program, runs, reports, voice, web, trading, or all
const includeToolsets = (() => {
  const t = String(getFlag('tools', '') || '').trim();
  return t ? t : undefined; // pass through to common.mjs for parsing
})();

const server = buildMcpServer({ includeToolsets });
const transport = new StdioServerTransport();
(async () => {
  try {
    await server.connect(transport);
    process.stdin.resume();
  } catch (e) {
    console.error('[mcp-stdio] failed to start:', e?.message || e);
    process.exit(1);
  }
})();
