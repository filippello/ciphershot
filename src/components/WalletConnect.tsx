import { useState } from 'react';
import { hasWalletProvider, connectWallet } from '@/lib/wallet';

interface Props {
  onConnected: (address: string) => void;
}

export default function WalletConnect({ onConnected }: Props) {
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);
  const hasProvider = hasWalletProvider();

  const handleConnect = async () => {
    setError('');
    setConnecting(true);
    try {
      const { address } = await connectWallet();
      onConnected(address);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      gap: '32px',
      fontFamily: 'monospace',
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ color: '#ff4444', fontSize: '48px', margin: 0 }}>
          CIPHERSHOT
        </h1>
        <p style={{ color: '#666677', fontSize: '14px', marginTop: '8px' }}>
          A duel of bluffs and bullets
        </p>
      </div>

      {hasProvider ? (
        <button
          onClick={handleConnect}
          disabled={connecting}
          style={{
            padding: '14px 40px',
            background: connecting ? '#1a1a2e' : '#1a2e1a',
            color: connecting ? '#666677' : '#88cc88',
            border: `1px solid ${connecting ? '#2a2a3e' : '#3a5e3a'}`,
            fontFamily: 'monospace',
            cursor: connecting ? 'wait' : 'pointer',
            fontSize: '16px',
          }}
        >
          {connecting ? 'CONNECTING...' : 'CONNECT WALLET'}
        </button>
      ) : (
        <div style={{ textAlign: 'center', color: '#ff6666', fontSize: '13px' }}>
          No wallet detected.<br />
          Install MetaMask or another browser wallet.
        </div>
      )}

      {error && (
        <div style={{ color: '#ff4444', fontSize: '12px', maxWidth: '400px', textAlign: 'center' }}>
          {error}
        </div>
      )}

      <p style={{ color: '#444455', fontSize: '11px', maxWidth: '300px', textAlign: 'center' }}>
        Connect your wallet to enter the arena. Your address becomes your identity.
      </p>
    </div>
  );
}
