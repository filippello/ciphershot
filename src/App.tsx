import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { createGameConfig } from '@/game/phaser/config';
import { GameScene } from '@/game/phaser/GameScene';
import { useGameStore } from '@/game/store';
import HUD from '@/components/HUD';
import ActionPanel from '@/components/ActionPanel';
import CardDisplay from '@/components/CardDisplay';
import ShotHistory from '@/components/ShotHistory';

function PhaserGame() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const gameState = useGameStore((s) => s.gameState);
  const setAnimating = useGameStore((s) => s.setAnimating);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const config = createGameConfig('phaser-container');
    const game = new Phaser.Game(config);
    gameRef.current = game;

    game.events.on('ready', () => {
      const scene = game.scene.getScene('GameScene') as GameScene;
      if (scene) {
        scene.events.on('scene-ready', () => {
          scene.updateChamberDisplay(7, 0);
        });
      }
    });

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  const animating = useGameStore((s) => s.animating);
  const prevAnimatingRef = useRef(false);
  const prevShotIndexRef = useRef(gameState.currentShotIndex);

  useEffect(() => {
    if (!gameRef.current) return;
    const scene = gameRef.current.scene.getScene('GameScene') as GameScene;
    if (!scene || !scene.scene.isActive()) return;

    // Detect game reset (shot index went back to 0 from a higher value)
    if (gameState.currentShotIndex === 0 && prevShotIndexRef.current > 0) {
      scene.resetVisuals();
    }
    prevShotIndexRef.current = gameState.currentShotIndex;

    scene.highlightShooter(gameState.currentShooter);
    scene.updateChamberDisplay(gameState.chamber.length, gameState.currentShotIndex);

    // Trigger animation on rising edge of animating flag
    if (animating && !prevAnimatingRef.current && gameState.lastResult) {
      const result = gameState.lastResult;
      scene.animateAim(result.shooter, result.originalTarget);

      setTimeout(() => {
        scene.animateShot(result.killed, () => {
          if (result.killed) {
            scene.showKill(result.finalTarget);
          }
          setTimeout(() => {
            scene.resetGunPosition();
            setAnimating(false);
          }, result.killed ? 1500 : 500);
        });
      }, 500);
    }
    prevAnimatingRef.current = animating;
  }, [gameState, animating, setAnimating]);

  return (
    <div
      id="phaser-container"
      ref={containerRef}
      style={{ width: '960px', maxWidth: '100%', aspectRatio: '16/9' }}
    />
  );
}

export default function App() {
  return (
    <main style={{
      display: 'flex',
      flexDirection: 'column',
      maxWidth: '960px',
      width: '100%',
      border: '1px solid #2a2a3e',
    }}>
      <HUD />
      <PhaserGame />
      <CardDisplay />
      <ActionPanel />
      <ShotHistory />
    </main>
  );
}
