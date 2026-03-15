import { WebSocket } from 'ws';
import type { GameState, Target, CardType, Player } from '../src/game/core/types.js';
import { createInitialState, selectTarget, playCard, getResponder } from '../src/game/core/engine.js';

export interface MatchRecord {
  matchId: string;
  playerA: string;
  playerB: string;
  gameState: GameState;
  status: 'active' | 'finished';
  connections: Map<string, WebSocket>; // playerAddress -> ws
}

const matches = new Map<string, MatchRecord>();

export function createMatch(matchId: string, playerA: string, playerB: string): MatchRecord {
  const record: MatchRecord = {
    matchId,
    playerA,
    playerB,
    gameState: createInitialState(),
    status: 'active',
    connections: new Map(),
  };
  matches.set(matchId, record);
  return record;
}

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

export function handleChooseTarget(matchId: string, player: string, target: Target): MatchRecord | null {
  const match = matches.get(matchId);
  if (!match || match.status !== 'active') return null;

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
  if (!match || match.status !== 'active') return null;

  const role = getPlayerRole(match, player);
  const responder = getResponder(match.gameState.currentShooter);
  if (role !== responder) return null;
  if (match.gameState.phase !== 'respondingCard') return null;

  const newState = playCard(match.gameState, card);
  match.gameState = newState;
  if (newState.phase === 'gameOver') match.status = 'finished';
  return match;
}

export function broadcastState(match: MatchRecord): void {
  const msg = JSON.stringify({
    type: 'state_update',
    matchId: match.matchId,
    gameState: match.gameState,
  });
  for (const ws of match.connections.values()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}
