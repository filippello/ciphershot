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

export function hasWalletProvider(): boolean {
  return typeof window !== 'undefined' && !!window.ethereum;
}

export async function connectWallet(): Promise<{ address: Address; client: WalletClient }> {
  if (!window.ethereum) {
    throw new Error('No wallet detected. Install MetaMask or another browser wallet.');
  }

  const client = createWalletClient({
    chain: sepolia,
    transport: custom(window.ethereum),
  });

  const [address] = await client.requestAddresses();
  return { address, client };
}

export function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
