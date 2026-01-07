#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

function stripAnsi(input) {
  return String(input).replace(/\x1B\[[0-9;]*[mK]/g, '');
}

function parseArgs(argv) {
  const args = new Map();
  const flags = new Set();
  for (let idx = 0; idx < argv.length; idx += 1) {
    const token = argv[idx];
    if (!token.startsWith('--')) continue;
    const next = argv[idx + 1];
    if (next && !next.startsWith('--')) {
      args.set(token, next);
      idx += 1;
    } else {
      flags.add(token);
    }
  }
  return { args, flags };
}

function getEmailIdentity(user) {
  const match = String(user || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (match) return match[0];
  return String(user || 'unknown');
}

function formatBytes(bytes) {
  const num = Number(bytes);
  if (!Number.isFinite(num) || num <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let idx = 0;
  let value = num;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function parsePm2List() {
  const raw = execSync('pm2 jlist', { encoding: 'utf8' });
  return JSON.parse(raw);
}

function pickProcess(list, name) {
  const exact = list.find((entry) => entry?.name === name);
  if (exact) return exact;
  const lower = name.toLowerCase();
  return list.find((entry) => String(entry?.name || '').toLowerCase() === lower) || null;
}

function parseUtcTimestamp(date, time) {
  const parts = String(date).split('-').map((n) => Number(n));
  const tparts = String(time).split(':').map((n) => Number(n));
  if (parts.length !== 3 || tparts.length !== 3) return null;
  const [year, month, day] = parts;
  const [hour, minute, second] = tparts;
  if (![year, month, day, hour, minute, second].every((n) => Number.isFinite(n))) return null;
  return Date.UTC(year, month - 1, day, hour, minute, second);
}

async function collectSessionEvents({ outLogPath, sinceMs }) {
  const dir = path.dirname(outLogPath);
  const base = path.basename(outLogPath).replace(/\.log$/, '');
  const candidates = fs
    .readdirSync(dir)
    .filter((file) => file === path.basename(outLogPath) || (file.startsWith(`${base}__`) && file.endsWith('.log')))
    .map((file) => path.join(dir, file))
    .sort();

  const startEvents = [];
  const endEvents = [];

  const startRe = /^\s*(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}):\s+\[mcp-session\]\s+start\s+user=(.*?)\s+client=(.*?)\s+sid=([0-9a-f-]+)\s*$/i;
  const endRe = /^\s*(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}):\s+\[mcp-session\]\s+end\s+user=(.*?)\s+client=(.*?)\s+sid=([0-9a-f-]+)\s+/i;

  for (const filePath of candidates) {
    const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    for await (const rawLine of rl) {
      if (!rawLine.includes('[mcp-session]')) continue;
      const line = stripAnsi(rawLine);

      let match = line.match(startRe);
      if (match) {
        const [, date, time, user, client, sid] = match;
        const tsMs = parseUtcTimestamp(date, time);
        if (tsMs !== null && typeof sinceMs === 'number' && tsMs < sinceMs) continue;
        startEvents.push({ tsMs, date, time, user, client, sid });
        continue;
      }

      match = line.match(endRe);
      if (match) {
        const [, date, time, user, client, sid] = match;
        const tsMs = parseUtcTimestamp(date, time);
        if (tsMs !== null && typeof sinceMs === 'number' && tsMs < sinceMs) continue;
        endEvents.push({ tsMs, date, time, user, client, sid });
      }
    }
  }

  startEvents.sort((a, b) => (a.tsMs ?? 0) - (b.tsMs ?? 0));
  endEvents.sort((a, b) => (a.tsMs ?? 0) - (b.tsMs ?? 0));

  return { candidates, startEvents, endEvents };
}

function topCounts(map, limit) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

async function fetchHealthSessions(port) {
  try {
    const resp = await fetch(`http://localhost:${port}/health`, { headers: { accept: 'application/json' } });
    if (!resp.ok) return null;
    const json = await resp.json().catch(() => null);
    const sessions = json?.sessions;
    if (!sessions || typeof sessions !== 'object') return null;
    return {
      transports: typeof sessions.transports === 'number' ? sessions.transports : null,
      servers: typeof sessions.servers === 'number' ? sessions.servers : null,
    };
  } catch {
    return null;
  }
}

async function main() {
  const { args, flags } = parseArgs(process.argv.slice(2));
  const name = args.get('--name') || 'dexter-mcp';
  const top = Math.max(1, Math.min(100, Number(args.get('--top') || 10) || 10));
  const jsonOut = flags.has('--json');

  const list = parsePm2List();
  const proc = pickProcess(list, name);
  if (!proc) {
    console.error(`process_not_found: ${name}`);
    process.exit(1);
  }

  const outLogPath = proc?.pm2_env?.pm_out_log_path;
  if (!outLogPath) {
    console.error(`missing_pm2_env.pm_out_log_path for ${name}`);
    process.exit(1);
  }

  const sinceMs = typeof proc?.pm2_env?.pm_uptime === 'number' ? proc.pm2_env.pm_uptime : null;
  const uptimeIso = sinceMs ? new Date(sinceMs).toISOString() : null;
  const port = Number(proc?.pm2_env?.env?.TOKEN_AI_MCP_PORT || 3930);

  const healthSessions = await fetchHealthSessions(port);
  const { candidates, startEvents, endEvents } = await collectSessionEvents({ outLogPath, sinceMs });

  const byClient = new Map();
  const byIdentity = new Map();
  for (const evt of startEvents) {
    byClient.set(evt.client, (byClient.get(evt.client) || 0) + 1);
    const identity = getEmailIdentity(evt.user);
    byIdentity.set(identity, (byIdentity.get(identity) || 0) + 1);
  }

  const summary = {
    name: proc.name,
    pm_id: proc.pm_id,
    since: uptimeIso,
    port,
    pm2: {
      uptime_ms: sinceMs,
      restart_time: proc?.pm2_env?.restart_time ?? null,
      rss_bytes: proc?.monit?.memory ?? null,
      rss: formatBytes(proc?.monit?.memory ?? 0),
      max_memory_restart: proc?.pm2_env?.max_memory_restart ?? null,
    },
    health: { sessions: healthSessions },
    logs: {
      out_log_path: outLogPath,
      files_scanned: candidates.map((fp) => path.basename(fp)),
      starts: startEvents.length,
      ends: endEvents.length,
      leaked_estimate: Math.max(0, startEvents.length - endEvents.length),
      first_start: startEvents[0] || null,
      last_start: startEvents[startEvents.length - 1] || null,
    },
    counts: {
      by_client: topCounts(byClient, top),
      by_identity: topCounts(byIdentity, top),
    },
  };

  if (jsonOut) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log(`mcp sessions (${summary.name})`);
  if (summary.since) console.log(`- since: ${summary.since}`);
  console.log(`- pm2: rss=${summary.pm2.rss} restart_time=${summary.pm2.restart_time}${summary.pm2.max_memory_restart ? ` max_memory_restart=${summary.pm2.max_memory_restart}` : ''}`);
  if (summary.health.sessions) {
    console.log(`- /health: transports=${summary.health.sessions.transports ?? 'n/a'} servers=${summary.health.sessions.servers ?? 'n/a'}`);
  } else {
    console.log(`- /health: unavailable (tried http://localhost:${port}/health)`);
  }
  console.log(`- logs: starts=${summary.logs.starts} ends=${summary.logs.ends} leaked≈${summary.logs.leaked_estimate}`);
  console.log(`- top clients: ${summary.counts.by_client.map((x) => `${x.key}=${x.count}`).join(', ') || 'n/a'}`);
  console.log(`- top identities: ${summary.counts.by_identity.map((x) => `${x.key}=${x.count}`).join(', ') || 'n/a'}`);
}

await main();

