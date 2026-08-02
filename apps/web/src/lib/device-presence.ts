/**
 * Device Presence Contract — shared frontend utilities.
 *
 * Mirrors the backend constant in apps/api-gateway/src/devices/device-presence.ts.
 * Both files MUST stay in sync.  A test in
 * apps/web/src/__tests__/device-presence.spec.ts verifies the value.
 */

/**
 * Online threshold in milliseconds.
 * A device is "online" if lastSeenAt is within this window.
 * Value: 5 minutes = 300,000 ms.
 */
export const DEVICE_ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Telemetry interval in milliseconds.
 * Agent sends metrics approximately every 30 seconds.
 * Used to compute the "live" freshness boundary (2 × interval = 60s).
 */
export const TELEMETRY_INTERVAL_MS = 30 * 1000;

/**
 * Freshness classification for device metrics.
 *
 * - live:       latest metric age <= 2 × telemetry interval (<= 60s)
 * - recent:     metric age <= device online threshold (<= 5 min)
 * - stale:      metric age > online threshold (> 5 min)
 * - unavailable: no valid metric timestamp
 */
export type MetricFreshness = 'live' | 'recent' | 'stale' | 'unavailable';

/**
 * Classify the freshness of a metric timestamp relative to now.
 */
export function classifyFreshness(
  recordedAt: string | Date | null | undefined,
  now?: Date,
): MetricFreshness {
  const ref = now ?? new Date();
  const ts = safeParseDate(recordedAt);
  if (!ts) return 'unavailable';

  const ageMs = ref.getTime() - ts.getTime();

  if (ageMs < 0) return 'unavailable';
  if (ageMs <= 2 * TELEMETRY_INTERVAL_MS) return 'live';
  if (ageMs <= DEVICE_ONLINE_THRESHOLD_MS) return 'recent';
  return 'stale';
}

/**
 * Compute the age of a metric in a human-readable string.
 * Returns null if the timestamp is invalid.
 */
export function metricAge(
  recordedAt: string | Date | null | undefined,
  now?: Date,
): string | null {
  const ref = now ?? new Date();
  const ts = safeParseDate(recordedAt);
  if (!ts) return null;

  const ageMs = ref.getTime() - ts.getTime();
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
 * Safely parse a value into a Date.  Returns null for null, undefined,
 * empty string, or any value that does not produce a valid date.
 */
export function safeParseDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  try {
    const d = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(d.getTime())) return null;
    return d;
  } catch {
    return null;
  }
}

/**
 * Returns true when the device's lastSeenAt falls within the online
 * threshold relative to `now`.  Invalid or missing timestamps always
 * return false (treated as offline).
 */
export function isDeviceOnline(
  lastSeenAt: string | Date | null | undefined,
  now?: Date,
): boolean {
  const ts = safeParseDate(lastSeenAt);
  if (!ts) return false;
  const ref = now ?? new Date();
  return ref.getTime() - ts.getTime() < DEVICE_ONLINE_THRESHOLD_MS;
}

/**
 * Format a device's lastSeenAt for display.
 * Returns "Last seen unavailable" for invalid/missing values.
 * Never returns "Invalid Date".
 */
export function formatDeviceLastSeen(
  value: string | Date | null | undefined,
): string {
  const d = safeParseDate(value);
  if (!d) return 'Last seen unavailable';
  return d.toLocaleString();
}

/**
 * Format a metric recordedAt timestamp for chart labels.
 * Returns null for invalid values (callers should skip the data point).
 */
export function formatMetricTimestamp(
  value: string | Date | null | undefined,
): string | null {
  const d = safeParseDate(value);
  if (!d) return null;
  return d.toLocaleTimeString();
}
