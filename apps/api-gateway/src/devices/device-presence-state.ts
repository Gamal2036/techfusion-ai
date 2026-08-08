/**
 * Device Presence State — shared threshold constants and state derivation.
 *
 * Real device presence is derived from the freshness of the agent's last
 * heartbeat (Device.lastSeenAt).  The agent reports telemetry approximately
 * every 30 seconds, so a quiet device means no data, not a healthy device.
 *
 * State bands (relative to `now`):
 *   ONLINE   lastSeenAt age <= DEVICE_ONLINE_THRESHOLD_MS (5 min)
 *            — the device is reporting normally.  Identical to isDeviceOnline.
 *   DEGRADED lastSeenAt age <= DEVICE_PRESENCE_OFFLINE_THRESHOLD_MS (15 min)
 *            — heartbeats stopped.  The device may still be reachable (network
 *            blip, brief agent restart, sleep) but communication is degraded.
 *   OFFLINE  lastSeenAt age > DEVICE_PRESENCE_OFFLINE_THRESHOLD_MS (15 min)
 *            — the device is presumed unreachable and is the target of
 *            presence alert rules.
 *   UNKNOWN  no valid lastSeenAt (never seen or invalid timestamp).
 *
 * Both frontend and backend MUST import these constants (or a matching copy)
 * rather than inlining numeric literals.  The matching frontend module lives
 * in apps/web/src/lib/device-presence-state.ts.
 */
import { DEVICE_ONLINE_THRESHOLD_MS } from './device-presence';

export const DEVICE_PRESENCE_OFFLINE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

export type PresenceState = 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'UNKNOWN';

/**
 * Derive the presence state for a device from its lastSeenAt timestamp.
 *
 * @param lastSeenAt - The device's lastSeenAt timestamp
 * @param now - Reference time (defaults to current time)
 * @returns PresenceState classification
 */
export function derivePresenceState(
  lastSeenAt: Date | string | null | undefined,
  now: Date = new Date(),
): PresenceState {
  if (!lastSeenAt) return 'UNKNOWN';
  const ts = lastSeenAt instanceof Date ? lastSeenAt : new Date(lastSeenAt);
  if (Number.isNaN(ts.getTime())) return 'UNKNOWN';

  const ageMs = now.getTime() - ts.getTime();
  if (ageMs < 0) return 'UNKNOWN'; // future timestamp

  if (ageMs <= DEVICE_ONLINE_THRESHOLD_MS) return 'ONLINE';
  if (ageMs <= DEVICE_PRESENCE_OFFLINE_THRESHOLD_MS) return 'DEGRADED';
  return 'OFFLINE';
}

/**
 * Presence states that count as "reachable" for fleet coverage metrics.
 * ONLINE is fully reachable; DEGRADED is still recently seen but quiet.
 */
export function isPresenceReachable(state: PresenceState): boolean {
  return state === 'ONLINE' || state === 'DEGRADED';
}
