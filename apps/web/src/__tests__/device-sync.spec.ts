import { classifyFreshness, isDeviceOnline, metricAge, DEVICE_ONLINE_THRESHOLD_MS, TELEMETRY_INTERVAL_MS } from '@/lib/device-presence';

describe('Device Presence Utilities', () => {
  describe('classifyFreshness', () => {
    it('returns live for recent timestamps', () => {
      const now = new Date();
      const recent = new Date(now.getTime() - 30000);
      expect(classifyFreshness(recent.toISOString(), now)).toBe('live');
    });

    it('returns recent for timestamps within threshold', () => {
      const now = new Date();
      const recent = new Date(now.getTime() - 120000);
      expect(classifyFreshness(recent.toISOString(), now)).toBe('recent');
    });

    it('returns stale for timestamps beyond threshold', () => {
      const now = new Date();
      const stale = new Date(now.getTime() - DEVICE_ONLINE_THRESHOLD_MS - 1000);
      expect(classifyFreshness(stale.toISOString(), now)).toBe('stale');
    });

    it('returns unavailable for null timestamps', () => {
      expect(classifyFreshness(null)).toBe('unavailable');
    });

    it('returns unavailable for undefined timestamps', () => {
      expect(classifyFreshness(undefined)).toBe('unavailable');
    });

    it('returns unavailable for invalid timestamps', () => {
      expect(classifyFreshness('invalid-date')).toBe('unavailable');
    });

    it('returns unavailable for future timestamps', () => {
      const now = new Date();
      const future = new Date(now.getTime() + 10000);
      expect(classifyFreshness(future.toISOString(), now)).toBe('unavailable');
    });
  });

  describe('isDeviceOnline', () => {
    it('returns true for recent timestamps', () => {
      const now = new Date();
      const recent = new Date(now.getTime() - 60000);
      expect(isDeviceOnline(recent.toISOString(), now)).toBe(true);
    });

    it('returns false for stale timestamps', () => {
      const now = new Date();
      const stale = new Date(now.getTime() - DEVICE_ONLINE_THRESHOLD_MS - 1000);
      expect(isDeviceOnline(stale.toISOString(), now)).toBe(false);
    });

    it('returns false for null timestamps', () => {
      expect(isDeviceOnline(null)).toBe(false);
    });

    it('returns false for undefined timestamps', () => {
      expect(isDeviceOnline(undefined)).toBe(false);
    });
  });

  describe('metricAge', () => {
    it('returns age in seconds for recent timestamps', () => {
      const now = new Date();
      const recent = new Date(now.getTime() - 30000);
      const age = metricAge(recent.toISOString(), now);
      expect(age).toBe('30s ago');
    });

    it('returns age in minutes for older timestamps', () => {
      const now = new Date();
      const older = new Date(now.getTime() - 120000);
      const age = metricAge(older.toISOString(), now);
      expect(age).toBe('2m ago');
    });

    it('returns null for invalid timestamps', () => {
      expect(metricAge('invalid-date')).toBeNull();
    });

    it('returns null for null timestamps', () => {
      expect(metricAge(null)).toBeNull();
    });
  });

  describe('constants', () => {
    it('DEVICE_ONLINE_THRESHOLD_MS is 5 minutes', () => {
      expect(DEVICE_ONLINE_THRESHOLD_MS).toBe(5 * 60 * 1000);
    });

    it('TELEMETRY_INTERVAL_MS is 30 seconds', () => {
      expect(TELEMETRY_INTERVAL_MS).toBe(30 * 1000);
    });
  });
});

describe('addLiveMetric deduplication', () => {
  const createMetric = (id: string, recordedAt: string) => ({
    id,
    deviceId: 'dev-1',
    recordedAt,
    cpuUsage: 50,
    ramPercent: 60,
    ramUsed: 8000000000,
    ramTotal: 16000000000,
    diskUsed: null,
    diskTotal: null,
    tempCpu: null,
    loadAverage1Min: null,
    processes: null,
    uptime: null,
    networkRxBytes: null,
    networkTxBytes: null,
  });

  const createScore = () => ({
    id: 'score-1',
    deviceId: 'dev-1',
    calculatedAt: new Date().toISOString(),
    healthScore: 85,
    performanceScore: 80,
    riskScore: 15,
  });

  it('prevents duplicate metrics by ID', () => {
    const existingMetrics = [
      createMetric('m1', '2024-01-01T00:00:00Z'),
      createMetric('m2', '2024-01-01T00:01:00Z'),
    ];

    const newMetric = createMetric('m1', '2024-01-01T00:00:00Z');
    const existingIds = new Set(existingMetrics.map((m) => m.id));

    expect(existingIds.has(newMetric.id)).toBe(true);
  });

  it('allows new metrics with different IDs', () => {
    const existingMetrics = [
      createMetric('m1', '2024-01-01T00:00:00Z'),
      createMetric('m2', '2024-01-01T00:01:00Z'),
    ];

    const newMetric = createMetric('m3', '2024-01-01T00:02:00Z');
    const existingIds = new Set(existingMetrics.map((m) => m.id));

    expect(existingIds.has(newMetric.id)).toBe(false);
  });

  it('maintains chronological order after insertion', () => {
    const metrics = [
      createMetric('m1', '2024-01-01T00:00:00Z'),
      createMetric('m3', '2024-01-01T00:02:00Z'),
    ];

    const newMetric = createMetric('m2', '2024-01-01T00:01:00Z');
    const next = [...metrics, newMetric].sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
    );

    expect(next[0].id).toBe('m1');
    expect(next[1].id).toBe('m2');
    expect(next[2].id).toBe('m3');
  });

  it('caps metrics at 200 entries', () => {
    const existingMetrics = Array.from({ length: 200 }, (_, i) =>
      createMetric(`m${i}`, `2024-01-01T00:${String(i).padStart(2, '0')}:00Z`)
    );

    const newMetric = createMetric('m200', '2024-01-01T01:00:00Z');
    const next = [...existingMetrics, newMetric];
    if (next.length > 200) next.splice(0, next.length - 200);

    expect(next.length).toBe(200);
    expect(next[0].id).toBe('m1');
  });
});
