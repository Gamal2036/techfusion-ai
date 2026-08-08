import { DashboardService } from './dashboard.service';
import { DashboardSummaryResponse } from './dashboard.types';

function nowDate(): Date {
  return new Date();
}

function secondsAgo(seconds: number): Date {
  return new Date(Date.now() - seconds * 1000);
}

function minutesAgo(minutes: number): Date {
  return secondsAgo(minutes * 60);
}

function createMockPrisma() {
  return {
    device: { findMany: jest.fn() },
    alert: { groupBy: jest.fn() },
    securityFinding: { groupBy: jest.fn() },
    securityScore: { findMany: jest.fn() },
    securityScan: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    deviceHealthScore: { findMany: jest.fn() },
    backupRun: { count: jest.fn(), findFirst: jest.fn() },
    backupJob: { findFirst: jest.fn() },
    report: { count: jest.fn() },
    user: { count: jest.fn() },
  };
}

function emptyDefaults(prisma: ReturnType<typeof createMockPrisma>) {
  prisma.device.findMany.mockResolvedValue([]);
  prisma.alert.groupBy.mockResolvedValue([]);
  prisma.securityFinding.groupBy.mockResolvedValue([]);
  prisma.securityScore.findMany.mockResolvedValue([]);
  prisma.securityScan.findMany.mockResolvedValue([]);
  prisma.securityScan.findFirst.mockResolvedValue(null);
  prisma.deviceHealthScore.findMany.mockResolvedValue([]);
  prisma.backupRun.count.mockResolvedValue(0);
  prisma.backupRun.findFirst.mockResolvedValue(null);
  prisma.backupJob.findFirst.mockResolvedValue(null);
  prisma.securityScan.count.mockResolvedValue(0);
  prisma.report.count.mockResolvedValue(0);
  prisma.user.count.mockResolvedValue(0);
}

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    emptyDefaults(prisma);
    service = new DashboardService(prisma as any);
  });

  async function getSummary(orgId = 'org-1'): Promise<DashboardSummaryResponse> {
    return service.getSummary(orgId);
  }

  function expectOrgIsolated(orgId: string) {
    const calls: any[][] = [];
    for (const method of Object.values(prisma).flatMap((group: any) =>
      Object.values(group),
    )) {
      for (const call of (method as jest.Mock).mock.calls) {
        calls.push(call);
      }
    }
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      const where = call[0]?.where;
      expect(where).toBeDefined();
      expect(where.orgId).toBe(orgId);
    }
  }

  it('returns truthful zeros and nulls for an empty organization', async () => {
    const summary = await getSummary();
    expect(summary.fleet).toEqual({
      total: 0,
      online: 0,
      degraded: 0,
      offline: 0,
      unknown: 0,
      freshness: { live: 0, recent: 0, stale: 0, unavailable: 0 },
      deviceHealth: null,
      recentDevices: [],
    });
    expect(summary.alerts).toEqual({
      unacknowledged: 0,
      bySeverity: { critical: 0, high: 0, medium: 0, low: 0, warning: 0, unknown: 0 },
    });
    expect(summary.security).toEqual({
      openFindings: { critical: 0, high: 0, medium: 0, low: 0, total: 0 },
      worstRiskLevel: null,
      scanCoverage: {
        scannedDevices: 0,
        onlineDevices: 0,
        coveragePercent: null,
        lastScanAt: null,
      },
      unscannedOnlineDevices: 0,
      latestScanAgesDays: null,
    });
    expect(summary.operations.backups).toEqual({
      running: 0,
      pending: 0,
      failedLast24h: 0,
      completedLast24h: 0,
      lastCompletedAt: null,
      lastCompletedJobName: null,
      nextScheduledAt: null,
    });
    expect(summary.operations.scans).toEqual({
      running: 0,
      pending: 0,
      failedLast24h: 0,
      completedLast24h: 0,
    });
    expect(summary.operations.reports).toEqual({
      generating: 0,
      failed: 0,
      completed: 0,
      generatedLast30d: 0,
    });
    expect(summary.team).toEqual({ total: 0 });
    expect(summary.generatedAt).toBeDefined();
  });

  it('counts one online device using the shared presence contract', async () => {
    prisma.device.findMany.mockResolvedValue([
      { id: 'd1', name: 'host-a', hostname: 'host-a', os: 'Linux', lastSeenAt: nowDate() },
    ]);
    const summary = await getSummary();
    expect(summary.fleet.total).toBe(1);
    expect(summary.fleet.online).toBe(1);
    expect(summary.fleet.offline).toBe(0);
    expect(summary.fleet.freshness.live).toBe(1);
  });

  it('treats a device silent for 20 minutes as offline and stale', async () => {
    prisma.device.findMany.mockResolvedValue([
      { id: 'd1', name: 'host-a', hostname: null, os: null, lastSeenAt: minutesAgo(20) },
    ]);
    const summary = await getSummary();
    expect(summary.fleet.total).toBe(1);
    expect(summary.fleet.online).toBe(0);
    expect(summary.fleet.degraded).toBe(0);
    expect(summary.fleet.offline).toBe(1);
    expect(summary.fleet.freshness.stale).toBe(1);
  });

  it('treats a device silent for 10 minutes as degraded but not offline', async () => {
    prisma.device.findMany.mockResolvedValue([
      { id: 'd1', name: 'host-a', hostname: null, os: null, lastSeenAt: minutesAgo(10) },
    ]);
    const summary = await getSummary();
    expect(summary.fleet.total).toBe(1);
    expect(summary.fleet.online).toBe(0);
    expect(summary.fleet.degraded).toBe(1);
    expect(summary.fleet.offline).toBe(0);
    expect(summary.fleet.freshness.stale).toBe(1);
  });

  it('treats missing lastSeenAt as unavailable and unknown presence', async () => {
    prisma.device.findMany.mockResolvedValue([
      { id: 'd1', name: 'host-a', hostname: null, os: null, lastSeenAt: null },
    ]);
    const summary = await getSummary();
    expect(summary.fleet.freshness.unavailable).toBe(1);
    expect(summary.fleet.online).toBe(0);
    expect(summary.fleet.degraded).toBe(0);
    expect(summary.fleet.offline).toBe(0);
    expect(summary.fleet.unknown).toBe(1);
  });

  it('populates all four freshness bands and presence states truthfully', async () => {
    prisma.device.findMany.mockResolvedValue([
      { id: 'd1', name: 'a', hostname: null, os: null, lastSeenAt: nowDate() },
      { id: 'd2', name: 'b', hostname: null, os: null, lastSeenAt: minutesAgo(2) },
      { id: 'd3', name: 'c', hostname: null, os: null, lastSeenAt: minutesAgo(10) },
      { id: 'd4', name: 'd', hostname: null, os: null, lastSeenAt: minutesAgo(20) },
      { id: 'd5', name: 'e', hostname: null, os: null, lastSeenAt: null },
    ]);
    const summary = await getSummary();
    expect(summary.fleet.freshness).toEqual({ live: 1, recent: 1, stale: 2, unavailable: 1 });
    expect(summary.fleet.online).toBe(2);
    expect(summary.fleet.degraded).toBe(1);
    expect(summary.fleet.offline).toBe(1);
    expect(summary.fleet.unknown).toBe(1);
  });

  it('returns an authoritative unacknowledged alert count beyond 10', async () => {
    prisma.alert.groupBy.mockResolvedValue([
      { severity: 'warning', _count: { _all: 14 } },
    ]);
    const summary = await getSummary();
    expect(summary.alerts.unacknowledged).toBe(14);
    expect(summary.alerts.bySeverity.warning).toBe(14);
  });

  it('sums alert buckets across severities and normalizes unknown values', async () => {
    prisma.alert.groupBy.mockResolvedValue([
      { severity: 'critical', _count: { _all: 2 } },
      { severity: 'High', _count: { _all: 3 } },
      { severity: 'info', _count: { _all: 4 } },
    ]);
    const summary = await getSummary();
    expect(summary.alerts.unacknowledged).toBe(9);
    expect(summary.alerts.bySeverity.critical).toBe(2);
    expect(summary.alerts.bySeverity.high).toBe(3);
    expect(summary.alerts.bySeverity.unknown).toBe(4);
  });

  it('distributes open findings by severity', async () => {
    prisma.securityFinding.groupBy.mockResolvedValue([
      { severity: 'critical', _count: { _all: 1 } },
      { severity: 'high', _count: { _all: 2 } },
      { severity: 'medium', _count: { _all: 3 } },
      { severity: 'low', _count: { _all: 4 } },
    ]);
    const summary = await getSummary();
    expect(summary.security.openFindings).toEqual({
      critical: 1,
      high: 2,
      medium: 3,
      low: 4,
      total: 10,
    });
  });

  it('counts findings with unexpected severities in total only', async () => {
    prisma.securityFinding.groupBy.mockResolvedValue([
      { severity: 'high', _count: { _all: 2 } },
      { severity: 'mystery', _count: { _all: 1 } },
    ]);
    const summary = await getSummary();
    expect(summary.security.openFindings.high).toBe(2);
    expect(summary.security.openFindings.total).toBe(3);
  });

  it('derives worstRiskLevel from the latest score per device', async () => {
    prisma.securityScore.findMany.mockResolvedValue([
      { riskLevel: 'low' },
      { riskLevel: 'critical' },
      { riskLevel: 'medium' },
    ]);
    const summary = await getSummary();
    expect(summary.security.worstRiskLevel).toBe('critical');
  });

  it('ignores unknown risk levels when deriving worst risk', async () => {
    prisma.securityScore.findMany.mockResolvedValue([
      { riskLevel: 'medium' },
      { riskLevel: 'unknown-thing' },
    ]);
    const summary = await getSummary();
    expect(summary.security.worstRiskLevel).toBe('medium');
  });

  it('computes scan coverage from online scanned devices only', async () => {
    prisma.device.findMany.mockResolvedValue([
      { id: 'd1', name: 'a', hostname: null, os: null, lastSeenAt: nowDate() },
      { id: 'd2', name: 'b', hostname: null, os: null, lastSeenAt: nowDate() },
      { id: 'd3', name: 'c', hostname: null, os: null, lastSeenAt: nowDate() },
      { id: 'd4', name: 'd', hostname: null, os: null, lastSeenAt: minutesAgo(20) },
    ]);
    prisma.securityScan.findMany.mockResolvedValue([
      { deviceId: 'd1' },
      { deviceId: 'd2' },
      { deviceId: 'd4' },
    ]);
    const summary = await getSummary();
    expect(summary.security.scanCoverage.scannedDevices).toBe(3);
    expect(summary.security.scanCoverage.onlineDevices).toBe(3);
    expect(summary.security.scanCoverage.coveragePercent).toBe(67);
    expect(summary.security.unscannedOnlineDevices).toBe(1);
  });

  it('returns null coverage when no devices are online', async () => {
    prisma.device.findMany.mockResolvedValue([
      { id: 'd1', name: 'a', hostname: null, os: null, lastSeenAt: minutesAgo(60) },
    ]);
    prisma.securityScan.findMany.mockResolvedValue([{ deviceId: 'd1' }]);
    const summary = await getSummary();
    expect(summary.security.scanCoverage.coveragePercent).toBeNull();
    expect(summary.security.unscannedOnlineDevices).toBe(0);
  });

  it('returns zero coverage when online devices exist but none are scanned', async () => {
    prisma.device.findMany.mockResolvedValue([
      { id: 'd1', name: 'a', hostname: null, os: null, lastSeenAt: nowDate() },
    ]);
    const summary = await getSummary();
    expect(summary.security.scanCoverage.coveragePercent).toBe(0);
    expect(summary.security.scanCoverage.scannedDevices).toBe(0);
    expect(summary.security.unscannedOnlineDevices).toBe(1);
  });

  it('reports the latest completed scan age and timestamp', async () => {
    prisma.securityScan.findFirst.mockResolvedValue({
      completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      startedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 - 1000),
    });
    const summary = await getSummary();
    expect(summary.security.latestScanAgesDays).toBe(3);
    expect(summary.security.scanCoverage.lastScanAt).toBeDefined();
  });

  it('returns null scan age when there are no completed scans', async () => {
    const summary = await getSummary();
    expect(summary.security.latestScanAgesDays).toBeNull();
  });

  it('reports a running backup and excludes failed backups older than 24h', async () => {
    prisma.backupRun.count.mockImplementation(({ where }: any) => {
      if (where.status === 'running') return Promise.resolve(1);
      if (where.status === 'failed') return Promise.resolve(1);
      return Promise.resolve(0);
    });
    const summary = await getSummary();
    expect(summary.operations.backups.running).toBe(1);
    expect(summary.operations.backups.failedLast24h).toBe(1);
    expect(summary.operations.backups.completedLast24h).toBe(0);
  });

  it('backs up count queries to the last-24h window via startedAt', async () => {
    await getSummary();
    const failedCalls = (prisma.backupRun.count as jest.Mock).mock.calls.filter(
      (call: any) => call[0].where.status === 'failed',
    );
    expect(failedCalls.length).toBe(1);
    expect(failedCalls[0][0].where.startedAt).toBeDefined();
  });

  it('reports last completed backup with job name', async () => {
    prisma.backupRun.findFirst.mockResolvedValue({
      completedAt: new Date(Date.now() - 3600 * 1000),
      job: { name: 'nightly-files' },
    });
    const summary = await getSummary();
    expect(summary.operations.backups.lastCompletedAt).toBeDefined();
    expect(summary.operations.backups.lastCompletedJobName).toBe('nightly-files');
  });

  it('reports the next scheduled backup run', async () => {
    prisma.backupJob.findFirst.mockResolvedValue({ nextRunAt: new Date(Date.now() + 3600 * 1000) });
    const summary = await getSummary();
    expect(summary.operations.backups.nextScheduledAt).toBeDefined();
  });

  it('reports scan operation counts truthfully', async () => {
    prisma.securityScan.count.mockImplementation(({ where }: any) => {
      if (where.status === 'running') return Promise.resolve(2);
      if (where.status === 'failed') return Promise.resolve(1);
      return Promise.resolve(0);
    });
    const summary = await getSummary();
    expect(summary.operations.scans.running).toBe(2);
    expect(summary.operations.scans.failedLast24h).toBe(1);
    expect(summary.operations.scans.completedLast24h).toBe(0);
  });

  it('reports report operation counts and 30-day generation', async () => {
    prisma.report.count.mockImplementation(({ where }: any) => {
      if (where.status === 'generating') return Promise.resolve(1);
      if (where.status === 'failed') return Promise.resolve(2);
      if (where.status === 'completed' && where.createdAt) return Promise.resolve(5);
      if (where.status === 'completed') return Promise.resolve(8);
      return Promise.resolve(0);
    });
    const summary = await getSummary();
    expect(summary.operations.reports.generating).toBe(1);
    expect(summary.operations.reports.failed).toBe(2);
    expect(summary.operations.reports.completed).toBe(8);
    expect(summary.operations.reports.generatedLast30d).toBe(5);
  });

  it('reports the org-scoped team count', async () => {
    prisma.user.count.mockResolvedValue(4);
    const summary = await getSummary();
    expect(summary.team.total).toBe(4);
  });

  it('computes fleet device health from real health scores only', async () => {
    prisma.deviceHealthScore.findMany.mockResolvedValue([
      { healthScore: 80 },
      { healthScore: 90 },
    ]);
    const summary = await getSummary();
    expect(summary.fleet.deviceHealth).toBe(85);
  });

  it('returns null device health when no health scores exist', async () => {
    const summary = await getSummary();
    expect(summary.fleet.deviceHealth).toBeNull();
  });

  it('caps recentDevices at 8 and maps safe fields', async () => {
    prisma.device.findMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({
        id: `d${i}`,
        name: `host-${i}`,
        hostname: `host-${i}`,
        os: 'Linux',
        lastSeenAt: new Date(Date.now() - i * 1000),
      })),
    );
    const summary = await getSummary();
    expect(summary.fleet.recentDevices.length).toBe(8);
    expect(summary.fleet.recentDevices[0].id).toBe('d0');
    expect(Object.keys(summary.fleet.recentDevices[0]).sort()).toEqual(
      ['id', 'name', 'hostname', 'os', 'lastSeenAt'].sort(),
    );
  });

  it('scopes every aggregation query to the requesting organization', async () => {
    prisma.device.findMany.mockResolvedValue([
      { id: 'd1', name: 'a', hostname: null, os: null, lastSeenAt: nowDate() },
    ]);
    prisma.alert.groupBy.mockResolvedValue([{ severity: 'warning', _count: { _all: 1 } }]);
    prisma.securityFinding.groupBy.mockResolvedValue([{ severity: 'high', _count: { _all: 1 } }]);
    prisma.securityScore.findMany.mockResolvedValue([{ riskLevel: 'high' }]);
    prisma.securityScan.findMany.mockResolvedValue([{ deviceId: 'd1' }]);
    prisma.deviceHealthScore.findMany.mockResolvedValue([{ healthScore: 90 }]);
    await getSummary('org-A');
    expectOrgIsolated('org-A');
  });
});
