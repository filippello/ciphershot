import { v4 as uuidv4 } from 'uuid';
import { WebSocket } from 'ws';
import { createMatch, createFheMatch } from './matchStore.js';
import { createMatchOnChain } from './contractListener.js';

interface QueueEntry {
  player: string;
  ws: WebSocket;
}

const queue: QueueEntry[] = [];

// Set by server/index.ts based on whether contract is configured
let fheEnabled = false;

export function setFheMode(enabled: boolean): void {
  fheEnabled = enabled;
}

export function addToQueue(player: string, ws: WebSocket): void {
  // Don't allow duplicate entries
  const existing = queue.findIndex(e => e.player === player);
  if (existing !== -1) {
    queue[existing].ws = ws;
    ws.send(JSON.stringify({ type: 'queued', position: existing + 1 }));
    return;
  }

  queue.push({ player, ws });
  ws.send(JSON.stringify({ type: 'queued', position: queue.length }));

  tryMatch();
}

export function removeFromQueue(player: string): void {
  const idx = queue.findIndex(e => e.player === player);
  if (idx !== -1) queue.splice(idx, 1);
}

async function tryMatch(): Promise<void> {
  while (queue.length >= 2) {
    const a = queue.shift()!;
    const b = queue.shift()!;

    // Verify both connections are still alive
    if (a.ws.readyState !== WebSocket.OPEN) {
      queue.unshift(b);
      continue;
    }
    if (b.ws.readyState !== WebSocket.OPEN) {
      queue.unshift(a);
      continue;
    }

    const matchId = uuidv4();

    if (fheEnabled) {
      // FHE mode: create match on-chain (encrypted chamber + cards)
      try {
        const matchIdBytes = await createMatchOnChain(matchId, a.player, b.player);
        createFheMatch(matchId, matchIdBytes, a.player, b.player);
        console.log(`[FHE] Match created on-chain: ${matchId} | ${a.player.slice(0, 8)}... vs ${b.player.slice(0, 8)}...`);
      } catch (err) {
        console.error('[FHE] Failed to create on-chain match:', err);
        // Fall back to legacy mode for this match
        createMatch(matchId, a.player, b.player);
        console.log(`[FHE] Fallback to legacy match: ${matchId}`);
      }
    } else {
      createMatch(matchId, a.player, b.player);
    }

    const event = JSON.stringify({
      type: 'match_found',
      matchId,
      playerA: a.player,
      playerB: b.player,
    });

    a.ws.send(event);
    b.ws.send(event);

    console.log(`Match created: ${matchId} | ${a.player.slice(0, 8)}... vs ${b.player.slice(0, 8)}...`);
  }
}
