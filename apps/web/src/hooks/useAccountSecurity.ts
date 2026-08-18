'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  listSessions,
  type SessionInfo,
  type SessionsResult,
} from '@/lib/security-client';
import { isLoggingOut, LogoutCancellationError } from '@/lib/auth-client';

export type SessionsLoadState =
  | { status: 'loading' }
  | { status: 'failed'; message: string }
  | { status: 'ready'; sessions: SessionInfo[] };

export function useAccountSecurity() {
  const [sessionsState, setSessionsState] = useState<SessionsLoadState>({
    status: 'loading',
  });
  const mountedRef = useRef(true);

  const loadSessions = useCallback(async () => {
    setSessionsState((prev) =>
      prev.status === 'ready' ? { status: 'loading' } : prev,
    );
    try {
      const result: SessionsResult = await listSessions();
      if (mountedRef.current) {
        setSessionsState({ status: 'ready', sessions: result.sessions });
      }
    } catch (e) {
      if (isLoggingOut() || e instanceof LogoutCancellationError) return;
      if (mountedRef.current) {
        setSessionsState({
          status: 'failed',
          message:
            e instanceof Error ? e.message : 'Failed to load active sessions.',
        });
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadSessions();
    return () => {
      mountedRef.current = false;
    };
  }, [loadSessions]);

  return {
    sessionsState,
    refreshSessions: loadSessions,
  };
}
