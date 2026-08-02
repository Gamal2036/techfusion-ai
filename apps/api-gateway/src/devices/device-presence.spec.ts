import { DEVICE_ONLINE_THRESHOLD_MS, TELEMETRY_INTERVAL_MS, isDeviceOnline, classifyFreshness, metricAge } from './device-presence';

describe('Device Presence Contract (backend)', () => {
  describe('DEVICE_ONLINE_THRESHOLD_MS', () => {
    it('is 5 minutes (300,000 ms)', () => {
      expect(DEVICE_ONLINE_THRESHOLD_MS).toBe(5 * 60 * 1000);
    });

    it('matches the frontend threshold (300,000 ms)', () => {
      expect(DEVICE_ONLINE_THRESHOLD_MS).toBe(300_000);
    });
  });

  describe('TELEMETRY_INTERVAL_MS', () => {
    it('is 30 seconds (30,000 ms)', () => {
      expect(TELEMETRY_INTERVAL_MS).toBe(30 * 1000);
    });

    it('matches the frontend telemetry interval', () => {
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

    it('returns false for malformed timestamp string', () => {
      expect(isDeviceOnline('not-a-date', now)).toBe(false);
    });

    it('returns false for NaN timestamp', () => {
      expect(isDeviceOnline('invalid', now)).toBe(false);
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

  describe('ingestMetrics updates lastSeenAt', () => {
    it('ingestMetrics explicitly sets lastSeenAt on the device', async () => {
      const mockUpdate = jest.fn().mockResolvedValue({});
      const mockCreate = jest.fn().mockResolvedValue({
        id: 'm1', deviceId: 'd1', orgId: 'o1', recordedAt: new Date(),
      });
      const mockHealthCreate = jest.fn().mockResolvedValue({
        id: 's1', deviceId: 'd1', healthScore: 80, performanceScore: 70, riskScore: 20,
      });
      const mockFindUnique = jest.fn().mockResolvedValue(null);
      const mockFindFirst = jest.fn().mockResolvedValue(null);

      const { DevicesService } = await import('./devices.service');
      const service = new DevicesService(
        { device: { update: mockUpdate, findUnique: mockFindUnique, findFirst: mockFindFirst, create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
          deviceMetric: { create: mockCreate, findMany: jest.fn(), findFirst: jest.fn() },
          deviceHealthScore: { create: mockHealthCreate, findFirst: jest.fn() },
          credentialRotationEvent: { create: jest.fn() },
          organization: { findUnique: jest.fn() },
        } as any,
        { computeAll: jest.fn().mockReturnValue({ healthScore: 80, performanceScore: 70, riskScore: 20 }) } as any,
        { evaluateMetrics: jest.fn().mockResolvedValue([]) } as any,
        { broadcastAlert: jest.fn() } as any,
        { addAlertNotification: jest.fn() } as any,
      );

      await service.ingestMetrics('d1', 'o1', {
        cpu: { usage: 50 },
        memory: { total: 16000000000, used: 8000000000, percent: 50 },
      } as any);

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'd1' },
        data: { lastSeenAt: expect.any(Date) },
      });
    });

    it('ingestMetrics stores metric with recordedAt', async () => {
      const mockUpdate = jest.fn().mockResolvedValue({});
      const mockCreate = jest.fn().mockResolvedValue({
        id: 'm1', deviceId: 'd1', orgId: 'o1', recordedAt: new Date(),
      });
      const mockHealthCreate = jest.fn().mockResolvedValue({
        id: 's1', deviceId: 'd1', healthScore: 80, performanceScore: 70, riskScore: 20,
      });

      const { DevicesService } = await import('./devices.service');
      const service = new DevicesService(
        { device: { update: mockUpdate, findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
          deviceMetric: { create: mockCreate, findMany: jest.fn(), findFirst: jest.fn() },
          deviceHealthScore: { create: mockHealthCreate, findFirst: jest.fn() },
          credentialRotationEvent: { create: jest.fn() },
          organization: { findUnique: jest.fn() },
        } as any,
        { computeAll: jest.fn().mockReturnValue({ healthScore: 80, performanceScore: 70, riskScore: 20 }) } as any,
        { evaluateMetrics: jest.fn().mockResolvedValue([]) } as any,
        { broadcastAlert: jest.fn() } as any,
        { addAlertNotification: jest.fn() } as any,
      );

      const metricTimestamp = new Date('2026-07-25T12:00:00.000Z');
      const result = await service.ingestMetrics('d1', 'o1', {
        timestamp: metricTimestamp.toISOString(),
        cpu: { usage: 50 },
        memory: { total: 16000000000, used: 8000000000, percent: 50 },
      } as any);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recordedAt: expect.any(Date),
          }),
        }),
      );
      expect(result.metric).toBeDefined();
    });

    it('rotateCredential does not update lastSeenAt', async () => {
      const mockUpdate = jest.fn().mockResolvedValue({
        id: 'd1', deviceToken: 'new-token', credentialVersion: 2,
      });
      const mockFindFirst = jest.fn().mockResolvedValue({
        id: 'd1', orgId: 'o1', deviceToken: 'old-token',
      });
      const mockCreate = jest.fn().mockResolvedValue({});

      const { DevicesService } = await import('./devices.service');
      const service = new DevicesService(
        { device: { update: mockUpdate, findFirst: mockFindFirst, findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
          deviceMetric: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
          deviceHealthScore: { create: jest.fn(), findFirst: jest.fn() },
          credentialRotationEvent: { create: mockCreate },
          organization: { findUnique: jest.fn() },
        } as any,
        { computeAll: jest.fn() } as any,
        { evaluateMetrics: jest.fn() } as any,
        { broadcastAlert: jest.fn() } as any,
        { addAlertNotification: jest.fn() } as any,
      );

      await service.rotateCredential('d1', 'o1', 'test');

      const updateCall = mockUpdate.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('lastSeenAt');
    });
  });

  describe('GET /devices response', () => {
    it('returns devices with lastSeenAt', async () => {
      const mockFindMany = jest.fn().mockResolvedValue([
        { id: 'd1', name: 'host-1', lastSeenAt: new Date('2026-07-25T12:00:00.000Z'), deviceToken: 'tok', deviceTokenHash: 'hash' },
      ]);

      const { DevicesService } = await import('./devices.service');
      const service = new DevicesService(
        { device: { update: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), findMany: mockFindMany, count: jest.fn() },
          deviceMetric: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
          deviceHealthScore: { create: jest.fn(), findFirst: jest.fn() },
          credentialRotationEvent: { create: jest.fn() },
          organization: { findUnique: jest.fn() },
        } as any,
        { computeAll: jest.fn() } as any,
        { evaluateMetrics: jest.fn() } as any,
        { broadcastAlert: jest.fn() } as any,
        { addAlertNotification: jest.fn() } as any,
      );

      const devices = await service.findByOrg('org-1');
      expect(devices).toHaveLength(1);
      expect(devices[0].lastSeenAt).toBeDefined();
    });
  });

  describe('GET /devices/:id/latest response', () => {
    it('returns device, metrics, and scores', async () => {
      const mockFindFirst = jest.fn().mockResolvedValue({
        id: 'd1', name: 'host-1', lastSeenAt: new Date(), deviceToken: 'tok', deviceTokenHash: 'hash',
      });
      const mockFindMany = jest.fn().mockResolvedValue([]);
      const mockMetricFindFirst = jest.fn().mockResolvedValue({
        id: 'm1', recordedAt: new Date(), cpuUsage: 50,
      });
      const mockScoreFindFirst = jest.fn().mockResolvedValue({
        id: 's1', healthScore: 80, performanceScore: 70, riskScore: 20,
      });

      const { DevicesService } = await import('./devices.service');
      const service = new DevicesService(
        { device: { update: jest.fn(), findUnique: jest.fn(), findFirst: mockFindFirst, create: jest.fn(), findMany: mockFindMany, count: jest.fn() },
          deviceMetric: { create: jest.fn(), findMany: mockFindMany, findFirst: mockMetricFindFirst },
          deviceHealthScore: { create: jest.fn(), findFirst: mockScoreFindFirst },
          credentialRotationEvent: { create: jest.fn() },
          organization: { findUnique: jest.fn() },
        } as any,
        { computeAll: jest.fn() } as any,
        { evaluateMetrics: jest.fn() } as any,
        { broadcastAlert: jest.fn() } as any,
        { addAlertNotification: jest.fn() } as any,
      );

      const device = await service.findById('d1', 'org-1');
      const metrics = await service.getLatestMetrics('d1', 'org-1');
      const scores = await service.getLatestScores('d1', 'org-1');

      expect(device.id).toBe('d1');
      expect(device.lastSeenAt).toBeDefined();
      expect(metrics).toBeDefined();
      expect(scores).toBeDefined();
    });
  });
});
