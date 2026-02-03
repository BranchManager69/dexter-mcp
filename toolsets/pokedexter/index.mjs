/**
 * Pokedexter Local Bridge Toolset
 * 
 * ALL Pokedexter tools are FREE for Dexter MCP users.
 * External agents (not using Dexter MCP) pay 1 cent via x402 versions.
 * 
 * This toolset loads BEFORE x402, so MCP users get these free versions
 * and the x402 duplicates are skipped.
 * 
 * CRITICAL: For wagered battles, agents must be "connected" to PokeDexter
 * as fake users in the Users.users map. This is done automatically via
 * the /api/v1/agent/connect endpoint when creating/accepting challenges.
 */

import { z } from 'zod';

const DEXTER_API_URL = process.env.DEXTER_API_URL || 'https://api.dexter.cash';
const POKEDEXTER_API_URL = process.env.POKEDEXTER_API_URL || 'https://poke.dexter.cash';

// Track connected agents to avoid redundant connection calls
const connectedAgents = new Set();

/**
 * Call Pokedexter API directly (bypassing dexter-api x402 protection)
 * Used for local bridge tools that should be free for MCP users
 */
async function callPokedexterDirect(path, options = {}) {
  const url = `${POKEDEXTER_API_URL}${path}`;
  
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
    console.error('[pokedexter] direct_call_error:', error?.message || error);
    return { 
      ok: false, 
      status: 502, 
      data: { success: false, error: error?.message || 'pokedexter_unavailable' } 
    };
  }
}

/**
 * Proxy request to Dexter API (for x402-protected routes when user pays)
 * Note: Most local bridge tools should use callPokedexterDirect instead
 */
async function callDexterApi(path, options = {}) {
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
    console.error('[pokedexter] dexter_api_error:', error?.message || error);
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

/**
 * Ensure agent is connected to PokeDexter as a "fake user".
 * 
 * This is REQUIRED for wagered battles - the deposit monitor checks Users.get()
 * when starting a battle, and returns refunds if players aren't found.
 * 
 * @param {string} agentId - The agent's user ID (e.g., "agent_ml68b98l")
 * @returns {Promise<boolean>} - Whether connection succeeded
 */
async function ensureAgentConnected(agentId) {
  // Skip if already connected in this session
  if (connectedAgents.has(agentId)) {
    console.log(`[pokedexter] Agent ${agentId} already connected (cached)`);
    return true;
  }

  try {
    console.log(`[pokedexter] Connecting agent ${agentId} to PokeDexter...`);
    
    const response = await fetch(`${POKEDEXTER_API_URL}/api/v1/agent/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, name: agentId }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      connectedAgents.add(agentId);
      console.log(`[pokedexter] Agent ${agentId} connected successfully`);
      return true;
    }

    console.warn(`[pokedexter] Agent connect failed: ${data.error?.message || 'unknown'}`);
    return false;
  } catch (error) {
    console.error(`[pokedexter] Agent connect error: ${error?.message || error}`);
    return false;
  }
}

export async function registerPokedexterToolset(server) {
  // ============================================================================
  // FREE TOOLS (local bridge versions)
  // These take precedence over x402 versions for MCP users
  // ============================================================================

  /**
   * List open challenges (free for MCP users)
   * Calls poke.dexter.cash directly to bypass x402 protection
   */
  server.registerTool('pokedexter_list_challenges', {
    title: 'Pokedexter: List Open Challenges',
    description: 'List all open wagered Pokémon battle challenges you can accept. Shows challenger, wager amount ($1-$25), format, and expiration time.',
    _meta: {
      category: 'games.pokedexter',
      access: 'member',
      tags: ['pokedexter', 'matchmaking', 'challenges', 'free'],
    },
    inputSchema: {},
  }, async (args, extra) => {
    const result = await callPokedexterDirect('/api/v1/matchmaking/challenges');

    if (!result.ok) {
      throw new Error(result.data?.error || 'list_challenges_failed');
    }

    return {
      structuredContent: result.data,
      content: [{ type: 'text', text: JSON.stringify(result.data) }],
    };
  });

  /**
   * Get current battle state via WebSocket connection
   * Uses dexter-api's WebSocket manager for real-time battle state
   */
  server.registerTool('pokedexter_get_battle_state', {
    title: 'Pokedexter: Get Battle State',
    description: 'Get the current state of your active Pokémon battle including your team, opponent info, field conditions, and available moves. Uses WebSocket for real-time data. Use this before each turn to see what actions are available.',
    _meta: {
      category: 'games.pokedexter',
      access: 'member',
      tags: ['pokedexter', 'battle', 'state', 'free'],
    },
    inputSchema: {
      battleId: z.string().min(1).describe('The battle room ID from your wager/challenge response'),
      side: z.enum(['p1', 'p2']).optional().describe('Which side you are playing as (default: p1)'),
    },
  }, async (args, extra) => {
    const { battleId, side = 'p1' } = args;
    
    if (!battleId) {
      throw new Error('battleId is required');
    }

    // Get real-time battle state via dexter-api WebSocket manager
    const result = await callDexterApi(`/api/pokedexter/battles/${battleId}/state?side=${side}`);

    if (!result.ok || !result.data?.ok) {
      throw new Error(result.data?.error || 'get_battle_state_failed');
    }

    return {
      structuredContent: result.data,
      content: [{ type: 'text', text: result.data.prompt || JSON.stringify(result.data) }],
    };
  });

  /**
   * Submit a move in battle via WebSocket
   * Uses dexter-api's WebSocket manager to send moves to the battle server
   */
  server.registerTool('pokedexter_make_move', {
    title: 'Pokedexter: Make Move',
    description: 'Submit your battle action via WebSocket. Format: "move 1", "move 2", "switch 3", "move 1 terastallize", etc. Call get_battle_state first to see available moves.',
    _meta: {
      category: 'games.pokedexter',
      access: 'member',
      tags: ['pokedexter', 'battle', 'move', 'free'],
    },
    inputSchema: {
      battleId: z.string().min(1).describe('The battle room ID from your wager/challenge response'),
      choice: z.string().min(1).describe('Your action: "move 1", "move 2", "switch 3", "move 1 terastallize", "pass", "default", etc.'),
    },
  }, async (args, extra) => {
    const { battleId, choice } = args;
    
    if (!battleId || !choice) {
      throw new Error('battleId and choice are required');
    }

    // Submit move via dexter-api WebSocket manager
    const result = await callDexterApi(`/api/pokedexter/battles/${battleId}/move`, {
      method: 'POST',
      body: { choice },
    });

    if (!result.ok || !result.data?.ok) {
      throw new Error(result.data?.error || 'make_move_failed');
    }

    return {
      structuredContent: result.data,
      content: [{ type: 'text', text: `Move submitted: ${choice}. Turn: ${result.data.turn || 'unknown'}, Phase: ${result.data.phase || 'unknown'}` }],
    };
  });

  /**
   * Get active wager
   * Calls poke.dexter.cash directly
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
      userId: z.string().optional().describe('Optional: Your Pokedexter user ID. If not provided, derived from wallet address.'),
    },
  }, async (args, extra) => {
    const walletAddress = resolveWalletAddress(extra);
    const userId = args.userId || deriveUserId(walletAddress);

    const result = await callPokedexterDirect(`/api/v1/wager/active?userId=${encodeURIComponent(userId)}`);

    if (!result.ok) {
      throw new Error(result.data?.error || 'get_active_wager_failed');
    }

    return {
      structuredContent: { ok: true, ...result.data },
      content: [{ type: 'text', text: JSON.stringify({ ok: true, ...result.data }) }],
    };
  });

  /**
   * Get wager status by ID
   * Calls poke.dexter.cash directly
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
      wagerId: z.string().min(1).describe('The wager ID to look up'),
    },
  }, async (args, extra) => {
    const { wagerId } = args;
    
    if (!wagerId) {
      throw new Error('wagerId is required');
    }

    const result = await callPokedexterDirect(`/api/v1/wager/${wagerId}`);

    if (!result.ok) {
      throw new Error(result.data?.error || 'get_wager_status_failed');
    }

    return {
      structuredContent: { ok: true, ...result.data },
      content: [{ type: 'text', text: JSON.stringify({ ok: true, ...result.data }) }],
    };
  });

  // ============================================================================
  // ENTRY POINT TOOLS (also free for MCP users)
  // ============================================================================

  /**
   * Create a wagered battle challenge
   */
  server.registerTool('pokedexter_create_challenge', {
    title: 'Pokedexter: Create Challenge',
    description: 'Create an open wagered Pokémon battle challenge. Set your wager ($1-$25) and format. Other players can accept. Winner takes 100% of the pot (0% house cut).',
    _meta: {
      category: 'games.pokedexter',
      access: 'member',
      tags: ['pokedexter', 'matchmaking', 'challenge', 'free'],
    },
    inputSchema: {
      amount: z.number().min(1).max(25).describe('Wager amount in USD ($1-$25)'),
      format: z.string().optional().describe('Battle format (default: gen9randombattle)'),
    },
  }, async (args, extra) => {
    const { amount, format = 'gen9randombattle' } = args;
    
    if (!amount || amount < 1 || amount > 25) {
      throw new Error('amount must be between $1 and $25');
    }

    const walletAddress = resolveWalletAddress(extra);
    const userId = deriveUserId(walletAddress);

    // CRITICAL: Connect agent to PokeDexter BEFORE creating challenge
    // This registers the agent in Users.users so the battle can start when deposits confirm
    await ensureAgentConnected(userId);

    const result = await callPokedexterDirect('/api/v1/matchmaking/challenges', {
      method: 'POST',
      body: {
        userId,
        amount,
        format,
        wallet: walletAddress,
      },
    });

    if (!result.ok) {
      throw new Error(result.data?.error?.message || result.data?.error || 'create_challenge_failed');
    }

    return {
      structuredContent: { ok: true, ...result.data, agentConnected: connectedAgents.has(userId) },
      content: [{ type: 'text', text: JSON.stringify({ ok: true, ...result.data }) }],
    };
  });

  /**
   * Accept an open challenge
   */
  server.registerTool('pokedexter_accept_challenge', {
    title: 'Pokedexter: Accept Challenge',
    description: 'Accept an open wagered battle challenge. Returns escrow deposit instructions and battle room ID.',
    _meta: {
      category: 'games.pokedexter',
      access: 'member',
      tags: ['pokedexter', 'matchmaking', 'accept', 'free'],
    },
    inputSchema: {
      challengeId: z.string().min(1).describe('The challenge ID to accept (from list_challenges)'),
    },
  }, async (args, extra) => {
    const { challengeId } = args;
    
    if (!challengeId) {
      throw new Error('challengeId is required');
    }

    const walletAddress = resolveWalletAddress(extra);
    const userId = deriveUserId(walletAddress);

    // CRITICAL: Connect agent to PokeDexter BEFORE accepting challenge
    // This registers the agent in Users.users so the battle can start when deposits confirm
    await ensureAgentConnected(userId);

    const result = await callPokedexterDirect(`/api/v1/matchmaking/challenges/${challengeId}/accept`, {
      method: 'POST',
      body: {
        userId,
        wallet: walletAddress,
      },
    });

    if (!result.ok) {
      throw new Error(result.data?.error?.message || result.data?.error || 'accept_challenge_failed');
    }

    return {
      structuredContent: { ok: true, ...result.data, agentConnected: connectedAgents.has(userId) },
      content: [{ type: 'text', text: JSON.stringify({ ok: true, ...result.data }) }],
    };
  });

  /**
   * Join quick match queue
   */
  server.registerTool('pokedexter_join_queue', {
    title: 'Pokedexter: Join Quick Match',
    description: 'Join the quick match queue for instant wagered battles. Set your wager ($1-$25) and format. You\'ll be matched with another player at the same stake.',
    _meta: {
      category: 'games.pokedexter',
      access: 'member',
      tags: ['pokedexter', 'matchmaking', 'queue', 'free'],
    },
    inputSchema: {
      amount: z.number().min(1).max(25).describe('Wager amount in USD ($1-$25)'),
      format: z.string().optional().describe('Battle format (default: gen9randombattle)'),
    },
  }, async (args, extra) => {
    const { amount, format = 'gen9randombattle' } = args;
    
    if (!amount || amount < 1 || amount > 25) {
      throw new Error('amount must be between $1 and $25');
    }

    const walletAddress = resolveWalletAddress(extra);
    const userId = deriveUserId(walletAddress);

    // CRITICAL: Connect agent to PokeDexter BEFORE joining queue
    // This registers the agent in Users.users so the battle can start when matched
    await ensureAgentConnected(userId);

    const result = await callPokedexterDirect('/api/v1/matchmaking/queue', {
      method: 'POST',
      body: {
        userId,
        amount,
        format,
        wallet: walletAddress,
      },
    });

    if (!result.ok) {
      throw new Error(result.data?.error?.message || result.data?.error || 'join_queue_failed');
    }

    return {
      structuredContent: { ok: true, ...result.data, agentConnected: connectedAgents.has(userId) },
      content: [{ type: 'text', text: JSON.stringify({ ok: true, ...result.data }) }],
    };
  });

  /**
   * Check queue status
   */
  server.registerTool('pokedexter_queue_status', {
    title: 'Pokedexter: Queue Status',
    description: 'Check your position in the quick match queue and see if you\'ve been matched.',
    _meta: {
      category: 'games.pokedexter',
      access: 'member',
      tags: ['pokedexter', 'matchmaking', 'status', 'free'],
    },
    inputSchema: {
      userId: z.string().optional().describe('Optional: Your Pokedexter user ID. If not provided, derived from wallet address.'),
    },
  }, async (args, extra) => {
    const walletAddress = resolveWalletAddress(extra);
    const userId = args.userId || deriveUserId(walletAddress);

    const result = await callPokedexterDirect(`/api/v1/matchmaking/queue/status?userId=${encodeURIComponent(userId)}`);

    if (!result.ok) {
      throw new Error(result.data?.error || 'queue_status_failed');
    }

    return {
      structuredContent: { ok: true, ...result.data },
      content: [{ type: 'text', text: JSON.stringify({ ok: true, ...result.data }) }],
    };
  });

  console.log('[pokedexter] Local bridge toolset registered (9 free tools with agent auto-connect)');
}
