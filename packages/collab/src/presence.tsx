'use client';

import type { CSSProperties } from 'react';
import { useCollabPeers } from './hooks';
import type { CollabProvider } from './provider';

export interface CollabPresenceProps {
  provider: CollabProvider | null;
  className?: string;
  style?: CSSProperties;
}

export function CollabPresence({ provider, className, style }: CollabPresenceProps) {
  const peers = useCollabPeers(provider);
  if (peers.length === 0) return null;
  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', gap: 6, ...style }}>
      {peers.map((peer) => (
        <span
          key={peer.clientId}
          title={peer.user?.name ?? `peer ${peer.clientId}`}
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 600,
            color: '#fff',
            backgroundColor: peer.user?.color ?? '#888',
          }}
        >
          {(peer.user?.name ?? '?').slice(0, 1).toUpperCase()}
        </span>
      ))}
    </div>
  );
}
