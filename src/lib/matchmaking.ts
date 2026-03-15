// In production, use VITE_WS_URL env var (e.g. wss://ciphershot-server.up.railway.app)
// In dev, derive port from current page port (handles Docker port mapping)
const WS_URL = import.meta.env.VITE_WS_URL
  || `ws://${window.location.hostname}:${Number(window.location.port) === 9000 ? 9001 : 3001}`;

export interface MatchFoundEvent {
  type: 'match_found';
  matchId: string;
  playerA: string;
  playerB: string;
}

export interface QueuedEvent {
  type: 'queued';
  position: number;
}

export interface ErrorEvent {
  type: 'error';
  message: string;
}

export type ServerEvent = MatchFoundEvent | QueuedEvent | ErrorEvent;

export function connectMatchmaking(
  playerAddress: string,
  onEvent: (event: ServerEvent) => void,
): { close: () => void } {
  const ws = new WebSocket(WS_URL);
  let matchFound = false;
  let closedByUser = false;

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'join_queue', player: playerAddress }));
  };

  ws.onmessage = (msg) => {
    try {
      const event = JSON.parse(msg.data) as ServerEvent;
      if (event.type === 'match_found') matchFound = true;
      onEvent(event);
    } catch { /* ignore malformed messages */ }
  };

  ws.onerror = () => {
    if (!matchFound && !closedByUser) {
      onEvent({ type: 'error', message: 'Connection lost' });
    }
  };

  ws.onclose = () => {
    if (!matchFound && !closedByUser) {
      onEvent({ type: 'error', message: 'Disconnected' });
    }
  };

  return {
    close: () => {
      closedByUser = true;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'leave_queue', player: playerAddress }));
      }
      ws.close();
    },
  };
}

// --- Game connection (after match found) ---

import type { GameState, Target, CardType } from '@/game/core/types';

export interface StateUpdateEvent {
  type: 'state_update';
  matchId: string;
  gameState: GameState;
}

export function connectToMatch(
  matchId: string,
  playerAddress: string,
  onStateUpdate: (gameState: GameState) => void,
  onError: (msg: string) => void,
): GameConnection {
  return new GameConnection(matchId, playerAddress, onStateUpdate, onError);
}

export class GameConnection {
  private ws: WebSocket;
  private matchId: string;
  private player: string;

  constructor(
    matchId: string,
    player: string,
    private onStateUpdate: (gameState: GameState) => void,
    private onError: (msg: string) => void,
  ) {
    this.matchId = matchId;
    this.player = player;
    this.ws = new WebSocket(WS_URL);

    this.ws.onopen = () => {
      this.ws.send(JSON.stringify({
        type: 'join_match',
        matchId: this.matchId,
        player: this.player,
      }));
    };

    this.ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data.type === 'state_update' && data.gameState) {
          this.onStateUpdate(data.gameState);
        }
      } catch { /* ignore */ }
    };

    this.ws.onerror = () => this.onError('Connection lost');
    this.ws.onclose = () => this.onError('Disconnected from match');
  }

  chooseTarget(target: Target): void {
    this.send({ type: 'choose_target', matchId: this.matchId, player: this.player, target });
  }

  playCard(card: CardType | null): void {
    this.send({ type: 'play_card', matchId: this.matchId, player: this.player, card });
  }

  close(): void {
    this.ws.close();
  }

  private send(msg: object): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}
