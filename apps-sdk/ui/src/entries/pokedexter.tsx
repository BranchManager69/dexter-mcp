import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/pokedexter.css';

import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { useOpenAIGlobal, useCallTool, useTheme, useOpenExternal } from '../sdk';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Challenge = {
  id: string;
  challengerId?: string;
  challengerWallet?: string;
  amount: number;
  format?: string;
  expiresAt?: string | number;
  status?: string;
};

type WagerStatus = {
  wagerId?: string;
  id?: string;
  status?: string;
  amount?: number;
  player1?: { wallet?: string; userId?: string; deposited?: boolean };
  player2?: { wallet?: string; userId?: string; deposited?: boolean };
  battleRoomId?: string;
  roomId?: string;
  winner?: string;
  escrowAddress?: string;
};

type QueueStatus = {
  position?: number;
  queueSize?: number;
  matched?: boolean;
  battleRoomId?: string;
  roomId?: string;
  amount?: number;
  format?: string;
};

type PokemonMove = {
  slot: number;
  name: string;
  type?: string;
  basePower?: number;
  pp: number;
  maxpp: number;
  canUse: boolean;
  effectiveness?: number;
};

type Pokemon = {
  slot: number;
  name: string;
  species?: string;
  types?: string[];
  hpPercent: number;
  hp?: number;
  maxhp?: number;
  status?: string;
  active?: boolean;
  fainted?: boolean;
  ability?: string;
  item?: string;
  moves?: string[];
};

type OpponentInfo = {
  activePokemon?: string;
  activeTypes?: string[];
  team?: Array<{ species: string; types?: string[]; hp: number; fainted?: boolean; active?: boolean }>;
  remainingCount?: number;
  revealedCount?: number;
};

type AvailableActions = {
  canMove: boolean;
  moves: PokemonMove[];
  canSwitch: boolean;
  switches: Pokemon[];
  forceSwitch: boolean;
  trapped: boolean;
};

type BattleStateData = {
  ok?: boolean;
  battleId?: string;
  actualRoomId?: string;
  agentId?: string;
  playerSlot?: string;
  playerName?: string;
  requestType?: string;
  rqid?: number;
  yourTeam?: Pokemon[];
  yourMoves?: PokemonMove[];
  yourSwitches?: Pokemon[];
  yourActive?: Pokemon;
  opponent?: OpponentInfo;
  availableActions?: AvailableActions;
  waiting?: boolean;
  message?: string;
  // Old deposit-based battle state
  deposits?: { player1?: { deposited?: boolean }; player2?: { deposited?: boolean } };
  totalPot?: number;
};

type MoveResult = {
  ok?: boolean;
  submitted?: string;
  battleId?: string;
  note?: string;
};

type PokedexterPayload = {
  ok?: boolean;
  error?: string;
  challenges?: Challenge[];
  data?: Challenge[];
  wagerId?: string;
  challengeId?: string;
  battleRoomId?: string;
  roomId?: string;
  amount?: number;
  format?: string;
  escrowAddress?: string;
  position?: number;
  depositRequired?: boolean;
} & Partial<WagerStatus> & Partial<QueueStatus> & Partial<BattleStateData> & Partial<MoveResult>;

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  normal: '#A8A878', fire: '#F08030', water: '#6890F0', electric: '#F8D030',
  grass: '#78C850', ice: '#98D8D8', fighting: '#C03028', poison: '#A040A0',
  ground: '#E0C068', flying: '#A890F0', psychic: '#F85888', bug: '#A8B820',
  rock: '#B8A038', ghost: '#705898', dragon: '#7038F8', dark: '#705848',
  steel: '#B8B8D0', fairy: '#EE99AC', '???': '#68A090',
};

const STATUS_ICONS: Record<string, string> = {
  brn: '🔥', psn: '☠️', tox: '☠️', par: '⚡', slp: '💤', frz: '❄️', confusion: '💫',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function abbreviate(value?: string, len = 8): string {
  if (!value) return '—';
  if (value.length <= len * 2 + 3) return value;
  return `${value.slice(0, len)}...${value.slice(-4)}`;
}

function toShowdownId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^nidoran.*/, n => n.includes('f') ? 'nidoranf' : 'nidoranm');
}

function getSpriteUrl(pokemon: string, back = false): string {
  const id = toShowdownId(pokemon);
  const dir = back ? 'ani-back' : 'ani';
  return `https://play.pokemonshowdown.com/sprites/${dir}/${id}.gif`;
}

function getTypeColor(type?: string): string {
  if (!type) return TYPE_COLORS['???'];
  return TYPE_COLORS[type.toLowerCase()] || TYPE_COLORS['???'];
}

function getEffectivenessLabel(eff?: number): { label: string; color: string } | null {
  if (eff === undefined || eff === 1) return null;
  if (eff === 0) return { label: 'IMMUNE', color: '#525252' };
  if (eff === 0.25) return { label: '¼×', color: '#ef4444' };
  if (eff === 0.5) return { label: '½×', color: '#f97316' };
  if (eff === 2) return { label: '2×', color: '#22c55e' };
  if (eff === 4) return { label: '4×', color: '#10b981' };
  return null;
}

function getHpColor(percent: number): string {
  if (percent > 50) return '#22c55e';
  if (percent > 25) return '#eab308';
  return '#ef4444';
}

function detectViewType(payload: PokedexterPayload): string {
  // New battle state with actual Pokemon data
  if (payload.yourTeam || payload.yourMoves || payload.availableActions || payload.yourActive) return 'battlefield';
  if (payload.waiting && payload.battleId) return 'battlefield';
  // Legacy views
  if (payload.challenges || payload.data) return 'challenges';
  if (payload.submitted !== undefined) return 'move';
  if (payload.matched !== undefined || payload.position !== undefined) return 'queue';
  if (payload.deposits) return 'deposits';
  if (payload.winner || payload.player1 || payload.player2) return 'wager_status';
  if (payload.challengeId || payload.wagerId || payload.battleRoomId || payload.roomId) return 'success';
  return 'unknown';
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable Components
// ─────────────────────────────────────────────────────────────────────────────

function PokeballIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="15" fill="#fff" stroke="#333" strokeWidth="2"/>
      <path d="M1 16h30" stroke="#333" strokeWidth="2"/>
      <path d="M1 16a15 15 0 0 1 30 0" fill="#ef4444"/>
      <circle cx="16" cy="16" r="5" fill="#fff" stroke="#333" strokeWidth="2"/>
      <circle cx="16" cy="16" r="2.5" fill="#333"/>
    </svg>
  );
}

function PokeBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; className: string }> = {
    pending: { label: 'Pending', className: 'poke-badge--warning' },
    active: { label: 'Active', className: 'poke-badge--success' },
    matched: { label: 'Matched!', className: 'poke-badge--info' },
    completed: { label: 'Completed', className: 'poke-badge--primary' },
    cancelled: { label: 'Cancelled', className: 'poke-badge--neutral' },
    waiting: { label: 'In Queue', className: 'poke-badge--cyan' },
    confirmed: { label: 'Confirmed', className: 'poke-badge--success' },
    yourturn: { label: 'Your Turn!', className: 'poke-badge--success' },
  };
  const config = configs[status.toLowerCase()] || configs.pending;
  return <span className={`poke-badge ${config.className}`}>{config.label}</span>;
}

function WagerAmount({ amount, size = 'md' }: { amount: number; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = { sm: 'poke-wager--sm', md: 'poke-wager--md', lg: 'poke-wager--lg' }[size];
  return (
    <div className={`poke-wager ${sizeClass}`}>
      <span className="poke-wager__value">${amount}</span>
      <span className="poke-wager__unit">USDC</span>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="poke-type-badge" style={{ backgroundColor: getTypeColor(type) }}>
      {type.toUpperCase()}
    </span>
  );
}

function HpBar({ percent, size = 'md' }: { percent: number; size?: 'sm' | 'md' }) {
  const color = getHpColor(percent);
  return (
    <div className={`poke-hp-bar poke-hp-bar--${size}`}>
      <div className="poke-hp-bar__fill" style={{ width: `${Math.max(0, Math.min(100, percent))}%`, backgroundColor: color }} />
      <span className="poke-hp-bar__text">{Math.round(percent)}%</span>
    </div>
  );
}

function PokemonSprite({ name, back = false, size = 96, fainted = false }: { name: string; back?: boolean; size?: number; fainted?: boolean }) {
  const [error, setError] = useState(false);
  const url = getSpriteUrl(name, back);
  
  if (error) {
    return <div className="poke-sprite-fallback" style={{ width: size, height: size }}>?</div>;
  }
  
  return (
    <img 
      src={url} 
      alt={name}
      className={`poke-sprite ${fainted ? 'poke-sprite--fainted' : ''}`}
      style={{ width: size, height: size }}
      onError={() => setError(true)}
    />
  );
}

function TeamIndicator({ team }: { team: Pokemon[] }) {
  const slots = [0, 1, 2, 3, 4, 5];
  return (
    <div className="poke-team-indicator">
      {slots.map(i => {
        const mon = team[i];
        const alive = mon && !mon.fainted;
        return (
          <div key={i} className={`poke-team-slot ${alive ? 'poke-team-slot--alive' : 'poke-team-slot--fainted'}`} title={mon?.name}>
            <PokeballIcon size={12} />
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Battle View Components
// ─────────────────────────────────────────────────────────────────────────────

function MoveButton({ move, battleId, onResult }: { move: PokemonMove; battleId: string; onResult?: (r: any) => void }) {
  const { call, loading } = useCallTool();
  const eff = getEffectivenessLabel(move.effectiveness);
  const typeColor = getTypeColor(move.type);
  
  const handleClick = async () => {
    if (!move.canUse || loading) return;
    const result = await call('pokedexter_make_move', { battleId, action: `move ${move.slot}` });
    onResult?.(result);
  };
  
  return (
    <button 
      className={`poke-move-btn ${!move.canUse ? 'poke-move-btn--disabled' : ''}`}
      style={{ '--type-color': typeColor } as React.CSSProperties}
      onClick={handleClick}
      disabled={!move.canUse || loading}
    >
      <div className="poke-move-btn__header">
        <span className="poke-move-btn__name">{move.name}</span>
        {eff && <span className="poke-move-btn__eff" style={{ color: eff.color }}>{eff.label}</span>}
      </div>
      <div className="poke-move-btn__footer">
        {move.type && <TypeBadge type={move.type} />}
        <span className="poke-move-btn__pp">PP {move.pp}/{move.maxpp}</span>
        {move.basePower > 0 && <span className="poke-move-btn__bp">{move.basePower} BP</span>}
      </div>
      {loading && <div className="poke-move-btn__loading" />}
    </button>
  );
}

function SwitchButton({ pokemon, battleId, onResult }: { pokemon: Pokemon; battleId: string; onResult?: (r: any) => void }) {
  const { call, loading } = useCallTool();
  
  const handleClick = async () => {
    if (loading) return;
    const result = await call('pokedexter_make_move', { battleId, action: `switch ${pokemon.slot}` });
    onResult?.(result);
  };
  
  return (
    <button className="poke-switch-btn" onClick={handleClick} disabled={loading}>
      <PokemonSprite name={pokemon.name} size={40} />
      <div className="poke-switch-btn__info">
        <span className="poke-switch-btn__name">{pokemon.name}</span>
        <HpBar percent={pokemon.hpPercent} size="sm" />
      </div>
      {pokemon.status && <span className="poke-switch-btn__status">{STATUS_ICONS[pokemon.status] || pokemon.status}</span>}
      {loading && <div className="poke-switch-btn__loading" />}
    </button>
  );
}

function BattlefieldView({ payload }: { payload: PokedexterPayload }) {
  const { openExternal } = useOpenExternal();
  const [actionResult, setActionResult] = useState<string | null>(null);
  const [showSwitches, setShowSwitches] = useState(false);
  
  const battleId = payload.battleId || payload.actualRoomId || '';
  const yourActive = payload.yourActive;
  const opponent = payload.opponent;
  const moves = payload.availableActions?.moves || payload.yourMoves || [];
  const switches = payload.availableActions?.switches || payload.yourSwitches || [];
  const canMove = payload.availableActions?.canMove ?? moves.some(m => m.canUse);
  const canSwitch = payload.availableActions?.canSwitch ?? switches.length > 0;
  const forceSwitch = payload.availableActions?.forceSwitch || false;
  const isYourTurn = !payload.waiting && (canMove || canSwitch);
  
  const handleOpenBattle = () => {
    openExternal(`https://poke.dexter.cash/battle/${battleId}`);
  };
  
  // Waiting state
  if (payload.waiting) {
    return (
      <div className="poke-view">
        <div className="poke-battlefield-waiting">
          <PokeballIcon size={32} />
          <span>{payload.message || 'Waiting for your turn...'}</span>
        </div>
        {battleId && (
          <button className="poke-watch-btn" onClick={handleOpenBattle}>
            Watch Battle ↗
          </button>
        )}
      </div>
    );
  }
  
  return (
    <div className="poke-view poke-battlefield">
      {/* Opponent Side */}
      {opponent && (
        <div className="poke-battlefield__opponent">
          {opponent.activePokemon && (
            <div className="poke-pokemon-display poke-pokemon-display--opponent">
              <PokemonSprite name={opponent.activePokemon} size={96} />
              <div className="poke-pokemon-info">
                <div className="poke-pokemon-name">{opponent.activePokemon}</div>
                {opponent.activeTypes && (
                  <div className="poke-pokemon-types">
                    {opponent.activeTypes.map(t => <TypeBadge key={t} type={t} />)}
                  </div>
                )}
                {opponent.team?.find(p => p.active) && (
                  <HpBar percent={opponent.team.find(p => p.active)!.hp} />
                )}
              </div>
            </div>
          )}
          {opponent.team && opponent.team.length > 0 && (
            <div className="poke-opponent-team">
              <span className="poke-opponent-team__label">
                {opponent.remainingCount}/{opponent.revealedCount} alive
                {6 - (opponent.revealedCount || 0) > 0 && ` • ${6 - (opponent.revealedCount || 0)} unrevealed`}
              </span>
            </div>
          )}
        </div>
      )}
      
      {/* Your Side */}
      {yourActive && (
        <div className="poke-battlefield__you">
          <div className="poke-pokemon-display poke-pokemon-display--you">
            <PokemonSprite name={yourActive.name} back size={96} />
            <div className="poke-pokemon-info">
              <div className="poke-pokemon-name">
                {yourActive.name}
                {yourActive.status && <span className="poke-status-icon">{STATUS_ICONS[yourActive.status] || `[${yourActive.status}]`}</span>}
              </div>
              {yourActive.types && (
                <div className="poke-pokemon-types">
                  {yourActive.types.map(t => <TypeBadge key={t} type={t} />)}
                </div>
              )}
              <HpBar percent={yourActive.hpPercent} />
              {yourActive.ability && <div className="poke-pokemon-ability">Ability: {yourActive.ability}</div>}
            </div>
          </div>
          {payload.yourTeam && <TeamIndicator team={payload.yourTeam} />}
        </div>
      )}
      
      {/* Actions */}
      <div className="poke-battlefield__actions">
        {forceSwitch && (
          <div className="poke-force-switch-banner">⚠️ Must switch Pokemon!</div>
        )}
        
        {actionResult && (
          <div className="poke-action-result">{actionResult}</div>
        )}
        
        {/* Move buttons */}
        {!forceSwitch && canMove && !showSwitches && (
          <div className="poke-moves-grid">
            {moves.map(move => (
              <MoveButton 
                key={move.slot} 
                move={move} 
                battleId={battleId}
                onResult={(r) => setActionResult(r?.submitted || 'Move sent!')}
              />
            ))}
          </div>
        )}
        
        {/* Switch buttons */}
        {(forceSwitch || showSwitches) && canSwitch && (
          <div className="poke-switches-list">
            {switches.map(pokemon => (
              <SwitchButton 
                key={pokemon.slot} 
                pokemon={pokemon} 
                battleId={battleId}
                onResult={(r) => setActionResult(r?.submitted || 'Switch sent!')}
              />
            ))}
          </div>
        )}
        
        {/* Toggle switch view */}
        {!forceSwitch && canSwitch && (
          <button 
            className="poke-toggle-switches"
            onClick={() => setShowSwitches(!showSwitches)}
          >
            {showSwitches ? '← Back to Moves' : 'Switch Pokemon →'}
          </button>
        )}
      </div>
      
      {/* Watch button */}
      {battleId && (
        <button className="poke-watch-btn" onClick={handleOpenBattle}>
          Watch on poke.dexter.cash ↗
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Challenge View with Accept Button
// ─────────────────────────────────────────────────────────────────────────────

function ChallengeCard({ challenge }: { challenge: Challenge }) {
  const { call, loading, result } = useCallTool();
  
  const handleAccept = async () => {
    await call('pokedexter_accept_challenge', { challengeId: challenge.id });
  };
  
  if (result) {
    return (
      <div className="poke-challenge-card poke-challenge-card--accepted">
        <div className="poke-challenge-accepted">
          <span className="poke-challenge-accepted__icon">✓</span>
          <span>Challenge Accepted!</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className="poke-challenge-card">
      <div className="poke-challenge-header">
        <div className="poke-challenge-info">
          <span className="poke-challenge-user">
            {challenge.challengerId || abbreviate(challenge.challengerWallet) || 'Anonymous'}
          </span>
          <span className="poke-challenge-format">{challenge.format || 'gen9randombattle'}</span>
        </div>
        <WagerAmount amount={challenge.amount} />
      </div>
      <div className="poke-challenge-footer">
        <span className="poke-challenge-id">ID: {challenge.id}</span>
        <button 
          className="poke-accept-btn"
          onClick={handleAccept}
          disabled={loading}
        >
          {loading ? 'Accepting...' : '⚔️ Accept'}
        </button>
      </div>
    </div>
  );
}

function ChallengesView({ challenges }: { challenges: Challenge[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? challenges : challenges.slice(0, 4);

  return (
    <div className="poke-view">
      {challenges.length === 0 ? (
        <div className="poke-empty">
          <PokeballIcon size={48} />
          <p>No open challenges right now</p>
          <span>Create one to start battling!</span>
        </div>
      ) : (
        <>
          <div className="poke-challenges-list">
            {visible.map(challenge => (
              <ChallengeCard key={challenge.id} challenge={challenge} />
            ))}
          </div>
          {challenges.length > 4 && (
            <button className="poke-show-more" onClick={() => setShowAll(!showAll)}>
              {showAll ? 'Show Less' : `Show ${challenges.length - 4} more`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Other Views (Queue, Wager, etc.)
// ─────────────────────────────────────────────────────────────────────────────

function WagerStatusView({ payload }: { payload: PokedexterPayload }) {
  const { openExternal } = useOpenExternal();
  const wagerId = payload.wagerId || payload.id;
  const roomId = payload.battleRoomId || payload.roomId;
  const status = payload.winner ? 'completed' : payload.status === 'active' ? 'active' : 'pending';

  return (
    <div className="poke-view">
      <div className="poke-wager-header">
        <div className="poke-wager-icon">⚔️</div>
        <div className="poke-wager-info">
          <span className="poke-wager-title">Wager Match</span>
          <span className="poke-wager-id">#{wagerId}</span>
        </div>
        <div className="poke-wager-meta">
          <WagerAmount amount={payload.amount || 0} />
          <PokeBadge status={status} />
        </div>
      </div>

      <div className="poke-players">
        <div className={`poke-player ${payload.player1?.deposited ? 'poke-player--ready' : ''}`}>
          <span className="poke-player-label">Player 1</span>
          {payload.player1?.deposited && <span className="poke-player-check">✓</span>}
          <span className="poke-player-wallet">
            {abbreviate(payload.player1?.wallet || payload.player1?.userId) || '—'}
          </span>
        </div>
        <div className={`poke-player ${payload.player2?.deposited ? 'poke-player--ready' : ''}`}>
          <span className="poke-player-label">Player 2</span>
          {payload.player2?.deposited && <span className="poke-player-check">✓</span>}
          <span className="poke-player-wallet">
            {abbreviate(payload.player2?.wallet || payload.player2?.userId) || 'Waiting...'}
          </span>
        </div>
      </div>

      {payload.winner && (
        <div className="poke-winner">
          <span className="poke-winner-icon">🏆</span>
          <div className="poke-winner-info">
            <span className="poke-winner-label">Winner</span>
            <span className="poke-winner-name">{payload.winner}</span>
          </div>
        </div>
      )}

      {roomId && (
        <button className="poke-battle-link" onClick={() => openExternal(`https://poke.dexter.cash/battle/${roomId}`)}>
          Watch Battle: {roomId} ↗
        </button>
      )}
    </div>
  );
}

function QueueStatusView({ payload }: { payload: PokedexterPayload }) {
  const { openExternal } = useOpenExternal();
  const roomId = payload.battleRoomId || payload.roomId;

  return (
    <div className="poke-view">
      {payload.matched ? (
        <div className="poke-matched">
          <span className="poke-matched-icon">⚔️</span>
          <div className="poke-matched-info">
            <span className="poke-matched-title">Match Found!</span>
            {roomId && (
              <button className="poke-matched-link" onClick={() => openExternal(`https://poke.dexter.cash/battle/${roomId}`)}>
                Join Battle: {roomId} ↗
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="poke-queue-metrics">
            <div className="poke-queue-metric">
              <span className="poke-queue-metric__label">POSITION</span>
              <span className="poke-queue-metric__value">#{payload.position || 1}</span>
            </div>
            <div className="poke-queue-metric">
              <span className="poke-queue-metric__label">IN QUEUE</span>
              <span className="poke-queue-metric__value">{payload.queueSize || 1}</span>
            </div>
            <div className="poke-queue-metric">
              <span className="poke-queue-metric__label">WAGER</span>
              <span className="poke-queue-metric__value">${payload.amount || '—'}</span>
            </div>
          </div>
          <div className="poke-searching">
            <div className="poke-searching-icon">
              <PokeballIcon size={24} />
            </div>
            <div className="poke-searching-info">
              <span className="poke-searching-text">Searching for opponent...</span>
              <span className="poke-searching-format">{payload.format || 'gen9randombattle'}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function DepositsView({ payload }: { payload: PokedexterPayload }) {
  const p1Deposited = payload.deposits?.player1?.deposited;
  const p2Deposited = payload.deposits?.player2?.deposited;
  const bothReady = p1Deposited && p2Deposited;

  return (
    <div className="poke-view">
      <div className="poke-deposit-status">
        <div className={`poke-deposit-player ${p1Deposited ? 'poke-deposit-player--ready' : ''}`}>
          <span className="poke-deposit-label">Player 1</span>
          <span className="poke-deposit-icon">{p1Deposited ? '✓' : '◷'}</span>
          <span className="poke-deposit-state">{p1Deposited ? 'Deposited' : 'Pending'}</span>
        </div>
        <div className={`poke-deposit-player ${p2Deposited ? 'poke-deposit-player--ready' : ''}`}>
          <span className="poke-deposit-label">Player 2</span>
          <span className="poke-deposit-icon">{p2Deposited ? '✓' : '◷'}</span>
          <span className="poke-deposit-state">{p2Deposited ? 'Deposited' : 'Pending'}</span>
        </div>
      </div>

      {payload.totalPot && (
        <div className="poke-pot">
          <span className="poke-pot-label">Total Pot</span>
          <WagerAmount amount={payload.totalPot} size="lg" />
        </div>
      )}

      {bothReady && (
        <div className="poke-ready">
          <span className="poke-ready-icon">⚡</span>
          <span className="poke-ready-text">Battle Ready!</span>
        </div>
      )}
    </div>
  );
}

function MoveResultView({ payload }: { payload: PokedexterPayload }) {
  return (
    <div className="poke-view">
      <div className="poke-move-display">
        <span className="poke-move-submitted">{payload.submitted}</span>
      </div>
      <div className="poke-move-metrics">
        <div className="poke-move-metric">
          <span className="poke-move-metric__label">BATTLE ID</span>
          <span className="poke-move-metric__value">{payload.battleId || '—'}</span>
        </div>
        <div className="poke-move-metric">
          <span className="poke-move-metric__label">STATUS</span>
          <span className="poke-move-metric__value">Recorded</span>
        </div>
      </div>
      {payload.note && <p className="poke-move-note">{payload.note}</p>}
    </div>
  );
}

function SuccessView({ payload }: { payload: PokedexterPayload }) {
  const { openExternal } = useOpenExternal();
  const roomId = payload.battleRoomId || payload.roomId;

  return (
    <div className="poke-view">
      <div className="poke-success-banner">
        <span className="poke-success-icon">✓</span>
        <span className="poke-success-text">Success!</span>
      </div>

      <div className="poke-success-details">
        {payload.amount && (
          <div className="poke-success-detail">
            <span className="poke-success-detail__label">WAGER</span>
            <span className="poke-success-detail__value">${payload.amount}</span>
          </div>
        )}
        {payload.format && (
          <div className="poke-success-detail">
            <span className="poke-success-detail__label">FORMAT</span>
            <span className="poke-success-detail__value">{payload.format}</span>
          </div>
        )}
        {payload.challengeId && (
          <div className="poke-success-detail">
            <span className="poke-success-detail__label">CHALLENGE</span>
            <span className="poke-success-detail__value">{payload.challengeId}</span>
          </div>
        )}
        {payload.wagerId && (
          <div className="poke-success-detail">
            <span className="poke-success-detail__label">WAGER</span>
            <span className="poke-success-detail__value">{payload.wagerId}</span>
          </div>
        )}
      </div>

      {roomId && (
        <button className="poke-enter-battle" onClick={() => openExternal(`https://poke.dexter.cash/battle/${roomId}`)}>
          ⚡ Enter Battle Room ↗
        </button>
      )}

      {payload.escrowAddress && (
        <div className="poke-escrow">
          <span className="poke-escrow-label">Deposit To</span>
          <code className="poke-escrow-address">{abbreviate(payload.escrowAddress, 16)}</code>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

function Pokedexter() {
  const toolOutput = useOpenAIGlobal('toolOutput') as PokedexterPayload | null;
  const theme = useTheme();

  if (!toolOutput) {
    return (
      <div className="poke-container" data-theme={theme}>
        <div className="poke-loading">
          <PokeballIcon size={24} />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (toolOutput.error || toolOutput.ok === false) {
    return (
      <div className="poke-container" data-theme={theme}>
        <div className="poke-error">{toolOutput.error || 'Operation failed'}</div>
      </div>
    );
  }

  const viewType = detectViewType(toolOutput);
  const challenges = toolOutput.challenges || toolOutput.data || [];
  const isYourTurn = viewType === 'battlefield' && !toolOutput.waiting && 
    (toolOutput.availableActions?.canMove || toolOutput.availableActions?.canSwitch);

  const titles: Record<string, string> = {
    challenges: 'Open Challenges',
    wager_status: 'Wager Status',
    queue: 'Queue Status',
    deposits: 'Deposit Status',
    battlefield: 'Battle',
    move: 'Move Submitted',
    success: 'Success',
    unknown: 'Pokedexter',
  };

  return (
    <div className="poke-container" data-theme={theme}>
      <div className="poke-card">
        <div className="poke-header">
          <div className="poke-header-left">
            <PokeballIcon size={18} />
            <span className="poke-title">{titles[viewType]}</span>
          </div>
          {viewType === 'challenges' && (
            <span className="poke-challenges-count">{challenges.length} available</span>
          )}
          {viewType === 'queue' && (
            <PokeBadge status={toolOutput.matched ? 'matched' : 'waiting'} />
          )}
          {viewType === 'move' && <PokeBadge status="confirmed" />}
          {viewType === 'battlefield' && (
            <PokeBadge status={isYourTurn ? 'yourturn' : 'waiting'} />
          )}
        </div>

        {viewType === 'challenges' && <ChallengesView challenges={challenges} />}
        {viewType === 'wager_status' && <WagerStatusView payload={toolOutput} />}
        {viewType === 'queue' && <QueueStatusView payload={toolOutput} />}
        {viewType === 'deposits' && <DepositsView payload={toolOutput} />}
        {viewType === 'battlefield' && <BattlefieldView payload={toolOutput} />}
        {viewType === 'move' && <MoveResultView payload={toolOutput} />}
        {viewType === 'success' && <SuccessView payload={toolOutput} />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mount
// ─────────────────────────────────────────────────────────────────────────────

const root = document.getElementById('pokedexter-root');
if (root) {
  createRoot(root).render(<Pokedexter />);
}

export default Pokedexter;
