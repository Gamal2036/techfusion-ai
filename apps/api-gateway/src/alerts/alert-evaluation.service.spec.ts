import { Test, TestingModule } from '@nestjs/testing';
import { AlertEvaluationService } from './alert-evaluation.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AlertEvaluationService', () => {
  let service: AlertEvaluationService;

  const mockPrisma = {
    alertRule: {
      findMany: jest.fn(),
    },
    alert: {
      create: jest.fn(),
    },
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
    mockPrisma.alertRule.findMany.mockResolvedValue([
      {
        id: 'rule-1',
        orgId: 'org-1',
        name: 'High CPU',
        metricName: 'cpuUsage',
        threshold: 80,
        operator: 'gt',
        severity: 'warning',
        debounceSeconds: 300,
        enabled: true,
        deviceSelector: null,
        webhookUrl: null,
      },
    ]);
    mockPrisma.alert.create.mockResolvedValue({
      id: 'alert-1',
      orgId: 'org-1',
      alertRuleId: 'rule-1',
      deviceId: 'dev-1',
      metricValue: 95,
      threshold: 80,
      severity: 'warning',
      message: 'High CPU: cpuUsage exceeded 80 (current: 95) on device dev-1',
      createdAt: new Date(),
    });

    const result = await service.evaluateMetrics('dev-1', 'org-1', {
      deviceId: 'dev-1',
      orgId: 'org-1',
      cpuUsage: 95,
      ramPercent: 30,
      diskPercent: 40,
      tempCpu: 50,
      loadAverage1Min: 1,
      processes: 100,
      services: null,
    });

    expect(result).toHaveLength(1);
    expect(result[0].metricValue).toBe(95);
    expect(mockPrisma.alert.create).toHaveBeenCalledTimes(1);
  });

  it('should NOT create alert when threshold not breached (gt)', async () => {
    mockPrisma.alertRule.findMany.mockResolvedValue([
      {
        id: 'rule-1',
        orgId: 'org-1',
        name: 'High CPU',
        metricName: 'cpuUsage',
        threshold: 80,
        operator: 'gt',
        severity: 'warning',
        debounceSeconds: 300,
        enabled: true,
        deviceSelector: null,
        webhookUrl: null,
      },
    ]);

    const result = await service.evaluateMetrics('dev-1', 'org-1', {
      deviceId: 'dev-1',
      orgId: 'org-1',
      cpuUsage: 50,
      ramPercent: 30,
      diskPercent: 40,
      tempCpu: 50,
      loadAverage1Min: 1,
      processes: 100,
      services: null,
    });

    expect(result).toHaveLength(0);
    expect(mockPrisma.alert.create).not.toHaveBeenCalled();
  });

  it('should respect debounce window and not create duplicate alerts', async () => {
    mockPrisma.alertRule.findMany.mockResolvedValue([
      {
        id: 'rule-1',
        orgId: 'org-1',
        name: 'High CPU',
        metricName: 'cpuUsage',
        threshold: 80,
        operator: 'gt',
        severity: 'warning',
        debounceSeconds: 300,
        enabled: true,
        deviceSelector: null,
        webhookUrl: null,
      },
    ]);
    mockPrisma.alert.create.mockResolvedValue({
      id: 'alert-1',
      orgId: 'org-1',
      alertRuleId: 'rule-1',
      deviceId: 'dev-1',
      metricValue: 95,
      threshold: 80,
      severity: 'warning',
      message: 'High CPU: cpuUsage exceeded 80 (current: 95) on device dev-1',
      createdAt: new Date(),
    });

    // First call should create alert
    const first = await service.evaluateMetrics('dev-1', 'org-1', {
      deviceId: 'dev-1',
      orgId: 'org-1',
      cpuUsage: 95,
      ramPercent: 30,
      diskPercent: 40,
      tempCpu: 50,
      loadAverage1Min: 1,
      processes: 100,
      services: null,
    });
    expect(first).toHaveLength(1);

    // Second immediate call should be debounced
    const second = await service.evaluateMetrics('dev-1', 'org-1', {
      deviceId: 'dev-1',
      orgId: 'org-1',
      cpuUsage: 96,
      ramPercent: 30,
      diskPercent: 40,
      tempCpu: 50,
      loadAverage1Min: 1,
      processes: 100,
      services: null,
    });
    expect(second).toHaveLength(0);

    expect(mockPrisma.alert.create).toHaveBeenCalledTimes(1);
  });

  it('should support lt operator', async () => {
    mockPrisma.alertRule.findMany.mockResolvedValue([
      {
        id: 'rule-2',
        orgId: 'org-1',
        name: 'Low Disk',
        metricName: 'diskPercent',
        threshold: 10,
        operator: 'lt',
        severity: 'critical',
        debounceSeconds: 300,
        enabled: true,
        deviceSelector: null,
        webhookUrl: null,
      },
    ]);
    mockPrisma.alert.create.mockResolvedValue({
      id: 'alert-2',
      orgId: 'org-1',
      alertRuleId: 'rule-2',
      deviceId: 'dev-1',
      metricValue: 5,
      threshold: 10,
      severity: 'critical',
      message: 'Low Disk: diskPercent dropped below 10 (current: 5) on device dev-1',
      createdAt: new Date(),
    });

    const result = await service.evaluateMetrics('dev-1', 'org-1', {
      deviceId: 'dev-1',
      orgId: 'org-1',
      cpuUsage: 30,
      ramPercent: 40,
      diskPercent: 5,
      tempCpu: 50,
      loadAverage1Min: 1,
      processes: 100,
      services: null,
    });

    expect(result).toHaveLength(1);
    expect(result[0].metricValue).toBe(5);
  });

  it('should support eq operator', async () => {
    mockPrisma.alertRule.findMany.mockResolvedValue([
      {
        id: 'rule-3',
        orgId: 'org-1',
        name: 'Zero CPU',
        metricName: 'cpuUsage',
        threshold: 0,
        operator: 'eq',
        severity: 'info',
        debounceSeconds: 300,
        enabled: true,
        deviceSelector: null,
        webhookUrl: null,
      },
    ]);
    mockPrisma.alert.create.mockResolvedValue({
      id: 'alert-3',
      orgId: 'org-1',
      alertRuleId: 'rule-3',
      deviceId: 'dev-1',
      metricValue: 0,
      threshold: 0,
      severity: 'info',
      message: 'Zero CPU: cpuUsage equals 0 (current: 0) on device dev-1',
      createdAt: new Date(),
    });

    const result = await service.evaluateMetrics('dev-1', 'org-1', {
      deviceId: 'dev-1',
      orgId: 'org-1',
      cpuUsage: 0,
      ramPercent: 30,
      diskPercent: 40,
      tempCpu: 50,
      loadAverage1Min: 1,
      processes: 100,
      services: null,
    });

    expect(result).toHaveLength(1);
    expect(result[0].metricValue).toBe(0);
  });

  it('should skip disabled rules', async () => {
    // Service queries with { enabled: true }, so disabled rules won't be returned
    mockPrisma.alertRule.findMany.mockResolvedValue([]);

    const result = await service.evaluateMetrics('dev-1', 'org-1', {
      deviceId: 'dev-1',
      orgId: 'org-1',
      cpuUsage: 95,
      ramPercent: 30,
      diskPercent: 40,
      tempCpu: 50,
      loadAverage1Min: 1,
      processes: 100,
      services: null,
    });

    expect(result).toHaveLength(0);
    expect(mockPrisma.alertRule.findMany).toHaveBeenCalledWith({
      where: { orgId: 'org-1', enabled: true },
    });
  });

  it('should handle unknown metric names gracefully', async () => {
    mockPrisma.alertRule.findMany.mockResolvedValue([
      {
        id: 'rule-1',
        orgId: 'org-1',
        name: 'Unknown Metric',
        metricName: 'nonexistent',
        threshold: 50,
        operator: 'gt',
        severity: 'warning',
        debounceSeconds: 300,
        enabled: true,
        deviceSelector: null,
        webhookUrl: null,
      },
    ]);

    const result = await service.evaluateMetrics('dev-1', 'org-1', {
      deviceId: 'dev-1',
      orgId: 'org-1',
      cpuUsage: 30,
      ramPercent: 40,
      diskPercent: 50,
      tempCpu: 60,
      loadAverage1Min: 1,
      processes: 100,
      services: null,
    });

    expect(result).toHaveLength(0);
    expect(mockPrisma.alert.create).not.toHaveBeenCalled();
  });
});
