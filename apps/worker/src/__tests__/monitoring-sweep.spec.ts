import { runMonitoringSweep, buildActiveKey, evaluateThreshold } from '../monitoring-sweep';

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60 * 1000);
}

function createMockPrisma() {
  const state: any = {
    rules: [],
    devices: [],
    alerts: [],
  };

  const prisma: any = {
    alertRule: {
      findMany: jest.fn(async ({ where }: any) => {
        return state.rules.filter((r: any) => {
          if (where.enabled != null && r.enabled !== where.enabled) return false;
          if (where.kind != null && r.kind !== where.kind) return false;
          return true;
        });
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        return state.rules.find((r: any) => r.id === where.id) ?? null;
      }),
    },
    device: {
      findMany: jest.fn(async ({ where }: any) => {
        return state.devices.filter((d: any) => d.orgId === where.orgId);
      }),
    },
    alert: {
      findFirst: jest.fn(async ({ where }: any) => {
        return state.alerts.find((a: any) => {
          if (where.orgId && a.orgId !== where.orgId) return false;
          if (where.activeKey && a.activeKey !== where.activeKey) return false;
          if (where.alertRuleId && a.alertRuleId !== where.alertRuleId) return false;
          if (where.deviceId && a.deviceId !== where.deviceId) return false;
          if (where.activeKey === null && a.activeKey !== null) return false;
          if (where.source && a.source !== where.source) return false;
          if (where.status?.in && !where.status.in.includes(a.status)) return false;
          return true;
        }) ?? null;
      }),
      findMany: jest.fn(async ({ where, orderBy }: any) => {
        let matches = state.alerts.filter((a: any) => {
          if (where.orgId && a.orgId !== where.orgId) return false;
          if (where.alertRuleId && a.alertRuleId !== where.alertRuleId) return false;
          if (where.deviceId && a.deviceId !== where.deviceId) return false;
          if (where.activeKey === null && a.activeKey !== null) return false;
          if (where.source && a.source !== where.source) return false;
          if (where.id?.in && !where.id.in.includes(a.id)) return false;
          if (where.status?.in && !where.status.in.includes(a.status)) return false;
          return true;
        });
        if (orderBy?.createdAt === 'asc') {
          matches = [...matches].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
        }
        return matches;
      }),
      create: jest.fn(async ({ data }: any) => {
        const alert = { id: `alert-${state.alerts.length + 1}`, createdAt: new Date(), ...data };
        state.alerts.push(alert);
        return alert;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const alert = state.alerts.find((a: any) => a.id === where.id);
        Object.assign(alert, data);
        return alert;
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const a of state.alerts) {
          if (where.id?.in && !where.id.in.includes(a.id)) continue;
          if (where.status?.in && !where.status.in.includes(a.status)) continue;
          Object.assign(a, data);
          count += 1;
        }
        return { count };
      }),
    },
    deviceMetric: {
      findFirst: jest.fn(async () => state.latestMetric ?? null),
    },
    deviceHealthScore: {
      findFirst: jest.fn(async () => state.latestScore ?? null),
    },
  };

  return { prisma, state };
}

function presenceRule(overrides: any = {}) {
  return {
    id: 'rule-presence',
    orgId: 'org-1',
    name: 'Device Offline',
    threshold: 15,
    severity: 'warning',
    webhookUrl: null,
    enabled: true,
    kind: 'presence',
    ...overrides,
  };
}

function metricRule(overrides: any = {}) {
  return {
    id: 'rule-cpu',
    orgId: 'org-1',
    name: 'CPU High',
    metricName: 'cpuUsage',
    threshold: 80,
    operator: 'gt',
    severity: 'critical',
    enabled: true,
    kind: 'metric',
    ...overrides,
  };
}

describe('runMonitoringSweep', () => {
  it('creates one presence alert and notifies for an OFFLINE device', async () => {
    const { prisma, state } = createMockPrisma();
    state.rules = [presenceRule()];
    state.devices = [{ id: 'dev-1', name: 'host-a', hostname: 'host-a', orgId: 'org-1', lastSeenAt: minutesAgo(30) }];

    const notify = jest.fn().mockResolvedValue(undefined);
    const result = await runMonitoringSweep(prisma, { now: new Date(), notify });

    expect(result.presenceAlertsCreated).toBe(1);
    expect(result.notificationsQueued).toBe(1);
    expect(state.alerts).toHaveLength(1);
    expect(state.alerts[0]).toMatchObject({
      orgId: 'org-1',
      alertRuleId: 'rule-presence',
      deviceId: 'dev-1',
      source: 'presence',
      status: 'OPEN',
      activeKey: buildActiveKey('rule-presence', 'dev-1'),
      severity: 'warning',
    });
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0][0].deviceName).toBe('host-a');
  });

  it('refreshes the existing alert on a second sweep instead of duplicating or re-notifying', async () => {
    const { prisma, state } = createMockPrisma();
    state.rules = [presenceRule()];
    state.devices = [{ id: 'dev-1', name: 'host-a', hostname: 'host-a', orgId: 'org-1', lastSeenAt: minutesAgo(30) }];

    const notify = jest.fn().mockResolvedValue(undefined);
    const first = await runMonitoringSweep(prisma, { now: new Date(), notify });
    const second = await runMonitoringSweep(prisma, { now: new Date(), notify });

    expect(first.presenceAlertsCreated).toBe(1);
    expect(second.presenceAlertsCreated).toBe(0);
    expect(second.presenceAlertsRefreshed).toBe(1);
    expect(state.alerts).toHaveLength(1);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('resolves an OPEN presence alert once the device is reachable again', async () => {
    const { prisma, state } = createMockPrisma();
    state.rules = [presenceRule()];
    state.devices = [{ id: 'dev-1', name: 'host-a', hostname: 'host-a', orgId: 'org-1', lastSeenAt: minutesAgo(30) }];

    await runMonitoringSweep(prisma, { now: new Date(), notify: jest.fn() });
    expect(state.alerts[0].status).toBe('OPEN');

    state.devices[0].lastSeenAt = new Date();
    const result = await runMonitoringSweep(prisma, { now: new Date(), notify: jest.fn() });

    expect(result.presenceAlertsResolved).toBe(1);
    expect(state.alerts[0].status).toBe('RESOLVED');
    expect(state.alerts[0].activeKey).toBeNull();
    expect(state.alerts[0].resolvedAt).toBeDefined();
  });

  it('promotes the oldest legacy duplicate and resolves the rest', async () => {
    const { prisma, state } = createMockPrisma();
    state.rules = [presenceRule()];
    state.devices = [{ id: 'dev-1', name: 'host-a', hostname: 'host-a', orgId: 'org-1', lastSeenAt: minutesAgo(30) }];
    state.alerts = [
      { id: 'legacy-1', orgId: 'org-1', alertRuleId: 'rule-presence', deviceId: 'dev-1', activeKey: null, status: 'OPEN', createdAt: minutesAgo(100) },
      { id: 'legacy-2', orgId: 'org-1', alertRuleId: 'rule-presence', deviceId: 'dev-1', activeKey: null, status: 'OPEN', createdAt: minutesAgo(50) },
    ];

    const notify = jest.fn().mockResolvedValue(undefined);
    const result = await runMonitoringSweep(prisma, { now: new Date(), notify });

    expect(result.legacyDuplicatesPromoted).toBe(1);
    expect(result.presenceAlertsCreated).toBe(0);
    expect(notify).toHaveBeenCalledTimes(1);
    const legacy1 = state.alerts.find((a: any) => a.id === 'legacy-1');
    const legacy2 = state.alerts.find((a: any) => a.id === 'legacy-2');
    expect(legacy1.status).toBe('OPEN');
    expect(legacy1.activeKey).toBe(buildActiveKey('rule-presence', 'dev-1'));
    expect(legacy2.status).toBe('RESOLVED');
    expect(legacy2.activeKey).toBeNull();
  });

  it('resolves legacy duplicates when the device is reachable', async () => {
    const { prisma, state } = createMockPrisma();
    state.rules = [presenceRule()];
    state.devices = [{ id: 'dev-1', name: 'host-a', hostname: 'host-a', orgId: 'org-1', lastSeenAt: new Date() }];
    state.alerts = [
      { id: 'legacy-1', orgId: 'org-1', alertRuleId: 'rule-presence', deviceId: 'dev-1', activeKey: null, status: 'OPEN', createdAt: minutesAgo(100) },
    ];

    const result = await runMonitoringSweep(prisma, { now: new Date(), notify: jest.fn() });
    expect(result.presenceAlertsResolved).toBe(1);
    expect(state.alerts[0].status).toBe('RESOLVED');
  });

  it('auto-resolves a metric alert whose condition has cleared', async () => {
    const { prisma, state } = createMockPrisma();
    state.rules = [metricRule()];
    state.devices = [{ id: 'dev-1', name: 'host-a', hostname: 'host-a', orgId: 'org-1', lastSeenAt: new Date() }];
    state.alerts = [
      { id: 'metric-open', orgId: 'org-1', alertRuleId: 'rule-cpu', deviceId: 'dev-1', activeKey: buildActiveKey('rule-cpu', 'dev-1'), source: 'metric', status: 'OPEN', createdAt: new Date() },
    ];
    state.latestMetric = { cpuUsage: 20, ramPercent: 10, diskUsed: BigInt(1), diskTotal: BigInt(10), tempCpu: null, loadAverage1Min: null, processes: null };

    const result = await runMonitoringSweep(prisma, { now: new Date(), notify: jest.fn() });
    expect(result.metricAlertsResolved).toBe(1);
    expect(state.alerts[0].status).toBe('RESOLVED');
  });

  it('keeps a metric alert OPEN while the condition still breaches', async () => {
    const { prisma, state } = createMockPrisma();
    state.rules = [metricRule()];
    state.devices = [{ id: 'dev-1', name: 'host-a', hostname: 'host-a', orgId: 'org-1', lastSeenAt: new Date() }];
    state.alerts = [
      { id: 'metric-open', orgId: 'org-1', alertRuleId: 'rule-cpu', deviceId: 'dev-1', activeKey: buildActiveKey('rule-cpu', 'dev-1'), source: 'metric', status: 'OPEN', createdAt: new Date() },
    ];
    state.latestMetric = { cpuUsage: 95, ramPercent: 10, diskUsed: null, diskTotal: null, tempCpu: null, loadAverage1Min: null, processes: null };

    const result = await runMonitoringSweep(prisma, { now: new Date(), notify: jest.fn() });
    expect(result.metricAlertsResolved).toBe(0);
    expect(state.alerts[0].status).toBe('OPEN');
  });

  it('resolves a metric alert when its rule is disabled or removed', async () => {
    const { prisma, state } = createMockPrisma();
    state.rules = [metricRule({ enabled: false })];
    state.devices = [];
    state.alerts = [
      { id: 'metric-open', orgId: 'org-1', alertRuleId: 'rule-cpu', deviceId: 'dev-1', activeKey: buildActiveKey('rule-cpu', 'dev-1'), source: 'metric', status: 'OPEN', createdAt: new Date() },
    ];

    const result = await runMonitoringSweep(prisma, { now: new Date(), notify: jest.fn() });
    expect(result.metricAlertsResolved).toBe(1);
    expect(state.alerts[0].status).toBe('RESOLVED');
  });

  it('returns zeros when no presence rules exist', async () => {
    const { prisma } = createMockPrisma();
    const result = await runMonitoringSweep(prisma, { now: new Date(), notify: jest.fn() });
    expect(result.orgsProcessed).toBe(0);
    expect(result.devicesEvaluated).toBe(0);
    expect(result.presenceAlertsCreated).toBe(0);
    expect(result.metricAlertsResolved).toBe(0);
  });
});

describe('evaluateThreshold', () => {
  it('supports gt, lt, gte, lte, eq and unknown operators', () => {
    expect(evaluateThreshold(90, 80, 'gt')).toBe(true);
    expect(evaluateThreshold(70, 80, 'lt')).toBe(true);
    expect(evaluateThreshold(80, 80, 'gte')).toBe(true);
    expect(evaluateThreshold(80, 80, 'lte')).toBe(true);
    expect(evaluateThreshold(80, 80, 'eq')).toBe(true);
    expect(evaluateThreshold(90, 80, 'bogus')).toBe(false);
  });
});
