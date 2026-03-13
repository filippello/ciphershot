import { useGameStore } from '@/game/store';

export default function HUD() {
  const { currentShooter, currentShotIndex, chamber, phase } = useGameStore((s) => s.gameState);
  const animating = useGameStore((s) => s.animating);

  const playerName = currentShooter === 'player1' ? 'Player 1' : 'Player 2';

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 16px',
      background: '#0d0d1a',
      color: '#8888aa',
      fontFamily: 'monospace',
      fontSize: '14px',
      borderBottom: '1px solid #2a2a3e',
    }}>
      <div>
        <span style={{ color: '#ff4444' }}>SHOOTER:</span> {playerName}
      </div>
      <div>
        SHOT {currentShotIndex + 1} / {chamber.length}
      </div>
      <div>
        {animating ? '⟳ RESOLVING...' : phase.toUpperCase().replace(/([A-Z])/g, ' $1')}
      </div>
    </div>
  );
}
