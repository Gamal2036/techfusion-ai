'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getCurrentUser,
  invalidateSession,
  isAuthenticated,
  refreshSession,
} from '@/lib/auth-client';

export type SessionGuardStatus = 'checking' | 'active' | 'logged-out';

/**
 * Keeps an authenticated route alive across access-token expiry.
 *
 * Access tokens are short-lived (15m) while refresh sessions are long-lived
 * (7d). A valid refresh session must renew the access token transparently;
 * redirecting to /login purely because the JWT `exp` passed is a premature
 * logout. This guard only escalates to `logged-out` when the refresh session
 * itself is definitively invalid (revoked/expired/membership removed).
 * Transient refresh failures (API restart, 5xx) leave the route mounted so the
 * next API request retries the refresh through apiFetch.
 *
 * The interval keeps running in background tabs (browsers throttle it to
 * roughly once per minute), so an access token that expires while the tab is
 * hidden is renewed as soon as the throttled tick fires instead of forcing the
 * user back to /login.
 */
export function useSessionGuard(intervalMs = 30000): SessionGuardStatus {
  const [status, setStatus] = useState<SessionGuardStatus>('checking');

  const checkSession = useCallback(async () => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      await invalidateSession();
      setStatus('logged-out');
      return;
    }
    if (isAuthenticated()) {
      setStatus('active');
      return;
    }
    const outcome = await refreshSession();
    if (outcome === 'ok') {
      setStatus('active');
    } else if (outcome === 'invalid') {
      await invalidateSession();
      setStatus('logged-out');
    } else {
      // 'unavailable' — transient outage; stay mounted, retry next tick.
      setStatus('active');
    }
  }, []);

  useEffect(() => {
    void checkSession();
    const id = setInterval(() => void checkSession(), intervalMs);
    return () => clearInterval(id);
  }, [checkSession, intervalMs]);

  return status;
}
