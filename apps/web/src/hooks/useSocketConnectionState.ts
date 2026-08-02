'use client';

import { useState, useEffect } from 'react';
import { subscribeConnectionState } from '@/lib/socket-client';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export function useSocketConnectionState(namespace: string): ConnectionState {
  const [state, setState] = useState<ConnectionState>('disconnected');

  useEffect(() => {
    return subscribeConnectionState(namespace, setState);
  }, [namespace]);

  return state;
}
