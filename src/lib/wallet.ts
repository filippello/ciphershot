import { createWalletClient, custom, type WalletClient, type Address } from 'viem';
import { sepolia } from 'viem/chains';

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, cb: (...args: unknown[]) => void) => void;
      removeListener: (event: string, cb: (...args: unknown[]) => void) => void;
    };
  }
}

// Zama fhEVM runs on Sepolia — use Sepolia chain config
const chain = sepolia;

export function hasWalletProvider(): boolean {
  return typeof window !== 'undefined' && !!window.ethereum;
}

export async function connectWallet(): Promise<{ address: Address; client: WalletClient }> {
  if (!window.ethereum) {
    throw new Error('No wallet detected. Install MetaMask or another browser wallet.');
  }

  const client = createWalletClient({
    chain,
    transport: custom(window.ethereum),
  });

  const [address] = await client.requestAddresses();

  // Ensure wallet is on the right chain
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${chain.id.toString(16)}` }],
    });
  } catch {
    // Chain not added or user rejected — continue anyway
  }

  return { address, client };
}

export function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
