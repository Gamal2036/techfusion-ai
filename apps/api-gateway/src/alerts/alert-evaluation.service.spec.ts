import { Test, TestingModule } from '@nestjs/testing';
import { AlertEvaluationService, buildActiveKey } from './alert-evaluation.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AlertEvaluationService', () => {
  let service: AlertEvaluationService;

  const mockPrisma = {
    alertRule: {
      findMany: jest.fn(),
    },
    alert: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const rule = (overrides: Partial<any> = {}) => ({
    id: 'rule-1',
    orgId: 'org-1',
    name: 'High CPU',
    kind: 'metric',
    metricName: 'cpuUsage',
    threshold: 80,
    operator: 'gt',
    severity: 'warning',
    debounceSeconds: 300,
    enabled: true,
    deviceSelector: null,
    webhookUrl: null,
    ...overrides,
  });

  const createdAlert = (id: string) => ({
    id,
    orgId: 'org-1',
    alertRuleId: 'rule-1',
    deviceId: 'dev-1',
    metricValue: 95,
    threshold: 80,
    severity: 'warning',
    status: 'OPEN',
    source: 'metric',
    message: 'High CPU: cpuUsage exceeded 80 (current: 95) on device dev-1',
    createdAt: new Date(),
  });

  const snapshot = {
    deviceId: 'dev-1',
    orgId: 'org-1',
    cpuUsage: 95,
    ramPercent: 30,
    diskPercent: 40,
    tempCpu: 50,
    loadAverage1Min: 1,
    processes: 100,
    services: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertEvaluationService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AlertEvaluationService>(AlertEvaluationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create alert when threshold is breached (gt)', async () => {
    mockPrisma.alertRule.findMany.mockResolvedValue([rule()]);
    mockPrisma.alert.findFirst.mockResolvedValue(null);
    mockPrisma.alert.create.mockResolvedValue(createdAlert('alert-1'));

    const result = await service.evaluateMetrics('dev-1', 'org-1', snapshot);

    expect(result).toHaveLength(1);
    expect(result[0].metricValue).toBe(95);
    expect(mockPrisma.alert.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.alert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'OPEN',
          source: 'metric',
          activeKey: buildActiveKey('rule-1', 'dev-1'),
          lastDetectedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('should NOT create alert when threshold not breached (gt)', async () => {
    mockPrisma.alertRule.findMany.mockResolvedValue([rule()]);

    const result = await service.evaluateMetrics('dev-1', 'org-1', {
      ...snapshot,
      cpuUsage: 50,
    });

    expect(result).toHaveLength(0);
    expect(mockPrisma.alert.create).not.toHaveBeenCalled();
  });

  it('should refresh an existing OPEN alert instead of creating a duplicate', async () => {
    mockPrisma.alertRule.findMany.mockResolvedValue([rule()]);
    mockPrisma.alert.findFirst.mockResolvedValue({ id: 'alert-1' });
    mockPrisma.alert.update.mockResolvedValue({ ...createdAlert('alert-1'), metricValue: 97 });

    const result = await service.evaluateMetrics('dev-1', 'org-1', {
      ...snapshot,
      cpuUsage: 97,
    });

    expect(result).toHaveLength(0);
    expect(mockPrisma.alert.create).not.toHaveBeenCalled();
    expect(mockPrisma.alert.update).toHaveBeenCalledWith({
      where: { id: 'alert-1' },
      data: expect.objectContaining({
        metricValue: 97,
        lastDetectedAt: expect.any(Date),
      }),
    });
  });

  it('should open a new alert after the previous one is resolved', async () => {
    mockPrisma.alertRule.findMany.mockResolvedValue([rule()]);
    // No active alert (the previous one was resolved, so activeKey was cleared).
    mockPrisma.alert.findFirst.mockResolvedValue(null);
    mockPrisma.alert.create.mockResolvedValue(createdAlert('alert-2'));

    const result = await service.evaluateMetrics('dev-1', 'org-1', snapshot);

    expect(result).toHaveLength(1);
    expect(mockPrisma.alert.create).toHaveBeenCalledTimes(1);
  });

  it('should handle a unique constraint race by refreshing the winning alert', async () => {
    mockPrisma.alertRule.findMany.mockResolvedValue([rule()]);
    mockPrisma.alert.findFirst
      .mockResolvedValueOnce(null)   // no existing alert at check time
      .mockResolvedValueOnce({ id: 'alert-1' }); // another instance created it
    mockPrisma.alert.create.mockRejectedValue({ code: 'P2002' });
    mockPrisma.alert.update.mockResolvedValue(createdAlert('alert-1'));

    const result = await service.evaluateMetrics('dev-1', 'org-1', snapshot);

    expect(result).toHaveLength(0);
    expect(mockPrisma.alert.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'alert-1' } }),
    );
  });

  it('should support lt operator', async () => {
    mockPrisma.alertRule.findMany.mockResolvedValue([
      rule({ id: 'rule-2', name: 'Low Disk', metricName: 'diskPercent', threshold: 10, operator: 'lt', severity: 'critical' }),
    ]);
    mockPrisma.alert.findFirst.mockResolvedValue(null);
    mockPrisma.alert.create.mockResolvedValue({
      id: 'alert-2',
      metricValue: 5,
    });

    const result = await service.evaluateMetrics('dev-1', 'org-1', {
      ...snapshot,
      diskPercent: 5,
    });

    expect(result).toHaveLength(1);
    expect(result[0].metricValue).toBe(5);
  });

  it('should support eq operator', async () => {
    mockPrisma.alertRule.findMany.mockResolvedValue([
      rule({ id: 'rule-3', name: 'Zero CPU', metricName: 'cpuUsage', threshold: 0, operator: 'eq', severity: 'info' }),
    ]);
    mockPrisma.alert.findFirst.mockResolvedValue(null);
    mockPrisma.alert.create.mockResolvedValue({
      id: 'alert-3',
      metricValue: 0,
    });

    const result = await service.evaluateMetrics('dev-1', 'org-1', {
      ...snapshot,
      cpuUsage: 0,
    });

    expect(result).toHaveLength(1);
    expect(result[0].metricValue).toBe(0);
  });

  it('should support healthScore and riskScore metric sources', async () => {
    mockPrisma.alertRule.findMany.mockResolvedValue([
      rule({ id: 'rule-4', name: 'Low Health', metricName: 'healthScore', threshold: 50, operator: 'lt', severity: 'warning' }),
      rule({ id: 'rule-5', name: 'High Risk', metricName: 'riskScore', threshold: 70, operator: 'gt', severity: 'critical' }),
    ]);
    mockPrisma.alert.findFirst.mockResolvedValue(null);
    mockPrisma.alert.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: data.alertRuleId, metricValue: data.metricValue }));

    const result = await service.evaluateMetrics('dev-1', 'org-1', {
      ...snapshot,
      healthScore: 30,
      riskScore: 85,
    });

    expect(result).toHaveLength(2);
  });

  it('should skip disabled rules', async () => {
    mockPrisma.alertRule.findMany.mockResolvedValue([]);

    const result = await service.evaluateMetrics('dev-1', 'org-1', snapshot);

    expect(result).toHaveLength(0);
    expect(mockPrisma.alertRule.findMany).toHaveBeenCalledWith({
      where: { orgId: 'org-1', enabled: true, kind: 'metric' },
    });
  });

  it('should handle unknown metric names gracefully', async () => {
    mockPrisma.alertRule.findMany.mockResolvedValue([
      rule({ id: 'rule-1', name: 'Unknown Metric', metricName: 'nonexistent' }),
    ]);

    const result = await service.evaluateMetrics('dev-1', 'org-1', snapshot);

    expect(result).toHaveLength(0);
    expect(mockPrisma.alert.create).not.toHaveBeenCalled();
  });
});
