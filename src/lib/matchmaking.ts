import type { GameState, Target, CardType } from '@/game/core/types';
import { getSigner } from '@/lib/contract';
import { chooseTargetOnChain, playCardOnChain, CONTRACT_ADDRESS } from '@/lib/contract';
import { initFhevm } from '@/lib/fhe';

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

export function connectToMatch(
  matchId: string,
  playerAddress: string,
  onStateUpdate: (gameState: GameState) => void,
  onError: (msg: string) => void,
  onCardSubmitted?: () => void,
): GameConnection {
  return new GameConnection(matchId, playerAddress, onStateUpdate, onError, onCardSubmitted);
}

export class GameConnection {
  private ws: WebSocket;
  private matchId: string;
  private player: string;
  private _fheMode = false;
  private _fheInitialized = false;

  constructor(
    matchId: string,
    player: string,
    private onStateUpdate: (gameState: GameState) => void,
    private onError: (msg: string) => void,
    private onCardSubmitted?: () => void,
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
          if (data.fheMode !== undefined) this._fheMode = data.fheMode;
          this.onStateUpdate(data.gameState);
        }
        // FHE mode: card_submitted event triggers suspense overlay
        if (data.type === 'card_submitted' && this.onCardSubmitted) {
          this.onCardSubmitted();
        }
      } catch { /* ignore */ }
    };

    this.ws.onerror = () => this.onError('Connection lost');
    this.ws.onclose = () => this.onError('Disconnected from match');
  }

  get fheMode(): boolean {
    return this._fheMode;
  }

  /**
   * Initialize FHE SDK (call once when entering FHE mode game).
   * Follows Bagel-EVM pattern: init SDK before any encrypt/decrypt call.
   */
  async initFhe(): Promise<void> {
    if (this._fheInitialized) return;
    try {
      await initFhevm();
      this._fheInitialized = true;
      console.log('[GameConnection] FHE SDK initialized');
    } catch (err) {
      console.error('[GameConnection] FHE init failed:', err);
    }
  }

  /**
   * Choose target. In FHE mode, sends tx to contract. In legacy mode, sends via WebSocket.
   */
  async chooseTarget(target: Target): Promise<void> {
    if (this._fheMode && CONTRACT_ADDRESS) {
      try {
        const signer = await getSigner();
        const targetNum = target === 'self' ? 0 : 1;
        const tx = await chooseTargetOnChain(signer, this.matchId, targetNum);
        await tx.wait();
        console.log('[FHE] chooseTarget tx confirmed');
      } catch (err) {
        console.error('[FHE] chooseTarget failed:', err);
        this.onError('Transaction failed');
      }
    } else {
      this.send({ type: 'choose_target', matchId: this.matchId, player: this.player, target });
    }
  }

  /**
   * Play card. In FHE mode, encrypts and sends tx to contract.
   * Follows Bagel-EVM pattern: encrypt → contract.playCard(handle, inputProof).
   */
  async playCard(card: CardType | null): Promise<void> {
    if (this._fheMode && CONTRACT_ADDRESS) {
      try {
        // Ensure FHE is initialized before encrypting
        if (!this._fheInitialized) await this.initFhe();

        const signer = await getSigner();
        const cardNum = card === 'bluff' ? 1 : card === 'redirect' ? 2 : 0;
        const tx = await playCardOnChain(signer, this.matchId, cardNum);
        await tx.wait();
        console.log('[FHE] playCard tx confirmed (encrypted)');
      } catch (err) {
        console.error('[FHE] playCard failed:', err);
        this.onError('Transaction failed');
      }
    } else {
      this.send({ type: 'play_card', matchId: this.matchId, player: this.player, card });
    }
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
