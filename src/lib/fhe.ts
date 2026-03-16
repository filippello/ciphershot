/**
 * Zama fhEVM Client Library for CipherShot
 *
 * Uses the official Zama Relayer SDK loaded from CDN (index.html script tag).
 * Provides encrypted input creation (for card submissions) and user decryption
 * (for reading your own card counts).
 *
 * Adapted from Bagel-EVM's fhevm.ts.
 */

import type { Signer } from 'ethers';

// ================================================================
// Types for window.relayerSDK (matches Bagel-EVM pattern)
// ================================================================

interface RelayerSDK {
  initSDK: (options?: Record<string, unknown>) => Promise<boolean>;
  createInstance: (config: Record<string, unknown>) => Promise<FhevmInstance>;
  SepoliaConfig: Record<string, unknown> & {
    aclContractAddress: string;
    kmsContractAddress: string;
    relayerUrl: string;
  };
  __initialized__?: boolean;
}

interface FhevmInstance {
  createEncryptedInput: (contractAddress: string, userAddress: string) => EncryptedInput;
  generateKeypair: () => { publicKey: string; privateKey: string };
  createEIP712: (
    publicKey: string,
    contractAddresses: string[],
    startTimestamp?: number,
    durationDays?: number,
  ) => {
    domain: Record<string, unknown>;
    types: Record<string, Array<{ name: string; type: string }>>;
    message: Record<string, unknown>;
    primaryType: string;
  };
  userDecrypt: (
    requests: Array<{ handle: string; contractAddress: string }>,
    privateKey: string,
    publicKey: string,
    signature: string,
    contractAddresses: string[],
    userAddress: string,
    startTimestamp: number,
    durationDays: number,
  ) => Promise<Record<string, bigint | string | boolean>>;
  getPublicKey: () => Uint8Array | null;
  getPublicParams: (capacity: number) => unknown;
}

interface EncryptedInput {
  add8: (value: number) => void;
  add64: (value: bigint) => void;
  addAddress: (value: string) => void;
  encrypt: () => Promise<{ handles: Uint8Array[]; inputProof: Uint8Array }>;
}

declare global {
  interface Window {
    relayerSDK?: RelayerSDK;
  }
}

// ================================================================
// Singleton instance
// ================================================================

let instance: FhevmInstance | null = null;
let initPromise: Promise<FhevmInstance> | null = null;
let lastInitError: string | null = null;

/**
 * Wait for the Relayer SDK to be available on window.
 * Loaded via script tag in index.html.
 */
function waitForRelayerSDK(timeoutMs = 15000): Promise<RelayerSDK> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Can only be used in the browser'));
  }

  if (window.relayerSDK && typeof window.relayerSDK.initSDK === 'function') {
    return Promise.resolve(window.relayerSDK);
  }

  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const check = () => {
      if (window.relayerSDK && typeof window.relayerSDK.initSDK === 'function') {
        resolve(window.relayerSDK);
        return;
      }
      if (Date.now() - startTime > timeoutMs) {
        reject(new Error('Relayer SDK not found after ' + timeoutMs + 'ms. Check CDN script.'));
        return;
      }
      setTimeout(check, 100);
    };
    check();
  });
}

/**
 * Initialize the fhEVM instance. Safe to call multiple times.
 * Follows the same pattern as Bagel-EVM's initFhevm().
 */
export async function initFhevm(): Promise<FhevmInstance> {
  if (instance) return instance;
  if (initPromise) return initPromise;

  initPromise = _doInit();

  try {
    return await initPromise;
  } catch (err: unknown) {
    lastInitError = err instanceof Error ? err.message : 'Unknown fhEVM init error';
    initPromise = null;
    throw err;
  }
}

async function _doInit(): Promise<FhevmInstance> {
  console.log('[fhEVM] Waiting for Relayer SDK...');
  const sdk = await waitForRelayerSDK();
  console.log('[fhEVM] Relayer SDK found, initializing WASM...');

  if (!sdk.__initialized__) {
    const result = await sdk.initSDK();
    sdk.__initialized__ = result;
    if (!result) throw new Error('Relayer SDK initSDK() returned false');
  }
  console.log('[fhEVM] WASM initialized, creating instance...');

  // Get the EIP-1193 provider (MetaMask)
  const eip1193 = typeof window !== 'undefined' ? (window as any).ethereum : null;
  if (!eip1193) throw new Error('No EIP-1193 provider (install MetaMask)');

  // Create instance with SepoliaConfig (same as Bagel-EVM)
  const config = {
    ...sdk.SepoliaConfig,
    relayerUrl: `${sdk.SepoliaConfig.relayerUrl}/v2`,
    network: eip1193,
    relayerRouteVersion: 2,
  };

  instance = await sdk.createInstance(config);
  console.log('[fhEVM] Instance created successfully!');
  return instance;
}

async function ensureInstance(): Promise<FhevmInstance> {
  if (instance) return instance;
  return initFhevm();
}

export function getFhevmInstance(): FhevmInstance | null {
  return instance;
}

export function getInitError(): string | null {
  return lastInitError;
}

// ================================================================
// Encrypt card type (euint8) for playCard()
// Same pattern as Bagel-EVM's encryptValue() but using add8 for uint8
// ================================================================

/**
 * Encrypt a card type (0=pass, 1=bluff, 2=redirect) for on-chain submission.
 */
export async function encryptCard(
  contractAddress: string,
  userAddress: string,
  cardType: number,
): Promise<{ handles: Uint8Array[]; inputProof: Uint8Array }> {
  const inst = await ensureInstance();
  const input = inst.createEncryptedInput(contractAddress, userAddress);
  input.add8(cardType);
  return input.encrypt();
}

// ================================================================
// Decrypt own card counts (via userDecrypt)
// Same pattern as Bagel-EVM's decryptValue()
// ================================================================

/**
 * Decrypt an encrypted euint8 handle (used for reading own bluff/redirect counts).
 */
export async function decryptUint8(
  handle: bigint,
  contractAddress: string,
  signer: Signer,
): Promise<number> {
  const inst = await ensureInstance();

  const address = await signer.getAddress();
  const handleHex = '0x' + handle.toString(16).padStart(64, '0');

  // Generate keypair (same as Bagel-EVM)
  const keypair = inst.generateKeypair();

  // Create EIP712 for signing
  const now = Math.floor(Date.now() / 1000);
  const durationDays = 1;
  const eip712 = inst.createEIP712(keypair.publicKey, [contractAddress], now, durationDays);

  // Sign with wallet (cast to any like Bagel-EVM does)
  const signature = await signer.signTypedData(
    eip712.domain as any,
    { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification } as any,
    eip712.message as any,
  );

  // Call userDecrypt
  const results = await inst.userDecrypt(
    [{ handle: handleHex, contractAddress }],
    keypair.privateKey,
    keypair.publicKey,
    signature,
    [contractAddress],
    address,
    now,
    durationDays,
  );

  const result = results[handleHex];
  if (result === undefined) throw new Error('Decryption returned no result for handle');

  return Number(result);
}
