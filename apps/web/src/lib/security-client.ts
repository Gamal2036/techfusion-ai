'use client';

import { apiFetch, setTokens } from './auth-client';

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordResult {
  message: string;
  accessToken: string;
  refreshToken: string;
}

export interface SessionInfo {
  sessionId: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  deviceName: string | null;
  current: boolean;
}

export interface SessionsResult {
  sessions: SessionInfo[];
}

export interface RevokeSessionResult {
  message: string;
}

export interface RevokeOtherSessionsResult {
  message: string;
  revokedCount: number;
}

export class SecurityError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'SecurityError';
    this.status = status;
  }
}

async function readError(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  if (body?.message) return String(body.message);
  return `Request failed (${res.status})`;
}

export async function changePassword(input: ChangePasswordInput): Promise<ChangePasswordResult> {
  const res = await apiFetch('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw new SecurityError(await readError(res), res.status);
  }

  const data = await res.json();
  if (typeof data.accessToken === 'string' && typeof data.refreshToken === 'string') {
    setTokens(data.accessToken, data.refreshToken);
  }
  return data;
}

export async function listSessions(): Promise<SessionsResult> {
  const res = await apiFetch('/auth/sessions');
  if (!res.ok) {
    throw new SecurityError(await readError(res), res.status);
  }
  return res.json();
}

export async function revokeSession(sessionId: string): Promise<RevokeSessionResult> {
  const res = await apiFetch(`/auth/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new SecurityError(await readError(res), res.status);
  }
  return res.json();
}

export async function revokeOtherSessions(): Promise<RevokeOtherSessionsResult> {
  const res = await apiFetch('/auth/sessions', { method: 'DELETE' });
  if (!res.ok) {
    throw new SecurityError(await readError(res), res.status);
  }
  return res.json();
}

export async function revokeCurrentSession(): Promise<RevokeSessionResult> {
  const res = await apiFetch('/auth/sessions/current', { method: 'DELETE' });
  if (!res.ok) {
    throw new SecurityError(await readError(res), res.status);
  }
  return res.json();
}
