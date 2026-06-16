'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

export function useWebSocket(orgId: string | undefined, onMetrics: (data: any) => void) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!orgId) return;

    const socket = io(`${WS_URL}/metrics`, {
      query: { orgId },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('[WS] Connected to metrics stream');
    });

    socket.on('metrics', (data: any) => {
      onMetrics(data);
    });

    socket.on('disconnect', () => {
      console.log('[WS] Disconnected');
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [orgId, onMetrics]);

  const isConnected = useCallback(() => {
    return socketRef.current?.connected ?? false;
  }, []);

  return { isConnected };
}
