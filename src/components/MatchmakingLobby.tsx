import { useState, useEffect, useRef, useCallback } from 'react';
import { shortAddress } from '@/lib/wallet';
import { connectMatchmaking, type ServerEvent, type MatchFoundEvent } from '@/lib/matchmaking';
import { playSound, playLoop, stopLoop } from '@/lib/audio';
import Tutorial from './Tutorial';

interface Props {
  playerAddress: string;
  onMatchFound: (match: MatchFoundEvent) => void;
  onDisconnect: () => void;
}

export default function MatchmakingLobby({ playerAddress, onMatchFound, onDisconnect }: Props) {
  const [status, setStatus] = useState<'idle' | 'queued' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const connectionRef = useRef<{ close: () => void } | null>(null);

  const handleEvent = useCallback((event: ServerEvent) => {
    if (event.type === 'queued') {
      setStatus('queued');
      setMessage(`In queue (position ${event.position})`);
    } else if (event.type === 'match_found') {
      setStatus('idle');
      onMatchFound(event);
    } else if (event.type === 'error') {
      setStatus('error');
      setMessage(event.message);
    }
  }, [onMatchFound]);

  const joinQueue = () => {
    if (connectionRef.current) connectionRef.current.close();
    playSound('click_button', 0.5);
    setStatus('queued');
    setMessage('Connecting...');
    connectionRef.current = connectMatchmaking(playerAddress, handleEvent);
    playLoop('queue_waiting', 0.12);
  };

  const leaveQueue = () => {
    if (connectionRef.current) {
      connectionRef.current.close();
      connectionRef.current = null;
    }
    playSound('click_button', 0.4);
    stopLoop();
    setStatus('idle');
    setMessage('');
  };

  useEffect(() => {
    return () => {
      if (connectionRef.current) connectionRef.current.close();
      stopLoop();
    };
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      minHeight: '100vh',
      padding: '60px 16px 24px',
      fontFamily: 'monospace',
      overflowY: 'auto',
    }}>
      {/* Top bar */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        zIndex: 10,
      }}>
        <span style={{ color: '#88cc88', fontSize: '12px', fontFamily: 'monospace' }}>
          {shortAddress(playerAddress)}
        </span>
        <button
          onClick={onDisconnect}
          style={{
            padding: '4px 12px',
            background: '#2e1a1a',
            color: '#cc8888',
            border: '1px solid #5e3a3a',
            fontFamily: 'monospace',
            cursor: 'pointer',
            fontSize: '11px',
          }}
        >
          DISCONNECT
        </button>
      </div>

      {/* Title */}
      <h1 style={{ color: '#ff4444', fontSize: '36px', margin: '0 0 20px' }}>CIPHERSHOT</h1>

      {/* Action area */}
      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
        {status === 'idle' && (
          <button
            onClick={joinQueue}
            style={{
              padding: '16px 48px',
              background: '#1a2e1a',
              color: '#88cc88',
              border: '1px solid #3a5e3a',
              fontFamily: 'monospace',
              cursor: 'pointer',
              fontSize: '18px',
            }}
          >
            FIND MATCH
          </button>
        )}

        {status === 'queued' && (
          <div>
            <div style={{
              color: '#ffcc44',
              fontSize: '16px',
              marginBottom: '12px',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}>
              {message}
            </div>
            <button
              onClick={leaveQueue}
              style={{
                padding: '8px 24px',
                background: '#2e1a1a',
                color: '#cc8888',
                border: '1px solid #5e3a3a',
                fontFamily: 'monospace',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              CANCEL
            </button>
            <style>{`
              @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
              }
            `}</style>
          </div>
        )}

        {status === 'error' && (
          <div>
            <div style={{ color: '#ff4444', fontSize: '14px', marginBottom: '12px' }}>
              {message}
            </div>
            <button
              onClick={joinQueue}
              style={{
                padding: '8px 24px',
                background: '#2a2a3e',
                color: '#8888aa',
                border: '1px solid #3a3a5e',
                fontFamily: 'monospace',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              RETRY
            </button>
          </div>
        )}
      </div>

      {/* Tutorial — always visible */}
      <Tutorial />
    </div>
  );
}
