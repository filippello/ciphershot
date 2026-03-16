/**
 * CipherShotGame Contract Client
 *
 * Typed helpers for all on-chain game actions.
 * Uses ethers.js for contract calls (required by fhevmjs).
 * Wallet connection stays on viem — we wrap window.ethereum with BrowserProvider.
 *
 * Pattern follows Bagel-EVM's contract-client.ts.
 */

import { Contract, BrowserProvider, type Signer, type ContractTransactionResponse, type Eip1193Provider } from 'ethers';
import { encryptCard, decryptUint8 } from './fhe';

// ================================================================
// Contract address (set after deployment)
// ================================================================

export const CONTRACT_ADDRESS = import.meta.env.VITE_CIPHERSHOT_CONTRACT || '0x843D7908AF8042199EA80f1883CD20e8d4211ba8';

// ================================================================
// ABI (minimal — only what the frontend needs)
// ================================================================

const CIPHERSHOT_ABI = [
  // Match lifecycle
  'function createMatch(bytes32 matchId, address playerA, address playerB) external',
  'function chooseTarget(bytes32 matchId, uint8 target) external',
  'function playCard(bytes32 matchId, bytes32 encCard, bytes calldata inputProof) external',
  'function finalizeRound(bytes32 matchId, uint8 decFinalTarget, uint8 decKilled, uint8 decCardPlayed) external',

  // View functions
  'function getMatchInfo(bytes32 matchId) external view returns (address playerA, address playerB, uint8 phase, address currentShooter, uint8 currentShotIndex, uint8 selectedTarget, bool playerAAlive, bool playerBAlive, address winner)',
  'function getResultHandles(bytes32 matchId) external view returns (bytes32 finalTarget, bytes32 killed, bytes32 card)',
  'function getMyBluffs(bytes32 matchId) external view returns (bytes32)',
  'function getMyRedirects(bytes32 matchId) external view returns (bytes32)',

  // Events
  'event MatchCreated(bytes32 indexed matchId, address playerA, address playerB)',
  'event TargetChosen(bytes32 indexed matchId, address shooter, uint8 target)',
  'event CardSubmitted(bytes32 indexed matchId, address responder)',
  'event ShotResolving(bytes32 indexed matchId, uint8 shotIndex, bytes32 resultFinalTarget, bytes32 resultKilled, bytes32 resultCard)',
  'event RoundFinalized(bytes32 indexed matchId, address shooter, address finalTarget, bool killed, uint8 cardPlayed, uint8 shotIndex)',
  'event GameOver(bytes32 indexed matchId, address winner)',
];

// ================================================================
// Provider / Signer helpers (same pattern as Bagel-EVM)
// ================================================================

let _provider: BrowserProvider | null = null;

/**
 * Get BrowserProvider wrapping window.ethereum.
 * CipherShot uses viem for wallet connect, this bridges to ethers for FHE.
 */
export function getProvider(): BrowserProvider {
  if (_provider) return _provider;
  if (!window.ethereum) throw new Error('No wallet detected');
  _provider = new BrowserProvider(window.ethereum as unknown as Eip1193Provider);
  return _provider;
}

export async function getSigner(): Promise<Signer> {
  return getProvider().getSigner();
}

export function getContract(signer: Signer): Contract {
  return new Contract(CONTRACT_ADDRESS, CIPHERSHOT_ABI, signer);
}

// ================================================================
// Game actions (same pattern as Bagel-EVM's registerBusiness/deposit/etc.)
// ================================================================

/**
 * Shooter chooses a target (plaintext tx, public).
 * target: 0 = self, 1 = opponent
 */
export async function chooseTargetOnChain(
  signer: Signer,
  matchId: string,
  target: number,
): Promise<ContractTransactionResponse> {
  const contract = getContract(signer);
  return contract.chooseTarget(matchId, target);
}

/**
 * Responder submits an encrypted card choice.
 * cardType: 0 = pass, 1 = bluff, 2 = redirect
 *
 * Follows Bagel-EVM pattern: encrypt → pass handles + inputProof to contract.
 */
export async function playCardOnChain(
  signer: Signer,
  matchId: string,
  cardType: number,
): Promise<ContractTransactionResponse> {
  const contract = getContract(signer);
  const address = await signer.getAddress();

  // Encrypt the card type using fhevmjs (same as Bagel's encryptValue)
  const encrypted = await encryptCard(CONTRACT_ADDRESS, address, cardType);

  return contract.playCard(matchId, encrypted.handles[0], encrypted.inputProof);
}

// ================================================================
// Read card counts (own cards only, via FHE reencryption)
// Same pattern as Bagel-EVM's decryptValue()
// ================================================================

/**
 * Read your own bluff count (decrypted via relayer SDK).
 */
export async function getMyBluffCount(
  signer: Signer,
  matchId: string,
): Promise<number> {
  const contract = getContract(signer);
  const handle = await contract.getMyBluffs(matchId);
  return decryptUint8(BigInt(handle), CONTRACT_ADDRESS, signer);
}

/**
 * Read your own redirect count (decrypted via relayer SDK).
 */
export async function getMyRedirectCount(
  signer: Signer,
  matchId: string,
): Promise<number> {
  const contract = getContract(signer);
  const handle = await contract.getMyRedirects(matchId);
  return decryptUint8(BigInt(handle), CONTRACT_ADDRESS, signer);
}

// ================================================================
// Read match state (plaintext fields)
// ================================================================

export interface OnChainMatchInfo {
  playerA: string;
  playerB: string;
  phase: number;
  currentShooter: string;
  currentShotIndex: number;
  selectedTarget: number;
  playerAAlive: boolean;
  playerBAlive: boolean;
  winner: string;
}

export async function getMatchInfo(
  signer: Signer,
  matchId: string,
): Promise<OnChainMatchInfo> {
  const contract = getContract(signer);
  const info = await contract.getMatchInfo(matchId);
  return {
    playerA: info[0],
    playerB: info[1],
    phase: Number(info[2]),
    currentShooter: info[3],
    currentShotIndex: Number(info[4]),
    selectedTarget: Number(info[5]),
    playerAAlive: info[6],
    playerBAlive: info[7],
    winner: info[8],
  };
}
