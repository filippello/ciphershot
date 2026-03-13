import { useGameStore } from '@/game/store';
import type { Player } from '@/game/core/types';

const CARD_IMAGES: Record<string, string> = {
  bluff: '/assets/cards/card_bluff.png',
  redirect: '/assets/cards/card_redirect.png',
  back: '/assets/cards/card_back.png',
};

function PlayerCards({ player }: { player: Player }) {
  const cards = useGameStore((s) => s.gameState.players[player].cards);
  const label = player === 'player1' ? 'P1 Cards' : 'P2 Cards';

  const bluffs = cards.filter(c => c.type === 'bluff' && !c.used).length;
  const redirects = cards.filter(c => c.type === 'redirect' && !c.used).length;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '4px',
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#666677',
    }}>
      <div style={{ color: '#ffcc44', fontSize: '11px' }}>{label}</div>
      <div style={{ display: 'flex', gap: '4px' }}>
        {cards.map((card) => (
          <div
            key={card.id}
            style={{
              width: '36px',
              height: '52px',
              borderRadius: '3px',
              overflow: 'hidden',
              opacity: card.used ? 0.2 : 1,
              filter: card.used ? 'grayscale(1)' : 'none',
              transition: 'opacity 0.3s, filter 0.3s',
            }}
          >
            <img
              src={card.used ? CARD_IMAGES.back : CARD_IMAGES[card.type]}
              alt={card.used ? 'used' : card.type}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </div>
        ))}
      </div>
      <div style={{ fontSize: '10px' }}>
        <span style={{ color: '#88cc88' }}>{bluffs}B</span>{' '}
        <span style={{ color: '#cc88cc' }}>{redirects}R</span>
      </div>
    </div>
  );
}

export default function CardDisplay() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '8px 32px',
      background: '#0d0d1a',
    }}>
      <PlayerCards player="player1" />
      <PlayerCards player="player2" />
    </div>
  );
}
