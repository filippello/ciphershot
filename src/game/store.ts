import { create } from 'zustand';
import type { GameState, Target, CardType } from './core/types';
import { createInitialState } from './core/engine';
import type { GameConnection } from '@/lib/matchmaking';

interface GameStore {
  gameState: GameState;
  animating: boolean;
  connection: GameConnection | null;
  pendingState: GameState | null;

  // Actions
  setConnection: (conn: GameConnection | null) => void;
  receiveState: (state: GameState) => void;
  chooseTarget: (target: Target) => void;
  respondWithCard: (cardType: CardType | null) => void;
  setAnimating: (animating: boolean) => void;
  resetGame: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: createInitialState(),
  animating: false,
  connection: null,
  pendingState: null,

  setConnection: (connection) => {
    set({ connection });
  },

  receiveState: (gameState) => {
    const prev = get().gameState;
    // Trigger animation if a shot was resolved (new lastResult appeared)
    const shouldAnimate = gameState.lastResult &&
      gameState.lastResult !== prev.lastResult &&
      gameState.shotHistory.length > prev.shotHistory.length;

    if (shouldAnimate) {
      // Keep the OLD display state but inject lastResult so animation knows what to play.
      // Buffer the real new state to apply after animation finishes.
      const animState: GameState = {
        ...prev,
        lastResult: gameState.lastResult,
        shotHistory: gameState.shotHistory,
      };
      set({
        gameState: animState,
        animating: true,
        pendingState: gameState,
      });
    } else {
      set({ gameState });
    }
  },

  chooseTarget: (target) => {
    const { connection, animating, gameState } = get();
    if (animating || gameState.phase !== 'choosingTarget') return;
    if (connection) {
      connection.chooseTarget(target);
    }
  },

  respondWithCard: (cardType) => {
    const { connection, animating, gameState } = get();
    if (animating || gameState.phase !== 'respondingCard') return;
    if (connection) {
      connection.playCard(cardType);
    }
  },

  setAnimating: (animating) => {
    if (!animating) {
      // Animation done — flush the buffered state
      const pending = get().pendingState;
      if (pending) {
        set({ animating: false, gameState: pending, pendingState: null });
        return;
      }
    }
    set({ animating });
  },

  resetGame: () => {
    const { connection } = get();
    if (connection) connection.close();
    set({ gameState: createInitialState(), animating: false, connection: null, pendingState: null });
  },
}));
