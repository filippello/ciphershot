import { useEffect } from 'react';
import { playSound, stopMusic } from '@/lib/audio';

interface Props {
  winner: string | null;
  playerAddress: string;
  playerA: string;
  playerB: string;
  onPlayAgain: () => void;
}

export default function ResultBanner({ winner, playerAddress, playerA, playerB, onPlayAgain }: Props) {
  const winnerAddress = winner === 'player1' ? playerA : winner === 'player2' ? playerB : null;
  const isWinner = winnerAddress === playerAddress;

  useEffect(() => {
    stopMusic();
    playSound(isWinner ? 'win' : 'lose', 0.6);
  }, [isWinner]);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.85)',
      zIndex: 100,
      fontFamily: 'monospace',
      gap: '24px',
    }}>
      <div style={{
        fontSize: '48px',
        color: isWinner ? '#88cc88' : '#ff4444',
        textShadow: `0 0 20px ${isWinner ? '#88cc88' : '#ff4444'}`,
      }}>
        {isWinner ? 'VICTORY' : 'DEFEAT'}
      </div>
      <div style={{ color: '#666677', fontSize: '14px' }}>
        {winnerAddress
          ? `Winner: ${winnerAddress.slice(0, 6)}...${winnerAddress.slice(-4)}`
          : 'Draw'
        }
      </div>
      <button
        onClick={onPlayAgain}
        style={{
          padding: '12px 36px',
          background: '#1a2e1a',
          color: '#88cc88',
          border: '1px solid #3a5e3a',
          fontFamily: 'monospace',
          cursor: 'pointer',
          fontSize: '16px',
        }}
      >
        PLAY AGAIN
      </button>
    </div>
  );
}
