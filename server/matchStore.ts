import { WebSocket } from 'ws';
import type { GameState, Target, CardType, Player, ShotResult } from '../src/game/core/types.js';
import { createInitialState, selectTarget, playCard, getResponder } from '../src/game/core/engine.js';

export interface MatchRecord {
  matchId: string;
  matchIdBytes: string | null; // bytes32 on-chain match ID (null in legacy mode)
  playerA: string;
  playerB: string;
  gameState: GameState;
  status: 'active' | 'finished';
  connections: Map<string, WebSocket>; // playerAddress -> ws
  fheMode: boolean; // true = contract-based, false = legacy in-memory
}

const matches = new Map<string, MatchRecord>();

// ================================================================
// Legacy mode (in-memory game engine — no FHE)
// ================================================================

export function createMatch(matchId: string, playerA: string, playerB: string): MatchRecord {
  const record: MatchRecord = {
    matchId,
    matchIdBytes: null,
    playerA,
    playerB,
    gameState: createInitialState(),
    status: 'active',
    connections: new Map(),
    fheMode: false,
  };
  matches.set(matchId, record);
  return record;
}

// ================================================================
// FHE mode (contract-based — server is event relay)
// ================================================================

export function createFheMatch(matchId: string, matchIdBytes: string, playerA: string, playerB: string): MatchRecord {
  // In FHE mode, the initial state has hidden chamber (all unknown)
  const gameState = createInitialState();
  // Mark chamber as unknown — the real chamber is encrypted on-chain
  gameState.chamber = Array(7).fill('blank') as GameState['chamber'];

  const record: MatchRecord = {
    matchId,
    matchIdBytes,
    playerA,
    playerB,
    gameState,
    status: 'active',
    connections: new Map(),
    fheMode: true,
  };
  matches.set(matchId, record);
  return record;
}

// ================================================================
// Common
// ================================================================

export function getMatch(matchId: string): MatchRecord | undefined {
  return matches.get(matchId);
}

export function joinMatch(matchId: string, player: string, ws: WebSocket): MatchRecord | null {
  const match = matches.get(matchId);
  if (!match) return null;
  match.connections.set(player, ws);
  return match;
}

function getPlayerRole(match: MatchRecord, player: string): Player {
  if (player === match.playerA) return 'player1';
  if (player === match.playerB) return 'player2';
  throw new Error('Player not in match');
}

// ================================================================
// Legacy game actions (in-memory engine)
// ================================================================

export function handleChooseTarget(matchId: string, player: string, target: Target): MatchRecord | null {
  const match = matches.get(matchId);
  if (!match || match.status !== 'active' || match.fheMode) return null;

  const role = getPlayerRole(match, player);
  if (match.gameState.currentShooter !== role) return null;
  if (match.gameState.phase !== 'choosingTarget') return null;

  let newState = selectTarget(match.gameState, target);

  // Auto-resolve if responder has no cards
  const responder = getResponder(newState.currentShooter);
  const hasCards = newState.players[responder].cards.some(c => !c.used);
  if (!hasCards) {
    newState = playCard(newState, null);
  }

  match.gameState = newState;
  if (newState.phase === 'gameOver') match.status = 'finished';
  return match;
}

export function handlePlayCard(matchId: string, player: string, card: CardType | null): MatchRecord | null {
  const match = matches.get(matchId);
  if (!match || match.status !== 'active' || match.fheMode) return null;

  const role = getPlayerRole(match, player);
  const responder = getResponder(match.gameState.currentShooter);
  if (role !== responder) return null;
  if (match.gameState.phase !== 'respondingCard') return null;

  const newState = playCard(match.gameState, card);
  match.gameState = newState;
  if (newState.phase === 'gameOver') match.status = 'finished';
  return match;
}

// ================================================================
// FHE event handlers (build state from contract events)
// ================================================================

/**
 * Handle TargetChosen event from contract.
 * Updates game state to respondingCard phase.
 */
export function handleFheTargetChosen(matchId: string, shooter: string, target: number): MatchRecord | null {
  const match = findMatchByBytesId(matchId) || matches.get(matchId);
  if (!match || !match.fheMode) return null;

  const role = shooter === match.playerA ? 'player1' as Player : 'player2' as Player;
  match.gameState = {
    ...match.gameState,
    phase: 'respondingCard',
    currentShooter: role,
    selectedTarget: target === 0 ? 'self' : 'opponent',
  };

  return match;
}

/**
 * Handle CardSubmitted event — card is encrypted, nobody knows what it is.
 * Transition to resolving phase (suspense).
 */
export function handleFheCardSubmitted(matchId: string, _responder: string): MatchRecord | null {
  const match = findMatchByBytesId(matchId) || matches.get(matchId);
  if (!match || !match.fheMode) return null;

  match.gameState = {
    ...match.gameState,
    phase: 'resolving',
  };

  return match;
}

/**
 * Handle RoundFinalized event — the big reveal.
 * Updates game state with the decrypted result.
 */
export function handleFheRoundFinalized(
  matchId: string,
  shooter: string,
  finalTarget: string,
  killed: boolean,
  cardPlayed: number,
  shotIndex: number,
): MatchRecord | null {
  const match = findMatchByBytesId(matchId) || matches.get(matchId);
  if (!match || !match.fheMode) return null;

  const shooterRole: Player = shooter === match.playerA ? 'player1' : 'player2';
  const targetRole: Player = finalTarget === match.playerA ? 'player1' : 'player2';
  const originalTarget = match.gameState.selectedTarget || 'opponent';
  const cardTypeMap: Record<number, CardType | null> = { 0: null, 1: 'bluff', 2: 'redirect' };

  const result: ShotResult = {
    shotType: killed ? 'live' : 'blank',
    shooter: shooterRole,
    originalTarget,
    cardPlayed: cardTypeMap[cardPlayed] ?? null,
    finalTarget: targetRole,
    killed,
  };

  const newHistory = [...match.gameState.shotHistory, result];
  let updatedPlayers = { ...match.gameState.players };

  if (killed) {
    updatedPlayers = {
      ...updatedPlayers,
      [targetRole]: { ...updatedPlayers[targetRole], alive: false },
    };
  }

  // Mark card as used in responder's hand
  const responderRole = getResponder(shooterRole);
  if (cardPlayed > 0) {
    const cardTypeName = cardTypeMap[cardPlayed];
    if (cardTypeName) {
      const cards = [...updatedPlayers[responderRole].cards];
      const idx = cards.findIndex(c => c.type === cardTypeName && !c.used);
      if (idx !== -1) {
        cards[idx] = { ...cards[idx], used: true };
        updatedPlayers = {
          ...updatedPlayers,
          [responderRole]: { ...updatedPlayers[responderRole], cards },
        };
      }
    }
  }

  if (killed) {
    const winner = shooterRole === targetRole
      ? getResponder(shooterRole)
      : shooterRole;
    match.gameState = {
      ...match.gameState,
      phase: 'gameOver',
      players: updatedPlayers,
      lastResult: result,
      winner: targetRole === shooterRole ? getResponder(shooterRole) : shooterRole,
      shotHistory: newHistory,
      currentShotIndex: shotIndex + 1,
      selectedTarget: null,
      respondedCard: null,
    };
    match.status = 'finished';
  } else if (shotIndex + 1 >= 7) {
    match.gameState = {
      ...match.gameState,
      phase: 'gameOver',
      players: updatedPlayers,
      lastResult: result,
      winner: null,
      shotHistory: newHistory,
      currentShotIndex: shotIndex + 1,
      selectedTarget: null,
      respondedCard: null,
    };
    match.status = 'finished';
  } else {
    const nextShooter = getResponder(shooterRole);
    match.gameState = {
      ...match.gameState,
      phase: 'choosingTarget',
      currentShooter: nextShooter,
      currentShotIndex: shotIndex + 1,
      players: updatedPlayers,
      lastResult: result,
      selectedTarget: null,
      respondedCard: null,
      winner: null,
      shotHistory: newHistory,
    };
  }

  return match;
}

// ================================================================
// Broadcast
// ================================================================

export function broadcastState(match: MatchRecord): void {
  const msg = JSON.stringify({
    type: 'state_update',
    matchId: match.matchId,
    gameState: match.gameState,
    fheMode: match.fheMode,
  });
  for (const ws of match.connections.values()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

/**
 * Broadcast a specific event (for FHE-mode partial updates).
 */
export function broadcastEvent(match: MatchRecord, event: Record<string, unknown>): void {
  const msg = JSON.stringify(event);
  for (const ws of match.connections.values()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

// ================================================================
// Helpers
// ================================================================

function findMatchByBytesId(bytesId: string): MatchRecord | undefined {
  for (const match of matches.values()) {
    if (match.matchIdBytes === bytesId) return match;
  }
  return undefined;
}
