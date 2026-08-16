import '@testing-library/jest-dom';
import { mapMfaError, MfaError, MfaRequestError } from '@/lib/mfa-errors';

describe('mapMfaError — typed MFA error mapping layer', () => {
  it('maps 400 to bad_request and surfaces the safe backend message', () => {
    const error = mapMfaError(new MfaRequestError('Invalid TOTP token', 400));
    expect(error).toBeInstanceOf(MfaError);
    expect(error.kind).toBe('bad_request');
    expect(error.status).toBe(400);
    expect(error.message).toBe('Invalid TOTP token');
    expect(error.retryable).toBe(false);
  });

  it('maps 401 to unauthenticated with the deterministic re-auth message', () => {
    const error = mapMfaError(new MfaRequestError('Current password is incorrect', 401));
    expect(error.kind).toBe('unauthenticated');
    expect(error.message).toBe('Current password is incorrect');
    expect(error.retryable).toBe(false);
  });

  it('maps 403 to unauthenticated (forbidden session)', () => {
    const error = mapMfaError(new MfaRequestError('Forbidden', 403));
    expect(error.kind).toBe('unauthenticated');
  });

  it('maps 409 to conflict and keeps the backend message', () => {
    const error = mapMfaError(new MfaRequestError('MFA already enabled', 409));
    expect(error.kind).toBe('conflict');
    expect(error.message).toBe('MFA already enabled');
  });

  it('maps 429 to throttled with calm copy and marks retryable', () => {
    const error = mapMfaError(new MfaRequestError('ThrottlerException: Too Many Requests', 429));
    expect(error.kind).toBe('throttled');
    expect(error.message).toBe('Too many attempts. Wait a moment and try again.');
    expect(error.retryable).toBe(true);
  });

  it('maps 5xx to unavailable with calm copy and never leaks server internals', () => {
    const error = mapMfaError(new MfaRequestError('Internal: envelope AAAA failed', 500));
    expect(error.kind).toBe('unavailable');
    expect(error.message).toBe('The security service is temporarily unavailable. Try again shortly.');
    expect(error.retryable).toBe(true);
    expect(error.message).not.toContain('AAAA');
  });

  it('maps an unknown status to unknown with the fallback copy', () => {
    const error = mapMfaError(new MfaRequestError('weird body', 418));
    expect(error.kind).toBe('unknown');
    expect(error.message).toBe('Security request failed. Try again.');
  });

  it('maps a network TypeError to connection copy', () => {
    const error = mapMfaError(new TypeError('Failed to fetch'));
    expect(error.kind).toBe('network');
    expect(error.message).toBe("We couldn't reach the service. Check your connection and try again.");
    expect(error.retryable).toBe(true);
  });

  it('maps an AbortError to cancelled (non-retryable)', () => {
    const abort = new Error('aborted');
    abort.name = 'AbortError';
    const error = mapMfaError(abort);
    expect(error.kind).toBe('cancelled');
    expect(error.message).toBe('Request cancelled.');
    expect(error.retryable).toBe(false);
  });

  it('passes an existing MfaError through unchanged', () => {
    const original = mapMfaError(new MfaRequestError('x', 429));
    expect(mapMfaError(original)).toBe(original);
  });

  it('never surfaces a raw generic error message (no internal detail leak)', () => {
    const error = mapMfaError(new Error('ENVELOPE_SECRET_AABBCCDD'));
    expect(error.message).not.toContain('ENVELOPE_SECRET');
    expect(error.message).toBe('Security request failed. Try again.');
  });
});
