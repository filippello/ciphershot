import { useGameStore } from '@/game/store';
import { getResponder } from '@/game/core/engine';
import type { Player } from '@/game/core/types';

interface Props {
  playerAddress: string;
  playerA: string;
  playerB: string;
}

export default function ActionPanel({ playerAddress, playerA, playerB }: Props) {
  const gameState = useGameStore((s) => s.gameState);
  const animating = useGameStore((s) => s.animating);
  const chooseTarget = useGameStore((s) => s.chooseTarget);
  const respondWithCard = useGameStore((s) => s.respondWithCard);

  const { phase, currentShooter, players, winner } = gameState;
  const responder = getResponder(currentShooter);
  const responderCards = players[responder].cards;

  // Map wallet address to player role
  const myRole: Player = playerAddress === playerA ? 'player1' : 'player2';
  const isMyTurnToShoot = currentShooter === myRole;
  const isMyTurnToRespond = responder === myRole;

  const shooterName = currentShooter === 'player1' ? 'P1' : 'P2';
  const responderName = responder === 'player1' ? 'P1' : 'P2';

  if (phase === 'gameOver') {
    const winnerName = winner === 'player1' ? 'Player 1' : winner === 'player2' ? 'Player 2' : 'Nobody';
    const iWon = winner === myRole;
    return (
      <div style={{
        padding: '16px',
        background: '#0d0d1a',
        borderTop: '1px solid #2a2a3e',
        textAlign: 'center',
        fontFamily: 'monospace',
      }}>
        <div style={{ color: iWon ? '#88cc88' : '#ff4444', fontSize: '24px', marginBottom: '12px' }}>
          {iWon ? 'YOU WIN' : 'YOU LOSE'}
        </div>
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
    if (!isMyTurnToShoot) {
      return (
        <div style={{
          padding: '16px',
          background: '#0d0d1a',
          borderTop: '1px solid #2a2a3e',
          textAlign: 'center',
          fontFamily: 'monospace',
          color: '#666677',
        }}>
          Waiting for {shooterName} to choose target...
        </div>
      );
    }

    return (
      <div style={{
        padding: '16px',
        background: '#0d0d1a',
        borderTop: '1px solid #2a2a3e',
        textAlign: 'center',
        fontFamily: 'monospace',
      }}>
        <div style={{ color: '#8888aa', marginBottom: '12px' }}>
          Your turn — Choose your target:
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
    if (!isMyTurnToRespond) {
      return (
        <div style={{
          padding: '16px',
          background: '#0d0d1a',
          borderTop: '1px solid #2a2a3e',
          textAlign: 'center',
          fontFamily: 'monospace',
          color: '#666677',
        }}>
          Waiting for {responderName} to play a card...
        </div>
      );
    }

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
          Respond — Play a card:
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
