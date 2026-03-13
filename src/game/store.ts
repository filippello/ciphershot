import { create } from 'zustand';
import type { GameState, Target, CardType } from './core/types';
import { createInitialState, selectTarget, playCard, getResponder } from './core/engine';

interface GameStore {
  // State
  gameState: GameState;
  animating: boolean; // true while Phaser is animating

  // Actions
  startGame: () => void;
  chooseTarget: (target: Target) => void;
  respondWithCard: (cardType: CardType | null) => void;
  setAnimating: (animating: boolean) => void;
  resetGame: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: createInitialState(),
  animating: false,

  startGame: () => {
    set({ gameState: createInitialState(), animating: false });
  },

  chooseTarget: (target: Target) => {
    const { gameState, animating } = get();
    if (animating || gameState.phase !== 'choosingTarget') return;
    const newState = selectTarget(gameState, target);

    // If the responder has no cards left, auto-resolve with null
    const responder = getResponder(newState.currentShooter);
    const hasCards = newState.players[responder].cards.some((c) => !c.used);
    if (!hasCards) {
      const resolved = playCard(newState, null);
      set({ gameState: resolved, animating: true });
      return;
    }

    set({ gameState: newState });
  },

  respondWithCard: (cardType: CardType | null) => {
    const { gameState, animating } = get();
    if (animating || gameState.phase !== 'respondingCard') return;
    const newState = playCard(gameState, cardType);
    set({ gameState: newState, animating: true });
    // Phaser will read animating=true, play animation, then call setAnimating(false)
  },

  setAnimating: (animating: boolean) => {
    set({ animating });
  },

  resetGame: () => {
    set({ gameState: createInitialState(), animating: false });
  },
}));
