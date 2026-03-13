import { useGameStore } from '@/game/store';

export default function ShotHistory() {
  const history = useGameStore((s) => s.gameState.shotHistory);

  if (history.length === 0) return null;

  return (
    <div style={{
      padding: '8px 16px',
      background: '#0a0a16',
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#555566',
      maxHeight: '80px',
      overflowY: 'auto',
      borderTop: '1px solid #1a1a2e',
    }}>
      {history.map((shot, i) => {
        const shooter = shot.shooter === 'player1' ? 'P1' : 'P2';
        const target = shot.finalTarget === 'player1' ? 'P1' : 'P2';
        const card = shot.cardPlayed ? ` [${shot.cardPlayed.toUpperCase()}]` : '';
        const result = shot.killed ? '💀' : (shot.shotType === 'live' ? '🔴' : '⚪');
        return (
          <div key={i}>
            #{i + 1}: {shooter}→{target}{card} {result} {shot.shotType.toUpperCase()}
          </div>
        );
      })}
    </div>
  );
}
