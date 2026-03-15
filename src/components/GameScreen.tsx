import { useEffect, useRef, useState, useCallback } from 'react';
import Phaser from 'phaser';
import { createGameConfig } from '@/game/phaser/config';
import { GameScene } from '@/game/phaser/GameScene';
import { useGameStore } from '@/game/store';
import { connectToMatch } from '@/lib/matchmaking';
import type { CardType, Player } from '@/game/core/types';
import HUD from './HUD';
import ActionPanel from './ActionPanel';
import CardDisplay from './CardDisplay';
import ShotHistory from './ShotHistory';
import SuspenseOverlay from './SuspenseOverlay';

interface Props {
  matchId: string;
  playerAddress: string;
  playerA: string;
  playerB: string;
  onLeaveMatch: () => void;
}

export default function GameScreen({ matchId, playerAddress, playerA, playerB, onLeaveMatch }: Props) {
  const gameState = useGameStore((s) => s.gameState);
  const animating = useGameStore((s) => s.animating);
  const receiveState = useGameStore((s) => s.receiveState);
  const setAnimating = useGameStore((s) => s.setAnimating);
  const setConnection = useGameStore((s) => s.setConnection);
  const isPlayerA = playerAddress === playerA;
  const myRole: Player = isPlayerA ? 'player1' : 'player2';

  // Phaser refs
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  // Suspense state
  const [showSuspense, setShowSuspense] = useState(false);
  const [suspenseCard, setSuspenseCard] = useState<CardType | null>(null);
  const prevAnimatingRef = useRef(false);
  const prevShotIndexRef = useRef(gameState.currentShotIndex);

  // Init Phaser
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

  // Sync Phaser visuals + trigger suspense on new shot
  useEffect(() => {
    if (!gameRef.current) return;
    const scene = gameRef.current.scene.getScene('GameScene') as GameScene;
    if (!scene || !scene.scene.isActive()) return;

    if (gameState.currentShotIndex === 0 && prevShotIndexRef.current > 0) {
      scene.resetVisuals();
    }
    prevShotIndexRef.current = gameState.currentShotIndex;

    scene.highlightShooter(gameState.currentShooter);
    scene.updateChamberDisplay(gameState.chamber.length, gameState.currentShotIndex);

    // New shot resolved → start suspense countdown
    if (animating && !prevAnimatingRef.current && gameState.lastResult) {
      setSuspenseCard(gameState.lastResult.cardPlayed);
      setShowSuspense(true);
    }
    prevAnimatingRef.current = animating;
  }, [gameState, animating]);

  // After suspense completes → play shot animation
  const handleSuspenseComplete = useCallback(() => {
    setShowSuspense(false);

    if (!gameRef.current || !gameState.lastResult) return;
    const scene = gameRef.current.scene.getScene('GameScene') as GameScene;
    if (!scene || !scene.scene.isActive()) return;

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
  }, [gameState.lastResult, setAnimating]);

  // Establish game connection on mount
  useEffect(() => {
    const conn = connectToMatch(
      matchId,
      playerAddress,
      (newState) => receiveState(newState),
      (err) => console.error('Match connection error:', err),
    );
    setConnection(conn);

    return () => {
      conn.close();
      setConnection(null);
    };
  }, [matchId, playerAddress, receiveState, setConnection]);

  return (
    <main style={{
      display: 'flex',
      flexDirection: 'column',
      maxWidth: '960px',
      width: '100%',
      border: '1px solid #2a2a3e',
      position: 'relative',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '4px 16px',
        background: '#0a0a16',
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#444455',
        borderBottom: '1px solid #1a1a2e',
      }}>
        <span>Match: {matchId.slice(0, 8)}...</span>
        <span>
          You are <span style={{ color: isPlayerA ? '#88cc88' : '#cc88cc' }}>
            {isPlayerA ? 'P1 (shooter first)' : 'P2'}
          </span>
        </span>
        {gameState.phase === 'gameOver' && (
          <button
            onClick={onLeaveMatch}
            style={{
              padding: '2px 12px',
              background: '#2a2a3e',
              color: '#8888aa',
              border: '1px solid #3a3a5e',
              fontFamily: 'monospace',
              cursor: 'pointer',
              fontSize: '10px',
            }}
          >
            LEAVE
          </button>
        )}
      </div>
      <HUD />
      <div style={{ position: 'relative' }}>
        <div
          id="phaser-container"
          ref={containerRef}
          style={{ width: '960px', maxWidth: '100%', aspectRatio: '16/9' }}
        />
        {showSuspense && (
          <SuspenseOverlay
            cardPlayed={suspenseCard}
            onComplete={handleSuspenseComplete}
          />
        )}
      </div>
      <CardDisplay myRole={myRole} />
      <ActionPanel playerAddress={playerAddress} playerA={playerA} playerB={playerB} />
      <ShotHistory />
    </main>
  );
}
