import { useGameStore } from '@/game/store';
import { getResponder } from '@/game/core/engine';
import type { CardType } from '@/game/core/types';

export default function ActionPanel() {
  const gameState = useGameStore((s) => s.gameState);
  const animating = useGameStore((s) => s.animating);
  const chooseTarget = useGameStore((s) => s.chooseTarget);
  const respondWithCard = useGameStore((s) => s.respondWithCard);
  const resetGame = useGameStore((s) => s.resetGame);

  const { phase, currentShooter, players, winner } = gameState;
  const responder = getResponder(currentShooter);
  const responderCards = players[responder].cards;

  if (phase === 'gameOver') {
    const winnerName = winner === 'player1' ? 'Player 1' : 'Player 2';
    return (
      <div style={{
        padding: '16px',
        background: '#0d0d1a',
        borderTop: '1px solid #2a2a3e',
        textAlign: 'center',
        fontFamily: 'monospace',
      }}>
        <div style={{ color: '#ff4444', fontSize: '24px', marginBottom: '12px' }}>
          {winnerName} WINS
        </div>
        <button
          onClick={resetGame}
          style={{
            padding: '8px 24px',
            background: '#2a2a3e',
            color: '#8888aa',
            border: '1px solid #3a3a5e',
            fontFamily: 'monospace',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          NEW GAME
        </button>
      </div>
    );
  }

  if (animating || phase === 'resolving') {
    return (
      <div style={{
        padding: '16px',
        background: '#0d0d1a',
        borderTop: '1px solid #2a2a3e',
        textAlign: 'center',
        fontFamily: 'monospace',
        color: '#666677',
      }}>
        Resolving shot...
      </div>
    );
  }

  if (phase === 'choosingTarget') {
    const shooterName = currentShooter === 'player1' ? 'Player 1' : 'Player 2';
    return (
      <div style={{
        padding: '16px',
        background: '#0d0d1a',
        borderTop: '1px solid #2a2a3e',
        textAlign: 'center',
        fontFamily: 'monospace',
      }}>
        <div style={{ color: '#8888aa', marginBottom: '12px' }}>
          {shooterName} — Choose your target:
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            onClick={() => chooseTarget('self')}
            style={{
              padding: '10px 28px',
              background: '#1a1a2e',
              color: '#aaaacc',
              border: '1px solid #3a3a5e',
              fontFamily: 'monospace',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            SHOOT SELF
          </button>
          <button
            onClick={() => chooseTarget('opponent')}
            style={{
              padding: '10px 28px',
              background: '#1a1a2e',
              color: '#ff6666',
              border: '1px solid #ff4444',
              fontFamily: 'monospace',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            SHOOT OPPONENT
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'respondingCard') {
    const responderName = responder === 'player1' ? 'Player 1' : 'Player 2';
    const availableBluffs = responderCards.filter(c => c.type === 'bluff' && !c.used).length;
    const availableRedirects = responderCards.filter(c => c.type === 'redirect' && !c.used).length;

    return (
      <div style={{
        padding: '16px',
        background: '#0d0d1a',
        borderTop: '1px solid #2a2a3e',
        textAlign: 'center',
        fontFamily: 'monospace',
      }}>
        <div style={{ color: '#8888aa', marginBottom: '12px' }}>
          {responderName} — Play a card or pass:
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            onClick={() => respondWithCard('bluff')}
            disabled={availableBluffs === 0}
            style={{
              padding: '10px 20px',
              background: availableBluffs > 0 ? '#1a2e1a' : '#1a1a1a',
              color: availableBluffs > 0 ? '#88cc88' : '#444444',
              border: `1px solid ${availableBluffs > 0 ? '#3a5e3a' : '#333333'}`,
              fontFamily: 'monospace',
              cursor: availableBluffs > 0 ? 'pointer' : 'not-allowed',
              fontSize: '13px',
            }}
          >
            BLUFF ({availableBluffs})
          </button>
          <button
            onClick={() => respondWithCard('redirect')}
            disabled={availableRedirects === 0}
            style={{
              padding: '10px 20px',
              background: availableRedirects > 0 ? '#2e1a2e' : '#1a1a1a',
              color: availableRedirects > 0 ? '#cc88cc' : '#444444',
              border: `1px solid ${availableRedirects > 0 ? '#5e3a5e' : '#333333'}`,
              fontFamily: 'monospace',
              cursor: availableRedirects > 0 ? 'pointer' : 'not-allowed',
              fontSize: '13px',
            }}
          >
            REDIRECT ({availableRedirects})
          </button>
        </div>
      </div>
    );
  }

  return null;
}
