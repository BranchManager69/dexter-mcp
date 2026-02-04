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
import { createWidgetMeta } from '../widgetMeta.mjs';

const POKEDEXTER_WIDGET_META = createWidgetMeta({
  templateUri: 'ui://dexter/pokedexter',
  widgetDescription: 'Shows open challenges, wager matches, queue position, and battle deposits.',
  invoking: 'Loading battles…',
  invoked: 'Battles ready',
});

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
    annotations: {
      readOnlyHint: true,
    },
    _meta: {
      category: 'games.pokedexter',
      access: 'member',
      tags: ['pokedexter', 'matchmaking', 'challenges', 'free'],
      ...POKEDEXTER_WIDGET_META,
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
   * Get current battle state with YOUR actual moves and team data.
   * Calls PokeDexter directly to get the agent's request data.
   */
  server.registerTool('pokedexter_get_battle_state', {
    title: 'Pokedexter: Get Battle State',
    description: 'Get YOUR battle state including your actual moves, team, and available actions. Use this before each turn to see what you can do.',
    annotations: {
      readOnlyHint: true,
    },
    _meta: {
      category: 'games.pokedexter',
      access: 'member',
      tags: ['pokedexter', 'battle', 'state', 'free'],
      ...POKEDEXTER_WIDGET_META,
    },
    inputSchema: {
      battleId: z.string().min(1).describe('The battle room ID'),
    },
  }, async (args, extra) => {
    const { battleId } = args;
    
    if (!battleId) {
      throw new Error('battleId is required');
    }

    // 1. Resolve room mapping FIRST - it contains the actual agent IDs
    const mappingResult = await callPokedexterDirect(`/api/v1/agent/battle/${battleId}/resolve`);
    const mapping = mappingResult.ok && mappingResult.data?.success ? mappingResult.data : null;
    const actualRoomId = mapping?.actualRoomId || battleId;
    
    // 2. Get agent ID from the mapping (NOT derived fresh - that creates mismatches!)
    // API returns: player1: { id, isAgent }, player2: { id, isAgent }
    let agentId = null;
    let playerSlot = null;
    
    if (mapping?.player1?.isAgent) {
      agentId = mapping.player1.id;
      playerSlot = 'p1';
    } else if (mapping?.player2?.isAgent) {
      agentId = mapping.player2.id;
      playerSlot = 'p2';
    } else {
      // Fallback: try to derive from wallet (less reliable)
      const walletAddress = resolveWalletAddress(extra);
      agentId = deriveUserId(walletAddress);
      playerSlot = mapping?.player1?.id === agentId ? 'p1' : (mapping?.player2?.id === agentId ? 'p2' : null);
    }
    
    console.log(`[pokedexter] get_battle_state: battleId=${battleId}, agentId=${agentId}, slot=${playerSlot}`);
    console.log(`[pokedexter] Room: ${battleId} -> ${actualRoomId}`);

    // 2. Get YOUR actual request data (moves, team, etc.)
    const requestResult = await callPokedexterDirect(`/api/v1/agent/battle/${actualRoomId}/request?agentId=${encodeURIComponent(agentId)}`);
    const req = requestResult.ok ? requestResult.data : null;
    
    console.log(`[pokedexter] Request: hasRequest=${req?.hasRequest}, type=${req?.requestType}`);

    // Build response
    const response = {
      ok: true,
      battleId,
      actualRoomId,
      agentId,
      playerSlot: req?.playerSlot || playerSlot,
    };

    if (req?.hasRequest) {
      response.requestType = req.requestType;
      response.rqid = req.rqid;
      response.yourTeam = req.team || [];
      response.yourMoves = req.moves || [];
      response.yourSwitches = req.switches || [];
      response.playerName = req.playerName;
      
      const active = req.team?.find(p => p.active);
      if (active) response.yourActive = active;
      
      response.availableActions = {
        canMove: req.requestType === 'move' && req.moves?.some(m => m.canUse),
        moves: req.moves || [],
        canSwitch: req.switches?.length > 0,
        switches: req.switches || [],
        forceSwitch: req.forceSwitch || false,
        trapped: req.trapped || false,
      };
      
      // Opponent info from battle log parsing
      if (req.opponent) {
        response.opponent = req.opponent;
      }
    } else {
      response.waiting = true;
      response.message = req?.message || 'No pending request - waiting for turn or battle to start';
    }

    // Generate prompt
    const prompt = formatBattlePrompt(response);

    return {
      structuredContent: response,
      content: [{ type: 'text', text: prompt }],
    };
  });

  function formatBattlePrompt(state) {
    const lines = [];
    lines.push(`=== POKEMON BATTLE ===`);
    lines.push(`Agent: ${state.agentId} | Slot: ${state.playerSlot || '?'} | Room: ${state.actualRoomId}`);
    lines.push('');
    
    if (state.waiting) {
      lines.push(state.message || 'Waiting for turn...');
      return lines.join('\n');
    }
    
    if (state.yourActive) {
      const p = state.yourActive;
      const typeStr = p.types?.length ? ` (${p.types.join('/')})` : '';
      lines.push(`YOUR ACTIVE: ${p.name}${typeStr} - ${p.hpPercent}% HP${p.status ? ` [${p.status}]` : ''}`);
      if (p.ability) lines.push(`  Ability: ${p.ability}`);
      if (p.item) lines.push(`  Item: ${p.item}`);
      lines.push('');
    }
    
    // Show opponent info (from battle log - what you can actually see)
    if (state.opponent) {
      const opp = state.opponent;
      if (opp.activePokemon) {
        const activeMon = opp.team?.find(p => p.active);
        const activeHp = activeMon ? `${activeMon.hp}% HP` : '?';
        const typeStr = opp.activeTypes?.length ? ` (${opp.activeTypes.join('/')})` : '';
        lines.push(`OPPONENT ACTIVE: ${opp.activePokemon}${typeStr} - ${activeHp}`);
      }
      if (opp.team?.length > 0) {
        lines.push(`OPPONENT TEAM (${opp.remainingCount}/${opp.revealedCount} alive, ${6 - opp.revealedCount} unrevealed):`);
        for (const p of opp.team) {
          const status = p.fainted ? '[FAINTED]' : (p.active ? '(active)' : '');
          const typeStr = p.types?.length ? ` (${p.types.join('/')})` : '';
          lines.push(`  - ${p.species}${typeStr} - ${p.hp}% HP ${status}`);
        }
      } else {
        lines.push(`OPPONENT: No Pokemon revealed yet`);
      }
      lines.push('');
    }
    
    if (state.yourTeam?.length) {
      lines.push('YOUR TEAM:');
      for (const p of state.yourTeam) {
        const status = p.fainted ? '[FAINTED]' : (p.status ? `[${p.status}]` : '');
        const typeStr = p.types?.length ? `(${p.types.join('/')})` : '';
        lines.push(`  ${p.slot}. ${p.name} ${typeStr} - ${p.hpPercent}% HP ${status}${p.active ? ' (active)' : ''}`);
        lines.push(`     Ability: ${p.ability || '?'} | Item: ${p.item || 'none'}`);
        if (p.moves?.length) {
          lines.push(`     Moves: ${p.moves.join(', ')}`);
        }
      }
      lines.push('');
    }
    
    if (state.availableActions?.moves?.length) {
      lines.push('MOVES:');
      for (const m of state.availableActions.moves) {
        // Format effectiveness
        let effStr = '';
        if (m.effectiveness !== undefined && m.effectiveness !== 1) {
          if (m.effectiveness === 0) effStr = ' → IMMUNE';
          else if (m.effectiveness === 0.25) effStr = ' → 0.25x';
          else if (m.effectiveness === 0.5) effStr = ' → 0.5x';
          else if (m.effectiveness === 2) effStr = ' → 2x';
          else if (m.effectiveness === 4) effStr = ' → 4x';
        }
        const typeInfo = m.type && m.type !== 'Unknown' ? `${m.type}` : '';
        const bpInfo = m.basePower > 0 ? `, ${m.basePower} BP` : '';
        const moveTypeStr = typeInfo ? ` (${typeInfo}${bpInfo})` : '';
        lines.push(`  ${m.slot}. ${m.name}${moveTypeStr}${effStr} (PP: ${m.pp}/${m.maxpp})${m.canUse ? '' : ' [DISABLED]'}`);
      }
      lines.push('');
    }
    
    if (state.availableActions?.switches?.length) {
      lines.push('SWITCHES:');
      for (const s of state.availableActions.switches) {
        lines.push(`  ${s.slot}. ${s.name} - ${s.hpPercent}% HP`);
      }
      lines.push('');
    }
    
    if (state.availableActions?.forceSwitch) {
      lines.push('*** MUST SWITCH ***');
    } else if (state.availableActions?.canMove) {
      lines.push('Use: "move N" or "switch N"');
    }
    
    return lines.join('\n');
  }

  /**
   * Submit a move in battle.
   * Calls PokeDexter directly with the correct agent ID.
   */
  server.registerTool('pokedexter_make_move', {
    title: 'Pokedexter: Make Move',
    description: 'Submit your battle action. Use "move 1", "move 2", "switch 3", etc. Call get_battle_state first to see available moves.',
    annotations: {
      readOnlyHint: false,
      openWorldHint: false,  // Bounded to user's own battle
      destructiveHint: false,
    },
    _meta: {
      category: 'games.pokedexter',
      access: 'member',
      tags: ['pokedexter', 'battle', 'move', 'free'],
      ...POKEDEXTER_WIDGET_META,
    },
    inputSchema: {
      battleId: z.string().min(1).describe('The battle room ID'),
      choice: z.string().min(1).describe('Your action: "move 1", "switch 3", "move 2 terastallize", etc.'),
    },
  }, async (args, extra) => {
    const { battleId, choice } = args;
    
    if (!battleId || !choice) {
      throw new Error('battleId and choice are required');
    }

    // Resolve room mapping FIRST - it contains the actual agent IDs
    const mappingResult = await callPokedexterDirect(`/api/v1/agent/battle/${battleId}/resolve`);
    const mapping = mappingResult.ok && mappingResult.data?.success ? mappingResult.data : null;
    const actualRoomId = mapping?.actualRoomId || battleId;
    
    // Get agent ID from the mapping (NOT derived fresh!)
    // API returns: player1: { id, isAgent }, player2: { id, isAgent }
    let agentId = null;
    
    if (mapping?.player1?.isAgent) {
      agentId = mapping.player1.id;
    } else if (mapping?.player2?.isAgent) {
      agentId = mapping.player2.id;
    } else {
      // Fallback: try to derive from wallet
      const walletAddress = resolveWalletAddress(extra);
      agentId = deriveUserId(walletAddress);
    }
    
    console.log(`[pokedexter] make_move: battleId=${battleId}, agentId=${agentId}, choice=${choice}`);

    // Submit move via PokeDexter agent API (writes to battle.stream.write)
    const result = await callPokedexterDirect(`/api/v1/agent/battle/${actualRoomId}/move`, {
      method: 'POST',
      body: {
        agentId,
        choice,
      },
    });

    if (!result.ok || !result.data?.success) {
      const errMsg = result.data?.error?.message || result.data?.error || 'make_move_failed';
      throw new Error(errMsg);
    }

    return {
      structuredContent: result.data,
      content: [{ type: 'text', text: `Move submitted: ${choice}` }],
    };
  });

  /**
   * Get active wager
   * Calls poke.dexter.cash directly
   */
  server.registerTool('pokedexter_get_active_wager', {
    title: 'Pokedexter: Get Active Wager',
    description: 'Get details about your currently active wagered battle, including escrow status, opponent, and battle room ID.',
    annotations: {
      readOnlyHint: true,
    },
    _meta: {
      category: 'games.pokedexter',
      access: 'member',
      tags: ['pokedexter', 'wager', 'status', 'free'],
      ...POKEDEXTER_WIDGET_META,
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
    annotations: {
      readOnlyHint: true,
    },
    _meta: {
      category: 'games.pokedexter',
      access: 'member',
      tags: ['pokedexter', 'wager', 'status', 'free'],
      ...POKEDEXTER_WIDGET_META,
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
    annotations: {
      readOnlyHint: false,
      openWorldHint: false,  // Bounded to Pokedexter system
      destructiveHint: true,  // Involves money escrow
    },
    _meta: {
      category: 'games.pokedexter',
      access: 'member',
      tags: ['pokedexter', 'matchmaking', 'challenge', 'free'],
      ...POKEDEXTER_WIDGET_META,
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
    annotations: {
      readOnlyHint: false,
      openWorldHint: false,  // Bounded to Pokedexter system
      destructiveHint: true,  // Involves money escrow
    },
    _meta: {
      category: 'games.pokedexter',
      access: 'member',
      tags: ['pokedexter', 'matchmaking', 'accept', 'free'],
      ...POKEDEXTER_WIDGET_META,
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
    annotations: {
      readOnlyHint: false,
      openWorldHint: false,  // Bounded to Pokedexter system
      destructiveHint: true,  // Involves money escrow when matched
    },
    _meta: {
      category: 'games.pokedexter',
      access: 'member',
      tags: ['pokedexter', 'matchmaking', 'queue', 'free'],
      ...POKEDEXTER_WIDGET_META,
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
    annotations: {
      readOnlyHint: true,
    },
    _meta: {
      category: 'games.pokedexter',
      access: 'member',
      tags: ['pokedexter', 'matchmaking', 'status', 'free'],
      ...POKEDEXTER_WIDGET_META,
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
