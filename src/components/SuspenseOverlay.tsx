import { useState, useEffect } from 'react';
import type { CardType } from '@/game/core/types';
import { playSound } from '@/lib/audio';

const CARD_IMAGES: Record<string, string> = {
  bluff: '/assets/cards/card_bluff.png',
  redirect: '/assets/cards/card_redirect.png',
};

interface Props {
  cardPlayed: CardType | null;
  onComplete: () => void;
}

type Phase = 'count3' | 'count2' | 'count1' | 'card' | 'done';

const PIXEL_FONT: React.CSSProperties = {
  fontFamily: 'monospace',
  fontWeight: 'bold',
  imageRendering: 'pixelated',
  textRendering: 'optimizeLegibility',
  letterSpacing: '4px',
};

export default function SuspenseOverlay({ cardPlayed, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('count3');

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    playSound('countdown_tick', 0.6);

    timers.push(setTimeout(() => { setPhase('count2'); playSound('countdown_tick', 0.7); }, 800));
    timers.push(setTimeout(() => { setPhase('count1'); playSound('countdown_final', 0.8); }, 1600));
    timers.push(setTimeout(() => {
      setPhase('card');
      if (cardPlayed === 'redirect') playSound('redirect_reveal', 0.7);
      else if (cardPlayed === 'bluff') playSound('bluff_reveal', 0.7);
      else playSound('card_reveal', 0.6);
    }, 2400));
    timers.push(setTimeout(() => {
      setPhase('done');
      onComplete();
    }, 3800));

    return () => timers.forEach(clearTimeout);
  }, [onComplete, cardPlayed]);

  if (phase === 'done') return null;

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.8)',
      zIndex: 50,
      pointerEvents: 'none',
    }}>
      {(phase === 'count3' || phase === 'count2' || phase === 'count1') && (
        <div style={{
          ...PIXEL_FONT,
          fontSize: '120px',
          color: phase === 'count1' ? '#ff4444' : '#ffcc44',
          textShadow: `0 0 40px ${phase === 'count1' ? '#ff4444' : '#ffcc44'}`,
          animation: 'countPop 0.7s ease-out',
        }}>
          {phase === 'count3' ? '3' : phase === 'count2' ? '2' : '1'}
        </div>
      )}

      {phase === 'card' && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          animation: 'cardReveal 0.5s ease-out',
        }}>
          {cardPlayed ? (
            <>
              <div style={{
                width: '160px',
                height: '230px',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '2px solid #ffcc44',
                boxShadow: '0 0 30px rgba(255, 204, 68, 0.5)',
              }}>
                <img
                  src={CARD_IMAGES[cardPlayed]}
                  alt={cardPlayed}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div style={{
                ...PIXEL_FONT,
                fontSize: '28px',
                color: cardPlayed === 'redirect' ? '#cc88cc' : '#88cc88',
                textShadow: `0 0 20px ${cardPlayed === 'redirect' ? '#cc88cc' : '#88cc88'}`,
                textTransform: 'uppercase',
              }}>
                {cardPlayed}
              </div>
            </>
          ) : (
            <div style={{
              ...PIXEL_FONT,
              fontSize: '36px',
              color: '#666677',
              textShadow: '0 0 20px #666677',
            }}>
              NO CARD
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes countPop {
          0% { transform: scale(2); opacity: 0; }
          30% { transform: scale(0.9); opacity: 1; }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes cardReveal {
          0% { transform: scale(0.3) rotateY(90deg); opacity: 0; }
          50% { transform: scale(1.1) rotateY(0deg); opacity: 1; }
          100% { transform: scale(1) rotateY(0deg); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
