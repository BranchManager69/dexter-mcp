import { registerWalletToolset } from './wallet/index.mjs';

const TOOLSET_REGISTRY = {
  wallet: {
    register: registerWalletToolset,
    description: 'Supabase-backed wallet resolution and auth diagnostics.',
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

export function registerSelectedToolsets(server, selection) {
  const { keys, unknown } = resolveSelectedKeys(selection);

  if (unknown.length) {
    console.warn(`[mcp-toolsets] ignoring unknown toolsets: ${unknown.join(', ')}`);
  }

  for (const key of keys) {
    try {
      TOOLSET_REGISTRY[key].register(server);
      console.log(`[mcp-toolsets] loaded ${key}`);
    } catch (error) {
      console.error(`[mcp-toolsets] failed to load ${key}:`, error?.message || error);
    }
  }

  return keys;
}

export function listAvailableToolsets() {
  return Object.keys(TOOLSET_REGISTRY);
}
