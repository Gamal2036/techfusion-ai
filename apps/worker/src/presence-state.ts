export type PresenceState = 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'UNKNOWN';

export const DEVICE_PRESENCE_ONLINE_THRESHOLD_MS = 5 * 60 * 1000;
export const DEVICE_PRESENCE_OFFLINE_THRESHOLD_MS = 15 * 60 * 1000;

function parseLastSeen(value: Date | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  const time = value.getTime();
  return Number.isNaN(time) ? null : time;
}

export function derivePresenceState(
  lastSeenAt: Date | string | null | undefined,
  now: Date = new Date(),
): PresenceState {
  const lastSeen = parseLastSeen(lastSeenAt);
  if (lastSeen === null) return 'UNKNOWN';

  const nowTime = now.getTime();
  if (lastSeen > nowTime) return 'UNKNOWN';

  const elapsedMs = nowTime - lastSeen;
  if (elapsedMs <= DEVICE_PRESENCE_ONLINE_THRESHOLD_MS) return 'ONLINE';
  if (elapsedMs <= DEVICE_PRESENCE_OFFLINE_THRESHOLD_MS) return 'DEGRADED';
  return 'OFFLINE';
}

export function isPresenceReachable(state: PresenceState): boolean {
  return state === 'ONLINE' || state === 'DEGRADED';
}
