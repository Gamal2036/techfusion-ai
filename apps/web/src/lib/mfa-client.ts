'use client';

import { apiFetch } from './auth-client';
import { mapMfaError, MfaRequestError } from './mfa-errors';

/**
 * ACC-UX-02C — MFA + recovery-code client (single capability module).
 *
 * Mirrors the verified backend contracts in `apps/api-gateway/src/mfa/*`:
 *   GET  /mfa/status                  -> { isMfaEnabled }
 *   POST /mfa/enroll                  -> { secret, qrCode }  (plaintext once)
 *   POST /mfa/verify                  -> { message }          (token = TOTP)
 *   POST /mfa/disable                 -> { message }          (password + TOTP | recoveryCode)
 *   POST /mfa/recovery-codes/generate  -> { codes }           (password + TOTP)
 *   POST /mfa/recovery-codes/regenerate-> { codes }           (password + TOTP)
 *   GET  /mfa/recovery-codes/status   -> { generated, availableCount }
 *
 * Recovery-code and TOTP normalization helpers mirror
 * `recovery-codes.util.ts` (canonical alphabet A-Z2-7, groups XXXX-XXXX-XXXX-XXXX)
 * so submitted values always match what the backend hashes.
 */

export interface MfaStatus {
  isMfaEnabled: boolean;
}

export interface MfaEnrollment {
  secret: string;
  qrCode: string;
}

export interface RecoveryCodesStatus {
  generated: boolean;
  availableCount: number;
}

export interface MfaActionResult {
  message: string;
}

export interface RecoveryCodesResult {
  codes: string[];
}

export const RECOVERY_CODE_GROUP_LENGTH = 4;
export const RECOVERY_CODE_GROUPS = 4;
export const RECOVERY_CODE_COUNT = 10;
export const RECOVERY_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function normalizeRecoveryCode(input: string): string {
  return input.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

export function isValidRecoveryCode(input: string): boolean {
  const normalized = normalizeRecoveryCode(input);
  if (normalized.length !== RECOVERY_CODE_GROUPS * RECOVERY_CODE_GROUP_LENGTH) return false;
  for (const ch of normalized) {
    if (!RECOVERY_CODE_ALPHABET.includes(ch)) return false;
  }
  return true;
}

export function normalizeTotp(value: string): string {
  return value.replace(/\D/g, '').slice(0, 6);
}

export function isValidTotp(value: string): boolean {
  return /^\d{6}$/.test(value);
}

async function apiCall<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await apiFetch(path, init);
  } catch (error) {
    throw mapMfaError(error);
  }
  if (!res.ok) {
    const message = await res
      .json()
      .then((body: unknown) => {
        if (body && typeof body === 'object' && 'message' in body && typeof (body as { message?: unknown }).message === 'string') {
          return (body as { message: string }).message;
        }
        return '';
      })
      .catch(() => '');
    throw mapMfaError(new MfaRequestError(message || `Request failed (${res.status})`, res.status));
  }
  return (await res.json()) as T;
}

export async function fetchMfaStatus(): Promise<MfaStatus> {
  return apiCall<MfaStatus>('/mfa/status');
}

export async function enrollMfa(): Promise<MfaEnrollment> {
  return apiCall<MfaEnrollment>('/mfa/enroll', { method: 'POST' });
}

export async function verifyMfaEnrollment(token: string): Promise<MfaActionResult> {
  return apiCall<MfaActionResult>('/mfa/verify', { method: 'POST', body: JSON.stringify({ token }) });
}

export interface DisableMfaInput {
  password: string;
  token?: string;
  recoveryCode?: string;
}

export async function disableMfa(input: DisableMfaInput): Promise<MfaActionResult> {
  const body: Record<string, string> = { password: input.password };
  if (input.token) body.token = input.token;
  if (input.recoveryCode) body.recoveryCode = input.recoveryCode;
  return apiCall<MfaActionResult>('/mfa/disable', { method: 'POST', body: JSON.stringify(body) });
}

export interface RecoveryCodesChallengeInput {
  password: string;
  token: string;
}

export async function generateRecoveryCodes(input: RecoveryCodesChallengeInput): Promise<RecoveryCodesResult> {
  return apiCall<RecoveryCodesResult>('/mfa/recovery-codes/generate', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function regenerateRecoveryCodes(input: RecoveryCodesChallengeInput): Promise<RecoveryCodesResult> {
  return apiCall<RecoveryCodesResult>('/mfa/recovery-codes/regenerate', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function fetchRecoveryCodesStatus(): Promise<RecoveryCodesStatus> {
  return apiCall<RecoveryCodesStatus>('/mfa/recovery-codes/status');
}
