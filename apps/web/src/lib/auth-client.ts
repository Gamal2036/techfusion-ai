'use client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface JwtPayload {
  sub: string;
  orgId: string;
  role: 'Owner' | 'Admin' | 'Technician' | 'Viewer';
  iat?: number;
  exp?: number;
}

let refreshPromise: Promise<boolean> | null = null;

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

async function performRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) return false;

    const data = await res.json();
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

export async function refreshSession(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = performRefresh().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
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

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401 && getRefreshToken()) {
    const refreshed = await refreshSession();
    if (refreshed) {
      const retryHeaders = {
        ...getAuthHeaders(),
        ...((options.headers as Record<string, string>) || {}),
      };
      return fetch(url, { ...options, headers: retryHeaders });
    }
    clearTokens();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/signup')) {
      window.location.href = '/login';
    }
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
