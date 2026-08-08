'use client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface JwtPayload {
  sub: string;
  orgId: string;
  role: 'Owner' | 'Admin' | 'Technician' | 'Viewer';
  iat?: number;
  exp?: number;
}

export type RefreshOutcome = 'ok' | 'invalid' | 'unavailable';

let refreshPromise: Promise<RefreshOutcome> | null = null;

export type AuthEvent =
  | 'auth_access_expired'
  | 'auth_refresh_started'
  | 'auth_refresh_succeeded'
  | 'auth_refresh_failed'
  | 'auth_session_cleared';

/**
 * Safe auth diagnostics: dispatches a DOM CustomEvent and (in non-production)
 * a debug log. Never includes token values — only event name and safe reason.
 */
function emitAuthEvent(event: AuthEvent, detail?: { reason?: string }): void {
  if (process.env.NODE_ENV !== 'production') {
    console.debug(`[auth] ${event}`, detail ?? {});
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('techfusion:auth-event', {
        detail: { event, ...(detail ?? {}) },
      }),
    );
  }
}

export function getAccessToken(): string | null {
  try {
    return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  } catch {
    return null;
  }
}

export function getRefreshToken(): string | null {
  try {
    return typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
  } catch {
    return null;
  }
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

export function getAuthHeaders(): Record<string, string> {
  const token = getAccessToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload as JwtPayload;
  } catch {
    return null;
  }
}

export function getCurrentUser(): JwtPayload | null {
  const token = getAccessToken();
  if (!token) return null;
  return decodeJwt(token);
}

export function isAuthenticated(): boolean {
  const user = getCurrentUser();
  if (!user) return false;
  if (user.exp && user.exp * 1000 < Date.now()) return false;
  return true;
}

export function getApiUrl(): string {
  return API_URL;
}

async function performRefresh(): Promise<RefreshOutcome> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return 'invalid';

  emitAuthEvent('auth_refresh_started');

  let res: Response;
  try {
    res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    // Network failure / API unreachable: the refresh session may still be
    // valid. Never classify a transient outage as an invalid session.
    emitAuthEvent('auth_refresh_failed', { reason: 'unavailable' });
    return 'unavailable';
  }

  if (res.status === 401 || res.status === 403) {
    emitAuthEvent('auth_refresh_failed', { reason: 'invalid' });
    return 'invalid';
  }
  if (res.status === 429 || res.status >= 500) {
    emitAuthEvent('auth_refresh_failed', { reason: 'unavailable' });
    return 'unavailable';
  }
  if (!res.ok) {
    emitAuthEvent('auth_refresh_failed', { reason: 'invalid' });
    return 'invalid';
  }

  let data: { accessToken?: unknown; refreshToken?: unknown };
  try {
    data = await res.json();
  } catch {
    emitAuthEvent('auth_refresh_failed', { reason: 'invalid' });
    return 'invalid';
  }
  if (typeof data.accessToken !== 'string' || typeof data.refreshToken !== 'string') {
    emitAuthEvent('auth_refresh_failed', { reason: 'invalid' });
    return 'invalid';
  }

  setTokens(data.accessToken, data.refreshToken);
  emitAuthEvent('auth_refresh_succeeded');
  return 'ok';
}

export function refreshSession(): Promise<RefreshOutcome> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = performRefresh().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

/**
 * Destroys the local session after a definitively invalid refresh outcome:
 * clears tokens and disconnects authenticated sockets. The caller decides how
 * to redirect. Explicit logout should use `logout()` instead.
 */
export async function invalidateSession(): Promise<void> {
  emitAuthEvent('auth_session_cleared');
  clearTokens();
  try {
    const { disconnectAll } = await import('./socket-client');
    disconnectAll();
  } catch {
    // socket-client may not be loaded yet
  }
}

function redirectToLogin(): void {
  if (
    typeof window !== 'undefined' &&
    !window.location.pathname.startsWith('/login') &&
    !window.location.pathname.startsWith('/signup')
  ) {
    window.location.href = '/login';
  }
}

export async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = path.startsWith('http') ? path : `${API_URL}${path}`;
  const headers = {
    ...getAuthHeaders(),
    ...((options.headers as Record<string, string>) || {}),
  };

  let res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    emitAuthEvent('auth_access_expired');
    if (!getRefreshToken()) return res;

    const outcome = await refreshSession();
    if (outcome === 'ok') {
      const retryHeaders = {
        ...getAuthHeaders(),
        ...((options.headers as Record<string, string>) || {}),
      };
      res = await fetch(url, { ...options, headers: retryHeaders });
      if (res.status === 401) {
        // A fresh token is still rejected: the session is truly invalid.
        await invalidateSession();
        redirectToLogin();
      }
      return res;
    }
    if (outcome === 'invalid') {
      await invalidateSession();
      redirectToLogin();
      return res;
    }
    // 'unavailable' — transient refresh failure. Preserve the session and
    // return the original 401 to the caller; polling continues and the next
    // cycle retries the refresh.
    return res;
  }

  return res;
}

export async function logout(): Promise<void> {
  const token = getAccessToken();
  if (token) {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
    } catch {
      // Continue with local cleanup even if backend logout fails
    }
  }

  try {
    const { disconnectAll } = await import('./socket-client');
    disconnectAll();
  } catch {
    // socket-client may not be loaded yet
  }

  clearTokens();
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
}

export function canAccess(user: JwtPayload | null, requiredRoles: string[]): boolean {
  if (!user) return false;
  if (requiredRoles.length === 0) return true;
  return requiredRoles.includes(user.role);
}

export function isOwner(user: JwtPayload | null): boolean {
  return user?.role === 'Owner';
}

export function isAdminOrAbove(user: JwtPayload | null): boolean {
  return user?.role === 'Owner' || user?.role === 'Admin';
}

export function isTechnicianOrAbove(user: JwtPayload | null): boolean {
  return user?.role === 'Owner' || user?.role === 'Admin' || user?.role === 'Technician';
}
