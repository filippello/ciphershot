import { useGameStore } from '@/game/store';
import { getResponder } from '@/game/core/engine';
import type { Player } from '@/game/core/types';
import { playSound } from '@/lib/audio';

interface Props {
  playerAddress: string;
  playerA: string;
  playerB: string;
}

export default function ActionPanel({ playerAddress, playerA, playerB }: Props) {
  const gameState = useGameStore((s) => s.gameState);
  const animating = useGameStore((s) => s.animating);
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

  const panelStyle: React.CSSProperties = {
    padding: '8px 16px',
    background: 'linear-gradient(180deg, #0d0d1a, #0a0a16)',
    borderTop: '2px solid #2a2a3e',
    textAlign: 'center',
  };

  if (phase === 'gameOver') {
    const iWon = winner === myRole;
    return (
      <div style={panelStyle}>
        <div className={iWon ? 'text-glow-green' : 'text-glow-red'} style={{
          color: iWon ? '#88cc88' : '#ff4444',
          fontSize: '16px',
        }}>
          {iWon ? 'YOU WIN' : 'YOU LOSE'}
        </div>
      </div>
    );
  }

  if (animating || phase === 'resolving') {
    return (
      <div style={{ ...panelStyle, color: '#666677', fontSize: '8px' }}>
        Resolving shot...
      </div>
    );
  }

  if (phase === 'choosingTarget') {
    if (!isMyTurnToShoot) {
      return (
        <div style={{ ...panelStyle, color: '#666677', fontSize: '8px' }}>
          Waiting for {shooterName} to choose target...
        </div>
      );
    }

    return (
      <div style={{ ...panelStyle, color: '#ff4444', fontSize: '8px' }}>
        Click on a player to shoot
      </div>
    );
  }

  if (phase === 'respondingCard') {
    if (!isMyTurnToRespond) {
      return (
        <div style={{ ...panelStyle, color: '#666677', fontSize: '8px' }}>
          Waiting for {responderName} to play a card...
        </div>
      );
    }

    const availableBluffs = responderCards.filter(c => c.type === 'bluff' && !c.used).length;
    const availableRedirects = responderCards.filter(c => c.type === 'redirect' && !c.used).length;

    return (
      <div style={panelStyle}>
        <div style={{ color: '#8888aa', marginBottom: '8px', fontSize: '8px' }}>
          Respond — Play a card:
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            onClick={() => { playSound('card_submit', 0.5); respondWithCard('bluff'); }}
            disabled={availableBluffs === 0}
            className="arcade-btn arcade-btn-green"
            style={{ padding: '8px 14px', fontSize: '8px' }}
          >
            BLUFF ({availableBluffs})
          </button>
          <button
            onClick={() => { playSound('card_submit', 0.5); respondWithCard('redirect'); }}
            disabled={availableRedirects === 0}
            className="arcade-btn arcade-btn-purple"
            style={{ padding: '8px 14px', fontSize: '8px' }}
          >
            REDIRECT ({availableRedirects})
          </button>
        </div>
      </div>
    );
  }

  return null;
}
