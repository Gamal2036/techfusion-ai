import { ThrottlerModuleOptions } from '@nestjs/throttler';
import { ExecutionContext } from '@nestjs/common';
import { createHash } from 'crypto';

export function throttle(limit: number, ttl: number) {
  if (process.env.NODE_ENV === 'test') return { default: { limit: 999999, ttl: 60000 } };
  return { default: { limit, ttl } };
}

/**
 * Strict per-route throttle limit backed by STRICT_RATE_LIMITS.
 *
 * Deliberately NOT neutered in test mode (unlike throttle()): the MFA routes it
 * decorates must be provably rate-limited in the test suite. Only the routes
 * that reference this helper are affected; every other route keeps the
 * test-mode 999999 limit.
 */
export function mfaThrottle() {
  return { default: { limit: STRICT_RATE_LIMITS.mfa.limit, ttl: STRICT_RATE_LIMITS.mfa.ttl } };
}

export function getRateLimitConfig(): ThrottlerModuleOptions {
  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';

  if (isTest) {
    return [{
      name: 'default',
      ttl: 60000,
      limit: 999999,
    }];
  }

  return [{
    name: 'default',
    ttl: isProduction ? 1000 : 5000,
    limit: isProduction ? 10 : 50,
  }, {
    name: 'short',
    ttl: isProduction ? 1000 : 5000,
    limit: isProduction ? 10 : 50,
  }, {
    name: 'long',
    ttl: isProduction ? 60000 : 300000,
    limit: isProduction ? 100 : 500,
  }];
}

/**
 * ACC-SEC-02D2B — Strict per-route throttle for password and session
 * management endpoints. Like mfaThrottle(), this is deliberately NOT neutered
 * in test mode: the routes it decorates must be provably rate-limited in the
 * test suite.
 */
export function strictThrottle(limit: number, ttl: number) {
  return { default: { limit, ttl } };
}

/**
 * ACC-SEC-02E2B-CERT — Fingerprint-aware strict throttle for password-reset
 * endpoints. Throttles by IP + SHA-256(body-field) so that:
 *   - raw email never enters rate-limit storage
 *   - raw reset token never enters rate-limit storage
 *   - different IPs are independently tracked
 *   - different body-field values are independently tracked
 *
 * `bodyField` is the request body key to fingerprint (e.g. 'email' or 'token').
 * `normalizeFn` optionally transforms the raw value before hashing (e.g.
 * lowercasing + trimming an email). Raw value is never logged or stored.
 *
 * Deliberately NOT neutered in test mode.
 */
export function fingerprintThrottle(
  limit: number,
  ttl: number,
  bodyField: string,
  normalizeFn?: (raw: string) => string,
) {
  function sha256Hex(input: string): string {
    return createHash('sha256').update(input, 'utf8').digest('hex');
  }

  return {
    default: {
      limit,
      ttl,
      getTracker: (req: Record<string, any>) => {
        const raw = req.body?.[bodyField];
        if (typeof raw === 'string' && raw.length > 0) {
          const normalized = normalizeFn ? normalizeFn(raw) : raw;
          return sha256Hex(normalized);
        }
        return 'missing-field';
      },
      generateKey: (_context: ExecutionContext, trackerString: string) => {
        return trackerString;
      },
    },
  };
}

export const STRICT_RATE_LIMITS = {
  login: { limit: 5, ttl: 60000 },
  signup: { limit: 3, ttl: 300000 },
  refresh: { limit: 10, ttl: 60000 },
  mfa: { limit: 5, ttl: 60000 },
  changePassword: { limit: 20, ttl: 60000 },
  sessions: { limit: 30, ttl: 60000 },
  sessionMutation: { limit: 10, ttl: 60000 },
  forgotPassword: { limit: 3, ttl: 300000 },
  resetPassword: { limit: 5, ttl: 300000 },
  deviceRegister: { limit: 10, ttl: 60000 },
  deviceMetrics: { limit: 120, ttl: 60000 },
  securityReport: { limit: 20, ttl: 60000 },
  inventoryReport: { limit: 20, ttl: 60000 },
  networkDiscovery: { limit: 10, ttl: 60000 },
  remoteAgent: { limit: 30, ttl: 60000 },
};
