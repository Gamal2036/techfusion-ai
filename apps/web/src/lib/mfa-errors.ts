'use client';

/**
 * Typed error-mapping layer for the MFA / recovery-code API surface
 * (ACC-UX-02C). Turns raw network responses into a single MfaError carrying a
 * stable kind, an optional HTTP status, calm user-facing copy, and a retry
 * flag. Sensitive server internals are never surfaced verbatim.
 */

export type MfaErrorKind =
  | 'bad_request'
  | 'unauthenticated'
  | 'not_found'
  | 'conflict'
  | 'throttled'
  | 'unavailable'
  | 'network'
  | 'cancelled'
  | 'unknown';

export interface MfaErrorInfo {
  kind: MfaErrorKind;
  status: number | null;
  message: string;
  retryable: boolean;
}

const CALM_COPY: Record<MfaErrorKind, string> = {
  bad_request: "That wasn't accepted. Check the value and try again.",
  unauthenticated: "Your session or password wasn't accepted.",
  not_found: 'The requested security setting was not found.',
  conflict: 'That security setting is already active.',
  throttled: 'Too many attempts. Wait a moment and try again.',
  unavailable: 'The security service is temporarily unavailable. Try again shortly.',
  network: "We couldn't reach the service. Check your connection and try again.",
  cancelled: 'Request cancelled.',
  unknown: 'Something went wrong. Try again.',
};

const KIND_BY_STATUS: Record<number, { kind: MfaErrorKind; retryable: boolean }> = {
  400: { kind: 'bad_request', retryable: false },
  401: { kind: 'unauthenticated', retryable: false },
  403: { kind: 'unauthenticated', retryable: false },
  404: { kind: 'not_found', retryable: false },
  409: { kind: 'conflict', retryable: false },
  429: { kind: 'throttled', retryable: true },
};

const UNAVAILABLE_SPEC = { kind: 'unavailable' as const, retryable: true };
const UNKNOWN_SPEC = { kind: 'unknown' as const, retryable: true };

export class MfaError extends Error {
  readonly kind: MfaErrorKind;
  readonly status: number | null;
  readonly retryable: boolean;

  constructor(info: MfaErrorInfo) {
    super(info.message);
    this.name = 'MfaError';
    this.kind = info.kind;
    this.status = info.status;
    this.retryable = info.retryable;
  }
}

/**
 * Raw transport error thrown by the API client with just an HTTP status and a
 * safe backend message. The mapper is the only place that turns it into user
 * copy, so components never build messages from raw responses.
 */
export class MfaRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'MfaRequestError';
    this.status = status;
  }
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

/**
 * Backend messages are surfaced only for statuses where the API already
 * returns calm, user-safe copy (invalid TOTP, wrong password, already
 * enabled). Everything else is replaced with fixed calm copy so no raw server
 * or transport detail leaks to the UI.
 */
function messageFor(kind: MfaErrorKind, backendMessage: string, fallback: string): string {
  if (
    (kind === 'bad_request' ||
      kind === 'unauthenticated' ||
      kind === 'conflict' ||
      kind === 'not_found') &&
    backendMessage
  ) {
    return backendMessage;
  }
  if (kind === 'unknown') return fallback;
  return CALM_COPY[kind];
}

export function mapMfaError(
  error: unknown,
  fallback = 'Security request failed. Try again.',
): MfaError {
  if (error instanceof MfaError) return error;

  if (isAbortError(error)) {
    return new MfaError({ kind: 'cancelled', status: null, message: CALM_COPY.cancelled, retryable: false });
  }

  if (error instanceof MfaRequestError) {
    const spec = KIND_BY_STATUS[error.status] ?? (error.status >= 500 ? UNAVAILABLE_SPEC : UNKNOWN_SPEC);
    return new MfaError({
      kind: spec.kind,
      status: error.status,
      message: messageFor(spec.kind, error.message, fallback),
      retryable: spec.retryable,
    });
  }

  if (error instanceof TypeError) {
    return new MfaError({ kind: 'network', status: null, message: CALM_COPY.network, retryable: true });
  }

  return new MfaError({ kind: 'unknown', status: null, message: fallback, retryable: true });
}
