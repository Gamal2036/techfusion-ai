/**
 * Device Presence Contract — shared threshold constants and freshness model.
 *
 * A device is considered "online" if its lastSeenAt timestamp is within
 * this window from the current time.
 *
 * Chosen value: 5 minutes (300,000 ms).
 *
 * Rationale:
 * - Agent default telemetry interval is 30 seconds (+0–3 s jitter).
 * - A 5-minute window tolerates up to ~10 missed heartbeats before
 *   marking a device offline, which handles transient network issues,
 *   brief agent restarts, and scheduled OS sleep/wake cycles.
 * - This value is already used by the reporting service and aligns
 *   with typical IT monitoring conventions.
 *
 * Both frontend and backend MUST import this constant (or a matching
 * copy) rather than inlining a numeric literal.  The matching frontend
 * constant lives in apps/web/src/lib/device-presence.ts.
 */
export const DEVICE_ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 300,000 ms = 5 minutes

/**
 * Telemetry interval in milliseconds.
 * Agent sends metrics approximately every 30 seconds.
 * Used to compute the "live" freshness boundary (2 × interval = 60s).
 */
export const TELEMETRY_INTERVAL_MS = 30 * 1000; // 30 seconds

/**
 * Freshness classification for device metrics.
 *
 * - live:     latest metric age <= 2 × telemetry interval (<= 60s)
 * - recent:   metric age <= device online threshold (<= 5 min)
 * - stale:    metric age > online threshold (> 5 min)
 * - unavailable: no valid metric timestamp
 */
export type MetricFreshness = 'live' | 'recent' | 'stale' | 'unavailable';

/**
 * Classify the freshness of a metric timestamp relative to now.
 *
 * @param recordedAt - The metric's recordedAt timestamp
 * @param now - Reference time (defaults to current time)
 * @returns MetricFreshness classification
 */
export function classifyFreshness(
  recordedAt: Date | string | null | undefined,
  now: Date = new Date(),
): MetricFreshness {
  if (!recordedAt) return 'unavailable';
  const ts = recordedAt instanceof Date ? recordedAt : new Date(recordedAt);
  if (Number.isNaN(ts.getTime())) return 'unavailable';

  const ageMs = now.getTime() - ts.getTime();

  if (ageMs < 0) return 'unavailable'; // future timestamp
  if (ageMs <= 2 * TELEMETRY_INTERVAL_MS) return 'live';
  if (ageMs <= DEVICE_ONLINE_THRESHOLD_MS) return 'recent';
  return 'stale';
}

/**
 * Compute the age of a metric in a human-readable string.
 *
 * @param recordedAt - The metric's recordedAt timestamp
 * @param now - Reference time (defaults to current time)
 * @returns Human-readable age string, or null if timestamp is invalid
 */
export function metricAge(
  recordedAt: Date | string | null | undefined,
  now: Date = new Date(),
): string | null {
  if (!recordedAt) return null;
  const ts = recordedAt instanceof Date ? recordedAt : new Date(recordedAt);
  if (Number.isNaN(ts.getTime())) return null;

  const ageMs = now.getTime() - ts.getTime();
  if (ageMs < 0) return null;

  const seconds = Math.floor(ageMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Returns true when the device's lastSeenAt falls within the online
 * threshold relative to `now`.  Invalid or missing timestamps always
 * return false (treated as offline).
 */
export function isDeviceOnline(
  lastSeenAt: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!lastSeenAt) return false;
  const ts = lastSeenAt instanceof Date ? lastSeenAt : new Date(lastSeenAt);
  if (Number.isNaN(ts.getTime())) return false;
  return now.getTime() - ts.getTime() < DEVICE_ONLINE_THRESHOLD_MS;
}
