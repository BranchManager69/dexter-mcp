import chalk, { Chalk } from 'chalk';
import { registerGeneralToolset } from './general/index.mjs';
import { registerPumpstreamToolset } from './pumpstream/index.mjs';
import { registerWalletToolset } from './wallet/index.mjs';
import { registerSolanaToolset } from './solana/index.mjs';
import { registerCodexToolset } from './codex/index.mjs';
import { registerStreamToolset } from './stream/index.mjs';
import { registerMarketsToolset } from './markets/index.mjs';
import { registerTwitterToolset } from './twitter/index.mjs';
import { registerGmgnToolset } from './gmgn/index.mjs';
import { registerKolscanToolset } from './kolscan/index.mjs';
import { registerOnchainToolset } from './onchain/index.mjs';

const passthrough = (value) => String(value);

const chalkStub = {
  cyan: passthrough,
  cyanBright: passthrough,
  magenta: passthrough,
  magentaBright: passthrough,
  green: passthrough,
  yellow: passthrough,
  red: passthrough,
  blue: passthrough,
  blueBright: passthrough,
  white: passthrough,
  gray: passthrough,
  bold: passthrough,
  dim: passthrough,
  underline: passthrough,
};

function getColor() {
  const force = ['1','true','yes','on'].includes(String(process.env.MCP_LOG_FORCE_COLOR || '').toLowerCase());
  if (force && !process.env.FORCE_COLOR) process.env.FORCE_COLOR = '1';
  const enabled = force || process.stdout.isTTY || process.env.FORCE_COLOR === '1';
  if (!enabled) return { ...chalkStub };
  const instance = force ? new Chalk({ level: 1 }) : chalk;
  const wrap = (...fns) => (val) => {
    const str = String(val);
    for (const fn of fns) {
      if (typeof fn === 'function') {
        try {
          return fn(str);
        } catch {}
      }
    }
    return str;
  };
  return {
    ...chalkStub,
    cyan: wrap(instance?.cyan),
    cyanBright: wrap(instance?.cyanBright, instance?.cyan),
    magenta: wrap(instance?.magenta),
    magentaBright: wrap(instance?.magentaBright, instance?.magenta),
    green: wrap(instance?.green),
    yellow: wrap(instance?.yellow),
    red: wrap(instance?.red),
    blue: wrap(instance?.blue),
    blueBright: wrap(instance?.blueBright, instance?.blue),
    white: wrap(instance?.white),
    gray: wrap(instance?.gray, instance?.white),
    bold: wrap(instance?.bold),
    dim: wrap(instance?.dim),
    underline: wrap(instance?.underline, instance?.bold),
  };
}

const TOOLSET_REGISTRY = {
  general: {
    register: registerGeneralToolset,
    description: 'General purpose search/fetch utilities for Dexter documentation.',
  },
  pumpstream: {
    register: registerPumpstreamToolset,
    description: 'Real-time summaries from pump.dexter.cash.',
  },
  wallet: {
    register: registerWalletToolset,
    description: 'Supabase-backed wallet resolution and auth diagnostics.',
  },
  solana: {
    register: registerSolanaToolset,
    description: 'Managed Solana trading tools (buy, sell, resolve tokens).',
  },
  codex: {
    register: registerCodexToolset,
    description: 'Codex sessions (read-only, search-enabled) proxied through Dexter.',
  },
  stream: {
    register: registerStreamToolset,
    description: 'DexterVision stream controls (scene status and switching).',
  },
  markets: {
    register: registerMarketsToolset,
    description: 'Market data utilities (Birdeye OHLCV, analytics).',
  },
  twitter: {
    register: registerTwitterToolset,
    description: 'Twitter/X scraping utilities (session-backed search).',
  },
  gmgn: {
    register: registerGmgnToolset,
    description: 'GMGN token snapshot scraper (headless, Cloudflare-aware).',
  },
  kolscan: {
    register: registerKolscanToolset,
    description: 'Kolscan KOL analytics (leaderboard, wallet, trending, token summaries).',
  },
  onchain: {
    register: registerOnchainToolset,
    description: 'Dexter on-chain analytics (token flows, wallet summaries, transaction deltas).',
  },
};

const DEFAULT_TOOLSET_KEYS = Object.keys(TOOLSET_REGISTRY);

function normalizeSelection(selection) {
  if (!selection) return [];
  if (Array.isArray(selection)) {
    return selection
      .map((value) => String(value || '').trim())
      .filter(Boolean);
  }
  if (typeof selection === 'string') {
    return selection
      .split(/[,\s]+/)
      .map((value) => value.trim())
      .filter(Boolean);
  }
  return [];
}

function resolveSelectedKeys(preferred) {
  const envSelection = normalizeSelection(process.env.TOKEN_AI_MCP_TOOLSETS);
  const requested = normalizeSelection(preferred);
  const rawKeys = requested.length ? requested : (envSelection.length ? envSelection : DEFAULT_TOOLSET_KEYS);
  const uniqueKeys = new Set(rawKeys.map((key) => key.toLowerCase()));

  if (uniqueKeys.has('all')) {
    return { keys: Object.keys(TOOLSET_REGISTRY), unknown: [] };
  }

  const known = [];
  const unknown = [];
  for (const key of uniqueKeys) {
    if (TOOLSET_REGISTRY[key]) {
      known.push(key);
    } else {
      unknown.push(key);
    }
  }
  if (!known.length) {
    // Fallback to defaults if nothing valid was requested.
    return { keys: DEFAULT_TOOLSET_KEYS, unknown };
  }
  return { keys: known, unknown };
}

function listToolNames(server) {
  try {
    if (typeof server.listTools === 'function') {
      const listed = server.listTools();
      if (Array.isArray(listed)) {
        return listed.map((tool) => tool?.name).filter(Boolean);
      }
    }
  } catch {}
  try {
    if (server && typeof server._registeredTools === 'object') {
      return Object.keys(server._registeredTools);
    }
  } catch {}
  return [];
}

function captureToolNames(server) {
  return new Set(listToolNames(server));
}

export function registerSelectedToolsets(server, selection) {
  const { keys, unknown } = resolveSelectedKeys(selection);

  const color = getColor();
  const label = color.cyan('[mcp-toolsets]');
  const groups = [];

  if (unknown.length) {
    console.warn(`${label} ${color.yellow('ignoring unknown toolsets')}: ${color.yellow(unknown.join(', '))}`);
  }

  for (const key of keys) {
    try {
      const before = captureToolNames(server);
      TOOLSET_REGISTRY[key].register(server);
      const afterList = listToolNames(server);
      const afterSet = new Set(afterList);
      const added = afterList.filter((name) => !before.has(name) && afterSet.has(name));
      groups.push({ key, tools: added });
      const separator = color.dim ? color.dim(', ') : ', ';
      const arrow = color.dim ? color.dim('>') : '>';
      const toolList = added.length ? ` ${arrow} ${added.map((name) => (color.cyan ? color.cyan(name) : name)).join(separator)}` : '';
      console.log(`${label} loaded ${color.cyanBright(key)}${toolList}`);
    } catch (error) {
      console.error(`${label} ${color.red('failed to load')} ${color.cyanBright(key)}: ${color.red(error?.message || error)}`);
    }
  }

  server.__dexterLoadedToolsets = [...keys];
  server.__dexterToolGroups = groups;

  return keys;
}

export function listAvailableToolsets() {
  return Object.keys(TOOLSET_REGISTRY);
}
