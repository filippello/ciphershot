import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { addToQueue, removeFromQueue, setFheMode } from './matchmaking.js';
import {
  joinMatch, handleChooseTarget, handlePlayCard,
  broadcastState, broadcastEvent, getMatch,
  handleFheTargetChosen, handleFheCardSubmitted, handleFheRoundFinalized,
} from './matchStore.js';
import {
  initContractListener, startEventListener, createMatchOnChain,
} from './contractListener.js';

const PORT = Number(process.env.PORT) || 3001;
const FHE_MODE = initContractListener();
setFheMode(FHE_MODE);

if (FHE_MODE) {
  // Wire contract events → WebSocket broadcast
  startEventListener((event) => {
    const matchId = event.matchId;

    switch (event.type) {
      case 'target_chosen': {
        const match = handleFheTargetChosen(matchId, event.data.shooter as string, event.data.target as number);
        if (match) broadcastState(match);
        break;
      }
      case 'card_submitted': {
        const match = handleFheCardSubmitted(matchId, event.data.responder as string);
        if (match) {
          broadcastState(match);
          // Also broadcast a specific card_submitted event for suspense overlay
          broadcastEvent(match, { type: 'card_submitted', matchId });
        }
        break;
      }
      case 'round_finalized': {
        const d = event.data;
        const match = handleFheRoundFinalized(
          matchId,
          d.shooter as string,
          d.finalTarget as string,
          d.killed as boolean,
          d.cardPlayed as number,
          d.shotIndex as number,
        );
        if (match) broadcastState(match);
        break;
      }
      case 'game_over': {
        console.log(`[FHE] Game over: match=${matchId.slice(0, 10)}... winner=${event.data.winner}`);
        break;
      }
    }
  });
  console.log(`CipherShot server running in FHE MODE on :${PORT}`);
} else {
  console.log(`CipherShot server running in LEGACY MODE on :${PORT}`);
}

const server = http.createServer((_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.writeHead(200);
  res.end(JSON.stringify({ status: 'ok', port: PORT, fheMode: FHE_MODE }));
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket) => {
  let playerAddress: string | null = null;

  ws.on('message', (data: Buffer) => {
    try {
      const msg = JSON.parse(data.toString());

      // --- Matchmaking ---
      if (msg.type === 'join_queue' && msg.player) {
        playerAddress = msg.player;
        addToQueue(playerAddress, ws);
        console.log(`Player queued: ${playerAddress.slice(0, 8)}...`);
      }

      if (msg.type === 'leave_queue' && playerAddress) {
        removeFromQueue(playerAddress);
        console.log(`Player left queue: ${playerAddress.slice(0, 8)}...`);
      }

      // --- Match join ---
      if (msg.type === 'join_match' && msg.matchId && msg.player) {
        playerAddress = msg.player;
        const match = joinMatch(msg.matchId, msg.player, ws);
        if (match) {
          ws.send(JSON.stringify({
            type: 'state_update',
            matchId: match.matchId,
            gameState: match.gameState,
            fheMode: match.fheMode,
          }));
          console.log(`Player joined match: ${msg.player.slice(0, 8)}... → ${msg.matchId.slice(0, 8)}...`);
        }
      }

      // --- Legacy game actions (only in non-FHE mode) ---
      if (!FHE_MODE) {
        if (msg.type === 'choose_target' && msg.matchId && msg.player && msg.target) {
          const match = handleChooseTarget(msg.matchId, msg.player, msg.target);
          if (match) {
            broadcastState(match);
            console.log(`Action: ${msg.player.slice(0, 8)}... chose target ${msg.target}`);
          }
        }

        if (msg.type === 'play_card' && msg.matchId && msg.player) {
          const match = handlePlayCard(msg.matchId, msg.player, msg.card ?? null);
          if (match) {
            broadcastState(match);
            console.log(`Action: ${msg.player.slice(0, 8)}... played ${msg.card ?? 'pass'}`);
          }
        }
      }

    } catch { /* ignore malformed */ }
  });

  ws.on('close', () => {
    if (playerAddress) {
      removeFromQueue(playerAddress);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`CipherShot matchmaking server on :${PORT}`);
});
