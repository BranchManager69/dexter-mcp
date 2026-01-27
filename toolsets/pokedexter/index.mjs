/**
 * Pokedexter Local Bridge Toolset
 * 
 * These are FREE tools for Dexter MCP users that bypass the x402 payment layer
 * for battle actions. Entry-point tools (create/accept challenge, join queue)
 * remain x402-protected, but battle actions (get state, make move) are free.
 * 
 * External agents (not using Dexter MCP) will use the x402 versions instead.
 */

const DEXTER_API_URL = process.env.DEXTER_API_URL || 'https://api.dexter.cash';
const POKEDEXTER_API_URL = process.env.POKEDEXTER_API_URL || 'https://poke.dexter.cash';

/**
 * Proxy request to Dexter API (which proxies to Pokedexter)
 */
async function callPokedexterApi(path, options = {}) {
  const url = `${DEXTER_API_URL}${path}`;
  
  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    console.error('[pokedexter] proxy_error:', error?.message || error);
    return { 
      ok: false, 
      status: 502, 
      data: { success: false, error: error?.message || 'pokedexter_unavailable' } 
    };
  }
}

/**
 * Resolve wallet address from extra context
 */
function resolveWalletAddress(extra) {
  const headerSources = [
    extra?.requestInfo?.headers,
    extra?.httpRequest?.headers,
    extra?.request?.headers,
  ].filter(Boolean);

  for (const headers of headerSources) {
    const addr = headers?.['x-self-fee-payer-address'] || headers?.['X-Self-Fee-Payer-Address'];
    if (typeof addr === 'string' && addr.trim()) {
      return addr.trim();
    }
  }

  return null;
}

/**
 * Derive user ID from wallet address
 */
function deriveUserId(walletAddress) {
  if (walletAddress && walletAddress.length >= 8) {
    return `agent_${walletAddress.slice(0, 8)}`.toLowerCase();
  }
  return `agent_${Date.now().toString(36)}`;
}

export async function registerPokedexterToolset(server) {
  // ============================================================================
  // FREE BATTLE ACTION TOOLS (local bridge versions)
  // These take precedence over x402 versions for MCP users
  // ============================================================================

  /**
   * Get current battle state
   */
  server.registerTool('pokedexter_get_battle_state', {
    title: 'Pokedexter: Get Battle State',
    description: 'Get the current state of your active Pokémon battle including your team, opponent info, field conditions, and available moves. Use this before each turn to see what actions are available.',
    _meta: {
      category: 'games.pokedexter',
      access: 'member',
      tags: ['pokedexter', 'battle', 'state', 'free'],
    },
    inputSchema: {
      type: 'object',
      properties: {
        battleId: {
          type: 'string',
          description: 'The battle room ID from your wager/challenge response',
        },
      },
      required: ['battleId'],
    },
  }, async (args, extra) => {
    const { battleId } = args;
    
    if (!battleId) {
      throw new Error('battleId is required');
    }

    const walletAddress = resolveWalletAddress(extra);
    const headers = {};
    if (walletAddress) {
      headers['x-self-fee-payer-address'] = walletAddress;
    }

    const result = await callPokedexterApi(`/api/pokedexter/battles/${battleId}/state`, {
      headers,
    });

    if (!result.ok) {
      throw new Error(result.data?.error || 'get_battle_state_failed');
    }

    return {
      structuredContent: result.data,
      content: [{ type: 'text', text: JSON.stringify(result.data) }],
    };
  });

  /**
   * Submit a move in battle
   */
  server.registerTool('pokedexter_make_move', {
    title: 'Pokedexter: Make Move',
    description: 'Submit your battle action. Format: "move 1", "move 2", "switch 3", "move 1 terastallize", etc. Check battle state first to see available moves and switches.',
    _meta: {
      category: 'games.pokedexter',
      access: 'member',
      tags: ['pokedexter', 'battle', 'move', 'free'],
    },
    inputSchema: {
      type: 'object',
      properties: {
        battleId: {
          type: 'string',
          description: 'The battle room ID from your wager/challenge response',
        },
        choice: {
          type: 'string',
          description: 'Your action: "move 1", "move 2", "switch 3", "move 1 terastallize", "pass", etc.',
        },
      },
      required: ['battleId', 'choice'],
    },
  }, async (args, extra) => {
    const { battleId, choice } = args;
    
    if (!battleId || !choice) {
      throw new Error('battleId and choice are required');
    }

    const walletAddress = resolveWalletAddress(extra);
    const headers = {};
    if (walletAddress) {
      headers['x-self-fee-payer-address'] = walletAddress;
    }

    const result = await callPokedexterApi(`/api/pokedexter/battles/${battleId}/move`, {
      method: 'POST',
      body: { choice },
      headers,
    });

    if (!result.ok) {
      throw new Error(result.data?.error || 'make_move_failed');
    }

    return {
      structuredContent: result.data,
      content: [{ type: 'text', text: JSON.stringify(result.data) }],
    };
  });

  /**
   * Get active wager
   */
  server.registerTool('pokedexter_get_active_wager', {
    title: 'Pokedexter: Get Active Wager',
    description: 'Get details about your currently active wagered battle, including escrow status, opponent, and battle room ID.',
    _meta: {
      category: 'games.pokedexter',
      access: 'member',
      tags: ['pokedexter', 'wager', 'status', 'free'],
    },
    inputSchema: {
      type: 'object',
      properties: {},
    },
  }, async (args, extra) => {
    const walletAddress = resolveWalletAddress(extra);
    const headers = {};
    if (walletAddress) {
      headers['x-self-fee-payer-address'] = walletAddress;
    }

    const result = await callPokedexterApi('/api/pokedexter/wager/active', {
      headers,
    });

    if (!result.ok) {
      throw new Error(result.data?.error || 'get_active_wager_failed');
    }

    return {
      structuredContent: result.data,
      content: [{ type: 'text', text: JSON.stringify(result.data) }],
    };
  });

  /**
   * Get wager status by ID
   */
  server.registerTool('pokedexter_get_wager_status', {
    title: 'Pokedexter: Get Wager Status',
    description: 'Check the status of a specific wager by ID. Use this to verify escrow deposits, see settlement status, or check if a battle is complete.',
    _meta: {
      category: 'games.pokedexter',
      access: 'member',
      tags: ['pokedexter', 'wager', 'status', 'free'],
    },
    inputSchema: {
      type: 'object',
      properties: {
        wagerId: {
          type: 'string',
          description: 'The wager ID to look up',
        },
      },
      required: ['wagerId'],
    },
  }, async (args, extra) => {
    const { wagerId } = args;
    
    if (!wagerId) {
      throw new Error('wagerId is required');
    }

    const walletAddress = resolveWalletAddress(extra);
    const headers = {};
    if (walletAddress) {
      headers['x-self-fee-payer-address'] = walletAddress;
    }

    const result = await callPokedexterApi(`/api/pokedexter/wager/${wagerId}`, {
      headers,
    });

    if (!result.ok) {
      throw new Error(result.data?.error || 'get_wager_status_failed');
    }

    return {
      structuredContent: result.data,
      content: [{ type: 'text', text: JSON.stringify(result.data) }],
    };
  });

  console.log('[pokedexter] Local bridge toolset registered (4 free battle tools)');
}
