import {
  DEVICE_ONLINE_THRESHOLD_MS,
  TELEMETRY_INTERVAL_MS,
  safeParseDate,
  isDeviceOnline,
  classifyFreshness,
  metricAge,
  formatDeviceLastSeen,
  formatMetricTimestamp,
} from '@/lib/device-presence';

describe('Device Presence Contract (frontend)', () => {
  describe('DEVICE_ONLINE_THRESHOLD_MS', () => {
    it('is 5 minutes (300,000 ms)', () => {
      expect(DEVICE_ONLINE_THRESHOLD_MS).toBe(5 * 60 * 1000);
    });

    it('matches the backend threshold', () => {
      expect(DEVICE_ONLINE_THRESHOLD_MS).toBe(300_000);
    });
  });

  describe('TELEMETRY_INTERVAL_MS', () => {
    it('is 30 seconds (30,000 ms)', () => {
      expect(TELEMETRY_INTERVAL_MS).toBe(30 * 1000);
    });

    it('matches the backend telemetry interval', () => {
      expect(TELEMETRY_INTERVAL_MS).toBe(30_000);
    });
  });

  describe('classifyFreshness', () => {
    const now = new Date('2026-07-25T12:00:00.000Z');

    it('returns live for metric within 2 telemetry intervals (60s)', () => {
      const recordedAt = new Date(now.getTime() - 30_000);
      expect(classifyFreshness(recordedAt, now)).toBe('live');
    });

    it('returns live for metric at exact 2x boundary', () => {
      const recordedAt = new Date(now.getTime() - 2 * TELEMETRY_INTERVAL_MS);
      expect(classifyFreshness(recordedAt, now)).toBe('live');
    });

    it('returns recent for metric between live and online threshold', () => {
      const recordedAt = new Date(now.getTime() - 120_000);
      expect(classifyFreshness(recordedAt, now)).toBe('recent');
    });

    it('returns recent for metric at exact online threshold', () => {
      const recordedAt = new Date(now.getTime() - DEVICE_ONLINE_THRESHOLD_MS);
      expect(classifyFreshness(recordedAt, now)).toBe('recent');
    });

    it('returns stale for metric past online threshold', () => {
      const recordedAt = new Date(now.getTime() - DEVICE_ONLINE_THRESHOLD_MS - 1);
      expect(classifyFreshness(recordedAt, now)).toBe('stale');
    });

    it('returns unavailable for null', () => {
      expect(classifyFreshness(null, now)).toBe('unavailable');
    });

    it('returns unavailable for undefined', () => {
      expect(classifyFreshness(undefined, now)).toBe('unavailable');
    });

    it('returns unavailable for malformed string', () => {
      expect(classifyFreshness('not-a-date', now)).toBe('unavailable');
    });

    it('returns unavailable for future timestamp', () => {
      const future = new Date(now.getTime() + 60_000);
      expect(classifyFreshness(future, now)).toBe('unavailable');
    });

    it('accepts ISO string timestamps', () => {
      const ts = new Date(now.getTime() - 30_000).toISOString();
      expect(classifyFreshness(ts, now)).toBe('live');
    });
  });

  describe('metricAge', () => {
    const now = new Date('2026-07-25T12:00:00.000Z');

    it('returns seconds for recent metric', () => {
      const recordedAt = new Date(now.getTime() - 15_000);
      expect(metricAge(recordedAt, now)).toBe('15s ago');
    });

    it('returns minutes for metric minutes ago', () => {
      const recordedAt = new Date(now.getTime() - 180_000);
      expect(metricAge(recordedAt, now)).toBe('3m ago');
    });

    it('returns hours for metric hours ago', () => {
      const recordedAt = new Date(now.getTime() - 7200_000);
      expect(metricAge(recordedAt, now)).toBe('2h ago');
    });

    it('returns days for metric days ago', () => {
      const recordedAt = new Date(now.getTime() - 172800_000);
      expect(metricAge(recordedAt, now)).toBe('2d ago');
    });

    it('returns null for null', () => {
      expect(metricAge(null, now)).toBeNull();
    });

    it('returns null for undefined', () => {
      expect(metricAge(undefined, now)).toBeNull();
    });

    it('returns null for malformed string', () => {
      expect(metricAge('not-a-date', now)).toBeNull();
    });
  });

  describe('safeParseDate', () => {
    it('parses valid ISO string', () => {
      const result = safeParseDate('2026-07-25T12:00:00.000Z');
      expect(result).toBeInstanceOf(Date);
      expect(result!.toISOString()).toBe('2026-07-25T12:00:00.000Z');
    });

    it('returns null for null', () => {
      expect(safeParseDate(null)).toBeNull();
    });

    it('returns null for undefined', () => {
      expect(safeParseDate(undefined)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(safeParseDate('')).toBeNull();
    });

    it('returns null for whitespace-only string', () => {
      expect(safeParseDate('   ')).toBeNull();
    });

    it('returns null for malformed string', () => {
      expect(safeParseDate('not-a-date')).toBeNull();
    });

    it('returns null for NaN-producing string', () => {
      expect(safeParseDate('invalid')).toBeNull();
    });

    it('accepts Date objects', () => {
      const d = new Date('2026-01-01T00:00:00.000Z');
      expect(safeParseDate(d)).toBe(d);
    });

    it('returns a Date for numeric 0 (epoch)', () => {
      const result = safeParseDate(0);
      expect(result).not.toBeNull();
      expect(result).toBeInstanceOf(Date);
    });
  });

  describe('isDeviceOnline', () => {
    const now = new Date('2026-07-25T12:00:00.000Z');

    it('returns true for a device seen 1 minute ago', () => {
      const lastSeenAt = new Date('2026-07-25T11:59:00.000Z');
      expect(isDeviceOnline(lastSeenAt, now)).toBe(true);
    });

    it('returns true for a device seen just inside threshold', () => {
      const lastSeenAt = new Date(now.getTime() - DEVICE_ONLINE_THRESHOLD_MS + 1);
      expect(isDeviceOnline(lastSeenAt, now)).toBe(true);
    });

    it('returns false for a device seen just outside threshold', () => {
      const lastSeenAt = new Date(now.getTime() - DEVICE_ONLINE_THRESHOLD_MS - 1);
      expect(isDeviceOnline(lastSeenAt, now)).toBe(false);
    });

    it('returns false at exact threshold boundary (deterministic)', () => {
      const lastSeenAt = new Date(now.getTime() - DEVICE_ONLINE_THRESHOLD_MS);
      expect(isDeviceOnline(lastSeenAt, now)).toBe(false);
    });

    it('returns false for null lastSeenAt', () => {
      expect(isDeviceOnline(null, now)).toBe(false);
    });

    it('returns false for undefined lastSeenAt', () => {
      expect(isDeviceOnline(undefined, now)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isDeviceOnline('', now)).toBe(false);
    });

    it('returns false for malformed timestamp', () => {
      expect(isDeviceOnline('not-a-date', now)).toBe(false);
    });

    it('accepts ISO string timestamps', () => {
      const ts = new Date(now.getTime() - 60_000).toISOString();
      expect(isDeviceOnline(ts, now)).toBe(true);
    });

    it('uses current time when now is omitted', () => {
      const recent = new Date(Date.now() - 1000).toISOString();
      expect(isDeviceOnline(recent)).toBe(true);
    });
  });

  describe('formatDeviceLastSeen', () => {
    it('formats a valid ISO string', () => {
      const ts = '2026-07-25T12:00:00.000Z';
      const result = formatDeviceLastSeen(ts);
      expect(result).not.toBe('Last seen unavailable');
      expect(result).not.toContain('Invalid');
      expect(result).not.toContain('NaN');
    });

    it('returns fallback for null', () => {
      expect(formatDeviceLastSeen(null)).toBe('Last seen unavailable');
    });

    it('returns fallback for undefined', () => {
      expect(formatDeviceLastSeen(undefined)).toBe('Last seen unavailable');
    });

    it('returns fallback for empty string', () => {
      expect(formatDeviceLastSeen('')).toBe('Last seen unavailable');
    });

    it('returns fallback for malformed timestamp', () => {
      expect(formatDeviceLastSeen('not-a-date')).toBe('Last seen unavailable');
    });

    it('never returns "Invalid Date"', () => {
      const values = [null, undefined, '', '   ', 'invalid', 'not-a-date', NaN as any];
      for (const v of values) {
        const result = formatDeviceLastSeen(v as any);
        expect(result).not.toBe('Invalid Date');
        expect(result).not.toContain('Invalid Date');
      }
    });
  });

  describe('formatMetricTimestamp', () => {
    it('formats a valid ISO string', () => {
      const ts = '2026-07-25T12:00:00.000Z';
      const result = formatMetricTimestamp(ts);
      expect(result).not.toBeNull();
      expect(result).not.toContain('Invalid');
    });

    it('returns null for null', () => {
      expect(formatMetricTimestamp(null)).toBeNull();
    });

    it('returns null for undefined', () => {
      expect(formatMetricTimestamp(undefined)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(formatMetricTimestamp('')).toBeNull();
    });

    it('returns null for malformed timestamp', () => {
      expect(formatMetricTimestamp('not-a-date')).toBeNull();
    });

    it('never returns "Invalid Date"', () => {
      const values = [null, undefined, '', 'invalid', 'not-a-date'];
      for (const v of values) {
        const result = formatMetricTimestamp(v as any);
        if (result !== null) {
          expect(result).not.toBe('Invalid Date');
          expect(result).not.toContain('Invalid Date');
        }
      }
    });
  });
});
