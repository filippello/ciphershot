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
        <div className={phase === 'count1' ? 'text-glow-red' : 'text-glow-yellow'} style={{
          fontSize: '100px',
          fontWeight: 'bold',
          letterSpacing: '4px',
          color: phase === 'count1' ? '#ff4444' : '#ffcc44',
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
                border: '3px solid #ffcc44',
                boxShadow: '0 0 30px rgba(255, 204, 68, 0.5), 0 0 60px rgba(255, 204, 68, 0.2)',
              }}>
                <img
                  src={CARD_IMAGES[cardPlayed]}
                  alt={cardPlayed}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div className={cardPlayed === 'redirect' ? 'text-glow-purple' : 'text-glow-green'} style={{
                fontSize: '18px',
                color: cardPlayed === 'redirect' ? '#cc88cc' : '#88cc88',
                textTransform: 'uppercase',
                letterSpacing: '3px',
              }}>
                {cardPlayed}
              </div>
            </>
          ) : (
            <div style={{
              fontSize: '24px',
              color: '#666677',
              textShadow: '0 0 20px #666677',
              letterSpacing: '3px',
            }}>
              NO CARD
            </div>
          )}
        </div>
      )}
    </div>
  );
}
