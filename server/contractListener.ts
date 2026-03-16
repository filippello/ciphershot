/**
 * Contract Event Listener
 *
 * Watches CipherShotGame contract events and relays them to WebSocket clients.
 * In FHE mode, the server's role changes from "game engine" to "event relay":
 *   - Matchmaking still happens via WebSocket
 *   - Game actions go directly to the contract (from client wallets)
 *   - Server watches events and broadcasts state updates
 *   - Server decrypts publicly-decryptable results and calls finalizeRound
 */

import { ethers } from 'ethers';

// Contract address (from deployment)
const CONTRACT_ADDRESS = process.env.CIPHERSHOT_CONTRACT || '0x843D7908AF8042199EA80f1883CD20e8d4211ba8';
const RPC_URL = process.env.RPC_URL || 'https://sepolia.infura.io/v3/YOUR_KEY';
const SERVER_PRIVATE_KEY = process.env.SERVER_PRIVATE_KEY || '';

// Minimal ABI for events + finalizeRound
const CIPHERSHOT_ABI = [
  'event MatchCreated(bytes32 indexed matchId, address playerA, address playerB)',
  'event TargetChosen(bytes32 indexed matchId, address shooter, uint8 target)',
  'event CardSubmitted(bytes32 indexed matchId, address responder)',
  'event ShotResolving(bytes32 indexed matchId, uint8 shotIndex, bytes32 resultFinalTarget, bytes32 resultKilled, bytes32 resultCard)',
  'event RoundFinalized(bytes32 indexed matchId, address shooter, address finalTarget, bool killed, uint8 cardPlayed, uint8 shotIndex)',
  'event GameOver(bytes32 indexed matchId, address winner)',

  'function finalizeRound(bytes32 matchId, uint8 decFinalTarget, uint8 decKilled, uint8 decCardPlayed) external',
  'function createMatch(bytes32 matchId, address playerA, address playerB) external',
  'function getMatchInfo(bytes32 matchId) external view returns (address playerA, address playerB, uint8 phase, address currentShooter, uint8 currentShotIndex, uint8 selectedTarget, bool playerAAlive, bool playerBAlive, address winner)',
  'function getResultHandles(bytes32 matchId) external view returns (bytes32 finalTarget, bytes32 killed, bytes32 card)',
];

export interface GameEvent {
  type: 'target_chosen' | 'card_submitted' | 'shot_resolving' | 'round_finalized' | 'game_over';
  matchId: string;
  data: Record<string, unknown>;
}

let provider: ethers.JsonRpcProvider | null = null;
let serverWallet: ethers.Wallet | null = null;
let contract: ethers.Contract | null = null;

/**
 * Initialize the contract listener.
 * Returns false if contract address is not configured (FHE mode disabled).
 */
export function initContractListener(): boolean {
  if (!CONTRACT_ADDRESS) {
    console.log('[Contract] No contract address configured — running in legacy mode');
    return false;
  }

  provider = new ethers.JsonRpcProvider(RPC_URL);
  serverWallet = new ethers.Wallet(SERVER_PRIVATE_KEY, provider);
  contract = new ethers.Contract(CONTRACT_ADDRESS, CIPHERSHOT_ABI, serverWallet);

  console.log(`[Contract] Listening to CipherShotGame at ${CONTRACT_ADDRESS}`);
  return true;
}

/**
 * Create a match on-chain (called by server after matchmaking pairs two players).
 */
export async function createMatchOnChain(
  matchId: string,
  playerA: string,
  playerB: string,
): Promise<string> {
  if (!contract) throw new Error('Contract not initialized');

  // Convert UUID matchId to bytes32
  const matchIdBytes = ethers.keccak256(ethers.toUtf8Bytes(matchId));

  const tx = await contract.createMatch(matchIdBytes, playerA, playerB);
  const receipt = await tx.wait();

  console.log(`[Contract] Match created on-chain: ${matchId} → tx ${receipt.hash}`);
  return matchIdBytes;
}

/**
 * Start watching contract events and relay them via callback.
 */
export function startEventListener(onEvent: (event: GameEvent) => void): void {
  if (!contract) return;

  contract.on('TargetChosen', (matchId: string, shooter: string, target: bigint) => {
    onEvent({
      type: 'target_chosen',
      matchId,
      data: { shooter, target: Number(target) },
    });
  });

  contract.on('CardSubmitted', (matchId: string, responder: string) => {
    onEvent({
      type: 'card_submitted',
      matchId,
      data: { responder },
    });
  });

  contract.on('ShotResolving', async (matchId: string, shotIndex: bigint, resultFinalTarget: string, resultKilled: string, resultCard: string) => {
    console.log(`[Contract] ShotResolving: match=${matchId.slice(0, 10)}... shot=${shotIndex}`);

    onEvent({
      type: 'shot_resolving',
      matchId,
      data: {
        shotIndex: Number(shotIndex),
        handles: { resultFinalTarget, resultKilled, resultCard },
      },
    });

    // TODO: Decrypt the publicly-decryptable handles via relayer SDK
    // and call finalizeRound. For hackathon, the client will trigger
    // finalization after suspense countdown.
  });

  contract.on('RoundFinalized', (matchId: string, shooter: string, finalTarget: string, killed: boolean, cardPlayed: bigint, shotIndex: bigint) => {
    onEvent({
      type: 'round_finalized',
      matchId,
      data: {
        shooter,
        finalTarget,
        killed,
        cardPlayed: Number(cardPlayed),
        shotIndex: Number(shotIndex),
      },
    });
  });

  contract.on('GameOver', (matchId: string, winner: string) => {
    onEvent({
      type: 'game_over',
      matchId,
      data: { winner },
    });
  });

  console.log('[Contract] Event listeners active');
}

/**
 * Call finalizeRound on contract (server calls after decrypting results).
 */
export async function finalizeRoundOnChain(
  matchIdBytes: string,
  decFinalTarget: number,
  decKilled: number,
  decCardPlayed: number,
): Promise<void> {
  if (!contract) throw new Error('Contract not initialized');

  const tx = await contract.finalizeRound(matchIdBytes, decFinalTarget, decKilled, decCardPlayed);
  await tx.wait();

  console.log(`[Contract] Round finalized: match=${matchIdBytes.slice(0, 10)}...`);
}

/**
 * Read match info from contract.
 */
export async function getMatchInfoOnChain(matchIdBytes: string) {
  if (!contract) throw new Error('Contract not initialized');

  const info = await contract.getMatchInfo(matchIdBytes);
  return {
    playerA: info[0] as string,
    playerB: info[1] as string,
    phase: Number(info[2]),
    currentShooter: info[3] as string,
    currentShotIndex: Number(info[4]),
    selectedTarget: Number(info[5]),
    playerAAlive: info[6] as boolean,
    playerBAlive: info[7] as boolean,
    winner: info[8] as string,
  };
}
