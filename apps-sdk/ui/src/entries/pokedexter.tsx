import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/pokedexter.css';

import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { useOpenAIGlobal } from '../sdk';

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

type BattleState = {
  battleId?: string;
  deposits?: {
    player1?: { deposited?: boolean };
    player2?: { deposited?: boolean };
  };
  totalPot?: number;
  status?: string;
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
} & Partial<WagerStatus> & Partial<QueueStatus> & Partial<BattleState> & Partial<MoveResult>;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function abbreviate(value?: string, len = 8): string {
  if (!value) return '—';
  if (value.length <= len * 2 + 3) return value;
  return `${value.slice(0, len)}...${value.slice(-4)}`;
}

function detectViewType(payload: PokedexterPayload): string {
  if (payload.challenges || payload.data) return 'challenges';
  if (payload.submitted !== undefined) return 'move';
  if (payload.matched !== undefined || payload.position !== undefined) return 'queue';
  if (payload.deposits) return 'battle_state';
  if (payload.winner || payload.player1 || payload.player2) return 'wager_status';
  if (payload.challengeId || payload.wagerId || payload.battleRoomId || payload.roomId) return 'success';
  return 'unknown';
}

// ─────────────────────────────────────────────────────────────────────────────
// Components
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

function ChallengesView({ challenges }: { challenges: Challenge[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? challenges : challenges.slice(0, 4);

  return (
    <div className="poke-view">
      {challenges.length === 0 ? (
        <div className="poke-empty">
          <PokeballIcon size={48} />
          <p>No open challenges right now</p>
          <span>Create one with pokedexter_create_challenge!</span>
        </div>
      ) : (
        <>
          <div className="poke-challenges-list">
            {visible.map((challenge, idx) => (
              <div key={challenge.id} className="poke-challenge-card">
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
                  <span className="poke-challenge-cta">ACCEPT TO BATTLE</span>
                </div>
              </div>
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

function WagerStatusView({ payload }: { payload: PokedexterPayload }) {
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
        <a
          href={`https://poke.dexter.cash/battle/${roomId}`}
          target="_blank"
          rel="noreferrer"
          className="poke-battle-link"
        >
          Watch Battle: {roomId} ↗
        </a>
      )}
    </div>
  );
}

function QueueStatusView({ payload }: { payload: PokedexterPayload }) {
  const roomId = payload.battleRoomId || payload.roomId;

  return (
    <div className="poke-view">
      {payload.matched ? (
        <div className="poke-matched">
          <span className="poke-matched-icon">⚔️</span>
          <div className="poke-matched-info">
            <span className="poke-matched-title">Match Found!</span>
            {roomId && (
              <a
                href={`https://poke.dexter.cash/battle/${roomId}`}
                target="_blank"
                rel="noreferrer"
                className="poke-matched-link"
              >
                Join Battle: {roomId}
              </a>
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
              <span className="poke-queue-metric__value">{payload.queueSize || 1} players</span>
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

function BattleStateView({ payload }: { payload: PokedexterPayload }) {
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
            <span className="poke-success-detail__label">CHALLENGE ID</span>
            <span className="poke-success-detail__value">{payload.challengeId}</span>
          </div>
        )}
        {payload.wagerId && (
          <div className="poke-success-detail">
            <span className="poke-success-detail__label">WAGER ID</span>
            <span className="poke-success-detail__value">{payload.wagerId}</span>
          </div>
        )}
        {payload.position && (
          <div className="poke-success-detail">
            <span className="poke-success-detail__label">QUEUE POSITION</span>
            <span className="poke-success-detail__value">#{payload.position}</span>
          </div>
        )}
      </div>

      {roomId && (
        <a
          href={`https://poke.dexter.cash/battle/${roomId}`}
          target="_blank"
          rel="noreferrer"
          className="poke-enter-battle"
        >
          ⚡ Enter Battle Room ↗
        </a>
      )}

      {payload.escrowAddress && (
        <div className="poke-escrow">
          <span className="poke-escrow-label">Deposit To</span>
          <div className="poke-escrow-address">
            <code>{abbreviate(payload.escrowAddress, 16)}</code>
          </div>
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

  if (!toolOutput) {
    return (
      <div className="poke-container">
        <div className="poke-loading">
          <PokeballIcon size={24} />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (toolOutput.error || toolOutput.ok === false) {
    return (
      <div className="poke-container">
        <div className="poke-error">{toolOutput.error || 'Operation failed'}</div>
      </div>
    );
  }

  const viewType = detectViewType(toolOutput);
  const challenges = toolOutput.challenges || toolOutput.data || [];

  const titles: Record<string, string> = {
    challenges: 'Open Challenges',
    wager_status: 'Wager Status',
    queue: 'Queue Status',
    battle_state: 'Battle State',
    move: 'Move Submitted',
    success: 'Success',
    unknown: 'Pokedexter',
  };

  return (
    <div className="poke-container">
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
        </div>

        {viewType === 'challenges' && <ChallengesView challenges={challenges} />}
        {viewType === 'wager_status' && <WagerStatusView payload={toolOutput} />}
        {viewType === 'queue' && <QueueStatusView payload={toolOutput} />}
        {viewType === 'battle_state' && <BattleStateView payload={toolOutput} />}
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
