'use client';

import { useEffect, useRef } from 'react';
import { subscribe } from '@/lib/socket-client';

export function useWebSocket(onMetrics: (data: any) => void) {
  const callbackRef = useRef(onMetrics);
  callbackRef.current = onMetrics;

  useEffect(() => {
    const unsubscribe = subscribe('/metrics', 'metrics', (data: any) => {
      callbackRef.current(data);
    });
    return unsubscribe;
  }, []);
}
