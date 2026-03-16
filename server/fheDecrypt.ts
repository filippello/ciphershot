/**
 * Server-side FHE public decryption using @zama-fhe/relayer-sdk.
 *
 * Uses the official Zama Relayer SDK (Node.js entry) to call publicDecrypt()
 * on handles that were marked with FHE.makePubliclyDecryptable() on-chain.
 */

// @ts-expect-error — relayer-sdk/node ships CJS, no TS declarations for this import
import { createInstance, type FhevmInstance } from '@zama-fhe/relayer-sdk/node';

const RPC_URL = process.env.RPC_URL || '';

// Sepolia config matching CDN relayer-sdk-js v0.4.1 + @fhevm/solidity 0.11.1
const SEPOLIA_CONFIG = {
  aclContractAddress: '0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D',
  kmsContractAddress: '0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A',
  inputVerifierContractAddress: '0xBBC1fFCdc7C316aAAd72E807D9b0272BE8F84DA0',
  verifyingContractAddressDecryption: '0x5D8BD78e2ea6bbE41f26dFe9fdaEAa349e077478',
  verifyingContractAddressInputVerification: '0x483b9dE06E4E4C7D35CCf5837A1668487406D955',
  chainId: 11155111,
  gatewayChainId: 10901,
  relayerUrl: 'https://relayer.testnet.zama.org',
};

let instance: FhevmInstance | null = null;

async function getInstance(): Promise<FhevmInstance> {
  if (instance) return instance;
  console.log('[FHE Decrypt] Initializing Relayer SDK (Node.js)...');
  instance = await createInstance({
    ...SEPOLIA_CONFIG,
    network: RPC_URL,
  });
  console.log('[FHE Decrypt] Relayer SDK ready');
  return instance;
}

export interface ShotDecryptResult {
  finalTarget: number;  // 0=shooter, 1=opponent
  killed: number;       // 0=no, 1=yes
  cardPlayed: number;   // 0=pass, 1=bluff, 2=redirect
}

/**
 * Decrypt three publicly-decryptable euint8 handles from a ShotResolving event.
 */
export async function decryptShotResult(
  handles: { finalTarget: string; killed: string; card: string },
  _contractAddress: string,
): Promise<ShotDecryptResult> {
  const inst = await getInstance();
  const handleList = [handles.finalTarget, handles.killed, handles.card];

  console.log('[FHE Decrypt] Calling publicDecrypt for 3 handles...');
  const result = await inst.publicDecrypt(handleList);

  const finalTarget = Number(result[handles.finalTarget] ?? 0);
  const killed = Number(result[handles.killed] ?? 0);
  const cardPlayed = Number(result[handles.card] ?? 0);

  console.log(`[FHE Decrypt] Done: target=${finalTarget} killed=${killed} card=${cardPlayed}`);
  return { finalTarget, killed, cardPlayed };
}
