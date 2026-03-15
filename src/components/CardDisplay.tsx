import { useGameStore } from '@/game/store';
import type { Player } from '@/game/core/types';

const CARD_IMAGES: Record<string, string> = {
  bluff: '/assets/cards/card_bluff.png',
  redirect: '/assets/cards/card_redirect.png',
  back: '/assets/cards/card_back.png',
};

function OpponentCards({ player }: { player: Player }) {
  const cards = useGameStore((s) => s.gameState.players[player].cards);
  const bluffs = cards.filter(c => c.type === 'bluff' && !c.used).length;
  const redirects = cards.filter(c => c.type === 'redirect' && !c.used).length;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#555566',
    }}>
      <span style={{ color: '#ff6666' }}>OPP</span>
      <div style={{ display: 'flex', gap: '2px' }}>
        {cards.map((card) => (
          <div
            key={card.id}
            style={{
              width: '20px',
              height: '28px',
              borderRadius: '2px',
              overflow: 'hidden',
              opacity: card.used ? 0.15 : 0.7,
              filter: card.used ? 'grayscale(1)' : 'none',
            }}
          >
            <img
              src={CARD_IMAGES.back}
              alt="card"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        ))}
      </div>
      <span>
        <span style={{ color: '#88cc88' }}>{bluffs}B</span>{' '}
        <span style={{ color: '#cc88cc' }}>{redirects}R</span>
      </span>
    </div>
  );
}

function MyCards({ player }: { player: Player }) {
  const cards = useGameStore((s) => s.gameState.players[player].cards);
  const bluffs = cards.filter(c => c.type === 'bluff' && !c.used).length;
  const redirects = cards.filter(c => c.type === 'redirect' && !c.used).length;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontFamily: 'monospace',
    }}>
      <div style={{ color: '#ffcc44', fontSize: '10px' }}>YOU</div>
      <div style={{ display: 'flex', gap: '4px' }}>
        {cards.map((card) => (
          <div
            key={card.id}
            style={{
              width: '48px',
              height: '68px',
              borderRadius: '3px',
              overflow: 'hidden',
              opacity: card.used ? 0.15 : 1,
              filter: card.used ? 'grayscale(1)' : 'none',
              border: card.used ? '1px solid #222233' : '1px solid #3a3a5e',
            }}
          >
            <img
              src={card.used ? CARD_IMAGES.back : CARD_IMAGES[card.type]}
              alt={card.used ? 'used' : card.type}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        ))}
      </div>
      <div style={{ fontSize: '10px', color: '#666677' }}>
        <span style={{ color: '#88cc88' }}>{bluffs}B</span>{' '}
        <span style={{ color: '#cc88cc' }}>{redirects}R</span>
      </div>
    </div>
  );
}

interface Props {
  myRole: Player;
}

export default function CardDisplay({ myRole }: Props) {
  const opponentRole: Player = myRole === 'player1' ? 'player2' : 'player1';

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '4px 16px',
      background: '#0d0d1a',
      borderTop: '1px solid #1a1a2e',
    }}>
      <MyCards player={myRole} />
      <OpponentCards player={opponentRole} />
    </div>
  );
}
