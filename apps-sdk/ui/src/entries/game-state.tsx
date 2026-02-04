import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/game-state.css';

import { createRoot } from 'react-dom/client';
import { useOpenAIGlobal } from '../sdk';

// ─────────────────────────────────────────────────────────────────────────────
// Types (P3 stub - minimal implementation for games_king_state, games_story_read)
// ─────────────────────────────────────────────────────────────────────────────

type GamePayload = {
  gameType?: string;
  game_type?: string;
  type?: string;
  // King of the Hill
  currentKing?: string;
  current_king?: string;
  kingScore?: number;
  king_score?: number;
  challengers?: number;
  timeRemaining?: number;
  time_remaining?: number;
  // Story game
  storyId?: string;
  story_id?: string;
  title?: string;
  chapter?: number;
  content?: string;
  choices?: string[];
  // Generic
  state?: object;
  error?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function detectGameType(payload: GamePayload): string {
  if (payload.gameType || payload.game_type || payload.type) {
    return payload.gameType || payload.game_type || payload.type || 'unknown';
  }
  if (payload.currentKing || payload.current_king || payload.kingScore != null) {
    return 'king';
  }
  if (payload.storyId || payload.story_id || payload.chapter != null) {
    return 'story';
  }
  return 'generic';
}

function getGameIcon(type: string): string {
  switch (type) {
    case 'king': return '👑';
    case 'story': return '📖';
    default: return '🎮';
  }
}

function getGameTitle(type: string): string {
  switch (type) {
    case 'king': return 'King of the Hill';
    case 'story': return 'Story Game';
    default: return 'Game State';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component (P3 - Stub Implementation)
// ─────────────────────────────────────────────────────────────────────────────

function GameState() {
  const toolOutput = useOpenAIGlobal('toolOutput') as GamePayload | null;

  if (!toolOutput) {
    return (
      <div className="game-container">
        <div className="game-loading">
          <div className="game-loading__spinner" />
          <span>Loading game state...</span>
        </div>
      </div>
    );
  }

  if (toolOutput.error) {
    return (
      <div className="game-container">
        <div className="game-error">{toolOutput.error}</div>
      </div>
    );
  }

  const gameType = detectGameType(toolOutput);
  const currentKing = toolOutput.currentKing || toolOutput.current_king;
  const kingScore = toolOutput.kingScore || toolOutput.king_score;
  const storyId = toolOutput.storyId || toolOutput.story_id;

  return (
    <div className="game-container">
      <div className="game-card">
        {/* Header */}
        <div className="game-header">
          <div className="game-header-left">
            <span className="game-icon">{getGameIcon(gameType)}</span>
            <span className="game-title">{getGameTitle(gameType)}</span>
          </div>
          <span className="game-badge">P3 STUB</span>
        </div>

        {/* King of the Hill */}
        {gameType === 'king' && (
          <div className="game-content">
            {currentKing && (
              <div className="game-field">
                <span className="game-field__label">Current King</span>
                <span className="game-field__value">{currentKing}</span>
              </div>
            )}
            {kingScore != null && (
              <div className="game-field">
                <span className="game-field__label">Score</span>
                <span className="game-field__value">{kingScore}</span>
              </div>
            )}
            {toolOutput.challengers != null && (
              <div className="game-field">
                <span className="game-field__label">Challengers</span>
                <span className="game-field__value">{toolOutput.challengers}</span>
              </div>
            )}
          </div>
        )}

        {/* Story Game */}
        {gameType === 'story' && (
          <div className="game-content">
            {toolOutput.title && (
              <div className="game-field">
                <span className="game-field__label">Title</span>
                <span className="game-field__value">{toolOutput.title}</span>
              </div>
            )}
            {toolOutput.chapter != null && (
              <div className="game-field">
                <span className="game-field__label">Chapter</span>
                <span className="game-field__value">{toolOutput.chapter}</span>
              </div>
            )}
            {toolOutput.content && (
              <div className="game-story">
                <p>{toolOutput.content.slice(0, 300)}{toolOutput.content.length > 300 ? '...' : ''}</p>
              </div>
            )}
          </div>
        )}

        {/* Generic fallback */}
        {gameType === 'generic' && toolOutput.state && (
          <div className="game-raw">
            <pre>{JSON.stringify(toolOutput.state, null, 2).slice(0, 500)}</pre>
          </div>
        )}

        {/* Stub notice */}
        <div className="game-stub-notice">
          This is a P3 stub widget. Full implementation pending.
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mount
// ─────────────────────────────────────────────────────────────────────────────

const root = document.getElementById('game-state-root');
if (root) {
  createRoot(root).render(<GameState />);
}

export default GameState;
