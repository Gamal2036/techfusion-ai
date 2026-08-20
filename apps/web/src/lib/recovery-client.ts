'use client';

import { getApiUrl } from './auth-client';

const API_URL = getApiUrl();

export type RecoveryErrorKind =
  | 'rate_limited'
  | 'network'
  | 'server'
  | 'unknown';

export interface RecoveryError {
  kind: RecoveryErrorKind;
  message: string;
}

export async function requestPasswordReset(email: string): Promise<{ ok: true }> {
  const trimmed = email.trim().toLowerCase();
  let res: Response;
  try {
    res = await fetch(`${API_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: trimmed }),
    });
  } catch {
    throw {
      kind: 'network',
      message: "We couldn't reach the service. Check your connection and try again.",
    } satisfies RecoveryError;
  }

  if (res.status === 429) {
    throw {
      kind: 'rate_limited',
      message:
        'Too many requests. Wait a moment before trying again.',
    } satisfies RecoveryError;
  }

  if (!res.ok) {
    throw {
      kind: 'server',
      message: "We couldn't process your request. Try again.",
    } satisfies RecoveryError;
  }

  return { ok: true };
}

export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<{ ok: true }> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });
  } catch {
    throw {
      kind: 'network',
      message: "We couldn't reach the service. Check your connection and try again.",
    } satisfies RecoveryError;
  }

  if (res.status === 429) {
    throw {
      kind: 'rate_limited',
      message:
        'Too many requests. Wait a moment before trying again.',
    } satisfies RecoveryError;
  }

  if (!res.ok) {
    const isTokenError = res.status === 400;

    if (isTokenError) {
      let body: { message?: string } = {};
      try {
        body = await res.json();
      } catch {
        // ignore
      }
      const msg = typeof body.message === 'string' ? body.message : '';
      if (
        msg.toLowerCase().includes('expired') ||
        msg.toLowerCase().includes('invalid')
      ) {
        throw {
          kind: 'unknown',
          message: 'invalid_token',
        } satisfies RecoveryError;
      }
    }

    throw {
      kind: 'server',
      message: "We couldn't reset your password. Try again.",
    } satisfies RecoveryError;
  }

  return { ok: true };
}
