/**
 * Device Presence State — shared frontend utilities.
 *
 * Mirrors the backend module in
 * apps/api-gateway/src/devices/device-presence-state.ts.  Both files MUST stay
 * in sync.  A test in apps/web/src/__tests__/device-presence-state.spec.ts
 * verifies the thresholds and derivation.
 */

import { DEVICE_ONLINE_THRESHOLD_MS, safeParseDate } from '@/lib/device-presence';

/**
 * Offline threshold in milliseconds.
 * A device is "offline" when lastSeenAt is older than this window.
 * Value: 15 minutes = 900,000 ms.
 */
export const DEVICE_PRESENCE_OFFLINE_THRESHOLD_MS = 15 * 60 * 1000;

export type PresenceState = 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'UNKNOWN';

/**
 * Derive the presence state for a device from its lastSeenAt timestamp.
 *
 *   ONLINE   age <= 5 min  (matches isDeviceOnline)
 *   DEGRADED age <= 15 min (heartbeats stopped, not yet presumed dead)
 *   OFFLINE  age > 15 min
 *   UNKNOWN  no valid timestamp
 */
export function derivePresenceState(
  lastSeenAt: string | Date | null | undefined,
  now?: Date,
): PresenceState {
  const ts = safeParseDate(lastSeenAt);
  if (!ts) return 'UNKNOWN';
  const ref = now ?? new Date();
  const ageMs = ref.getTime() - ts.getTime();
  if (ageMs < 0) return 'UNKNOWN';

  if (ageMs <= DEVICE_ONLINE_THRESHOLD_MS) return 'ONLINE';
  if (ageMs <= DEVICE_PRESENCE_OFFLINE_THRESHOLD_MS) return 'DEGRADED';
  return 'OFFLINE';
}

/**
 * Presence states that count as "reachable" for fleet coverage.
 */
export function isPresenceReachable(state: PresenceState): boolean {
  return state === 'ONLINE' || state === 'DEGRADED';
}

/**
 * Human-readable label for a presence state.
 */
export const PRESENCE_STATE_LABELS: Record<PresenceState, string> = {
  ONLINE: 'Online',
  DEGRADED: 'Degraded',
  OFFLINE: 'Offline',
  UNKNOWN: 'Unknown',
};

/**
 * StatusBadge status per presence state, following the design system tokens:
 * ONLINE -> success (green), DEGRADED -> warning (amber), OFFLINE -> danger
 * (red), UNKNOWN -> neutral (gray). Never color-only: labels render alongside.
 */
export const PRESENCE_BADGE_STATUS: Record<PresenceState, string> = {
  ONLINE: 'presence-online',
  DEGRADED: 'presence-degraded',
  OFFLINE: 'presence-offline',
  UNKNOWN: 'presence-unknown',
};

/**
 * Tailwind dot color per presence state (shared across tiles).
 */
export const PRESENCE_DOT_CLASS: Record<PresenceState, string> = {
  ONLINE: 'bg-success',
  DEGRADED: 'bg-warning',
  OFFLINE: 'bg-danger',
  UNKNOWN: 'bg-text-muted',
};

/**
 * Text color per presence state (used alongside labels, never color-only).
 */
export const PRESENCE_TEXT_CLASS: Record<PresenceState, string> = {
  ONLINE: 'text-success',
  DEGRADED: 'text-warning',
  OFFLINE: 'text-danger',
  UNKNOWN: 'text-text-muted',
};

/**
 * Badge variant per presence state for surfaces using the base Badge.
 */
export const PRESENCE_BADGE_VARIANT: Record<
  PresenceState,
  'success' | 'warning' | 'destructive' | 'secondary'
> = {
  ONLINE: 'success',
  DEGRADED: 'warning',
  OFFLINE: 'destructive',
  UNKNOWN: 'secondary',
};
