import { Test, TestingModule } from '@nestjs/testing';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { DeviceTokenGuard } from './device-token.guard';
import { DevicesGateway } from './devices.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { ScoringService } from './scoring.service';
import { AlertEvaluationService } from '../alerts/alert-evaluation.service';
import { AlertsGateway } from '../alerts/alerts.gateway';
import { QueueService } from '../queue/queue.service';
import { MockQueueService } from '../queue/queue.service.mock';
import { QueueModule } from '../queue/queue.module';
import { EnrollmentService } from '../enrollment/enrollment.service';
import { EnrollmentModule } from '../enrollment/enrollment.module';

describe('DevicesController', () => {
  let controller: DevicesController;
  let mockPrisma: any;

  const mockDevice = {
    id: 'dev-001',
    orgId: 'org-001',
    name: 'test-host',
    hostname: 'test-host',
    os: 'Linux',
    osVersion: '6.8.0',
    cpuModel: 'Intel Core i7',
    cpuCores: 8,
    cpuLogical: 16,
    ramTotal: BigInt(17179869184),
    diskTotal: BigInt(512000000000),
    isLaptop: false,
    deviceTokenHash: 'sha256-verifier-of-tok-test-123',
    inactive: false,
    lastSeenAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    identityFingerprint: 'sha256:abc123',
    installationId: 'inst-001',
    agentVersion: '1.0.0',
    identityVersion: 1,
    credentialVersion: 1,
    lastRegisteredAt: new Date(),
  };

  const mockMetric = {
    id: 'met-001',
    deviceId: 'dev-001',
    orgId: 'org-001',
    recordedAt: new Date(),
    cpuUsage: 45.2,
    ramUsed: BigInt(8000000000),
    ramTotal: BigInt(16000000000),
    ramPercent: 50,
    diskUsed: BigInt(256000000000),
    diskTotal: BigInt(512000000000),
    uptime: BigInt(86400),
    processes: 320,
  };

  const mockScore = {
    id: 'score-001',
    deviceId: 'dev-001',
    orgId: 'org-001',
    healthScore: 85,
    performanceScore: 80,
    riskScore: 15,
    calculatedAt: new Date(),
  };

  const mockEnrollmentToken = 'tfenr_abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

  beforeEach(async () => {
    mockPrisma = {
      device: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      deviceMetric: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      deviceHealthScore: {
        create: jest.fn(),
        findFirst: jest.fn(),
      },
      credentialRotationEvent: {
        create: jest.fn(),
      },
      organization: {
        findUnique: jest.fn(),
      },
    };

    const mockGateway = {
      broadcastMetrics: jest.fn(),
      broadcastAlert: jest.fn(),
    };

    const mockAlertEval = {
      evaluateMetrics: jest.fn().mockResolvedValue([]),
    };

    const mockAlertsGateway = {
      broadcastAlert: jest.fn(),
    };

    const mockEnrollmentService = {
      validateToken: jest.fn().mockResolvedValue('org-001'),
      createToken: jest.fn(),
      listTokens: jest.fn(),
      revokeToken: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [QueueModule],
      controllers: [DevicesController],
      providers: [
        DevicesService,
        ScoringService,
        DeviceTokenGuard,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: DevicesGateway, useValue: mockGateway },
        { provide: AlertEvaluationService, useValue: mockAlertEval },
        { provide: AlertsGateway, useValue: mockAlertsGateway },
        { provide: EnrollmentService, useValue: mockEnrollmentService },
      ],
    })
      .overrideProvider(QueueService)
      .useClass(MockQueueService)
      .compile();

    controller = module.get<DevicesController>(DevicesController);
  });

  describe('registerPublic', () => {
    it('registers a new device with enrollment token', async () => {
      mockPrisma.device.findFirst.mockResolvedValue(null);
      mockPrisma.device.count.mockResolvedValue(0);
      mockPrisma.organization.findUnique.mockResolvedValue({ plan: 'Free' });
      mockPrisma.device.create.mockResolvedValue(mockDevice);

      const req = { headers: {} } as any;
      const dto = {
        name: 'test-host',
        hostname: 'test-host',
        os: 'Linux',
        osVersion: '6.8.0',
        cpuModel: 'Intel Core i7',
        cpuCores: 8,
        cpuLogical: 16,
        ramTotal: 17179869184,
        diskTotal: 512000000000,
        isLaptop: false,
        identityFingerprint: 'sha256:abc123def456',
        installationId: 'inst-001',
        agentVersion: '1.0.0',
        enrollmentToken: mockEnrollmentToken,
      };

      const result = await controller.registerPublic(req, dto) as any;
      expect(result.device).toBeDefined();
      expect(result.deviceToken).toBeDefined();
      expect(result.duplicate).toBe(false);
      expect(mockPrisma.device.create).toHaveBeenCalled();
    });

    it('returns existing device when duplicate identity detected', async () => {
      mockPrisma.device.findFirst.mockResolvedValue(mockDevice);
      mockPrisma.device.update.mockResolvedValue({ ...mockDevice, deviceTokenHash: 'sha256-verifier-of-new-token', credentialVersion: 2 });
      mockPrisma.credentialRotationEvent.create.mockResolvedValue({});
      mockPrisma.device.count.mockResolvedValue(0);
      mockPrisma.organization.findUnique.mockResolvedValue({ plan: 'Free' });

      const req = { headers: {} } as any;
      const dto = {
        name: 'test-host',
        hostname: 'test-host',
        identityFingerprint: 'sha256:abc123def456',
        installationId: 'inst-001',
        enrollmentToken: mockEnrollmentToken,
      };

      const result = await controller.registerPublic(req, dto) as any;
      expect(result.device.id).toBe('dev-001');
      expect(result.deviceToken).not.toBe('tok-test-123');
      expect(result.duplicate).toBe(true);
      expect(mockPrisma.device.create).not.toHaveBeenCalled();
      expect(mockPrisma.device.update).toHaveBeenCalled();
      expect(mockPrisma.credentialRotationEvent.create).toHaveBeenCalled();
    });

    it('rejects registration without enrollment token', async () => {
      const req = { headers: {} } as any;
      const dto = {
        name: 'test-host',
        hostname: 'test-host',
        identityFingerprint: 'sha256:abc123def456',
      };

      const result = await controller.registerPublic(req, dto) as any;
      expect(result.error).toBeDefined();
      expect(result.code).toBe('ENROLLMENT_REQUIRED');
    });
  });

  describe('ingestMetrics', () => {
    it('accepts valid metrics payload from authenticated device', async () => {
      mockPrisma.deviceMetric.create.mockResolvedValue(mockMetric);
      mockPrisma.device.update.mockResolvedValue(mockDevice);
      mockPrisma.deviceHealthScore.create.mockResolvedValue(mockScore);

      const req = { device: mockDevice, orgId: 'org-001' } as any;
      const dto = {
        timestamp: new Date().toISOString(),
        cpu: { usage: 45.2, cores: 8 },
        memory: { total: 16000000000, used: 8000000000, percent: 50 },
        disk: { total: 512000000000, used: 256000000000 },
        processes: 320,
        uptime: 86400,
      };

      const result = await controller.ingestMetrics(req, dto);
      expect(result.metric).toBeDefined();
      expect(result.score).toBeDefined();
      expect(mockPrisma.deviceMetric.create).toHaveBeenCalled();
      expect(mockPrisma.deviceHealthScore.create).toHaveBeenCalled();
    });

    it('emits metrics event after successful storage', async () => {
      mockPrisma.deviceMetric.create.mockResolvedValue(mockMetric);
      mockPrisma.device.update.mockResolvedValue(mockDevice);
      mockPrisma.deviceHealthScore.create.mockResolvedValue(mockScore);

      const mockGateway = {
        broadcastMetrics: jest.fn(),
        broadcastAlert: jest.fn(),
      };

      const module = await Test.createTestingModule({
        imports: [QueueModule],
        controllers: [DevicesController],
        providers: [
          DevicesService,
          ScoringService,
          DeviceTokenGuard,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: DevicesGateway, useValue: mockGateway },
          { provide: AlertEvaluationService, useValue: { evaluateMetrics: jest.fn().mockResolvedValue([]) } },
          { provide: AlertsGateway, useValue: { broadcastAlert: jest.fn() } },
          { provide: EnrollmentService, useValue: { validateToken: jest.fn() } },
        ],
      })
        .overrideProvider(QueueService)
        .useClass(MockQueueService)
        .compile();

      const testController = module.get<DevicesController>(DevicesController);

      const req = { device: mockDevice, orgId: 'org-001' } as any;
      const dto = {
        timestamp: new Date().toISOString(),
        cpu: { usage: 45.2 },
        memory: { total: 16000000000, used: 8000000000, percent: 50 },
      };

      await testController.ingestMetrics(req, dto);

      expect(mockGateway.broadcastMetrics).toHaveBeenCalledTimes(1);
      const callArgs = mockGateway.broadcastMetrics.mock.calls[0];
      expect(callArgs[0]).toBe('org-001');
      expect(callArgs[1]).toBe('dev-001');
      expect(callArgs[2]).toHaveProperty('metric');
      expect(callArgs[2]).toHaveProperty('score');
      expect(callArgs[2]).toHaveProperty('lastSeenAt');
    });

    it('emits event with correct payload structure', async () => {
      mockPrisma.deviceMetric.create.mockResolvedValue(mockMetric);
      mockPrisma.device.update.mockResolvedValue(mockDevice);
      mockPrisma.deviceHealthScore.create.mockResolvedValue(mockScore);

      const mockGateway = {
        broadcastMetrics: jest.fn(),
        broadcastAlert: jest.fn(),
      };

      const module = await Test.createTestingModule({
        imports: [QueueModule],
        controllers: [DevicesController],
        providers: [
          DevicesService,
          ScoringService,
          DeviceTokenGuard,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: DevicesGateway, useValue: mockGateway },
          { provide: AlertEvaluationService, useValue: { evaluateMetrics: jest.fn().mockResolvedValue([]) } },
          { provide: AlertsGateway, useValue: { broadcastAlert: jest.fn() } },
          { provide: EnrollmentService, useValue: { validateToken: jest.fn() } },
        ],
      })
        .overrideProvider(QueueService)
        .useClass(MockQueueService)
        .compile();

      const testController = module.get<DevicesController>(DevicesController);

      const req = { device: mockDevice, orgId: 'org-001' } as any;
      const dto = {
        timestamp: new Date().toISOString(),
        cpu: { usage: 45.2 },
        memory: { total: 16000000000, used: 8000000000, percent: 50 },
      };

      await testController.ingestMetrics(req, dto);

      const callArgs = mockGateway.broadcastMetrics.mock.calls[0];
      expect(callArgs[0]).toBe('org-001');
      expect(callArgs[1]).toBe('dev-001');
      const payload = callArgs[2];

      expect(payload.lastSeenAt).toBeDefined();
      expect(typeof payload.lastSeenAt).toBe('string');
      expect(payload.metric).toBeDefined();
      expect(payload.score).toBeDefined();
    });

    it('does not emit event when storage fails', async () => {
      mockPrisma.deviceMetric.create.mockRejectedValue(new Error('DB error'));

      const mockGateway = {
        broadcastMetrics: jest.fn(),
        broadcastAlert: jest.fn(),
      };

      const module = await Test.createTestingModule({
        imports: [QueueModule],
        controllers: [DevicesController],
        providers: [
          DevicesService,
          ScoringService,
          DeviceTokenGuard,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: DevicesGateway, useValue: mockGateway },
          { provide: AlertEvaluationService, useValue: { evaluateMetrics: jest.fn().mockResolvedValue([]) } },
          { provide: AlertsGateway, useValue: { broadcastAlert: jest.fn() } },
          { provide: EnrollmentService, useValue: { validateToken: jest.fn() } },
        ],
      })
        .overrideProvider(QueueService)
        .useClass(MockQueueService)
        .compile();

      const testController = module.get<DevicesController>(DevicesController);

      const req = { device: mockDevice, orgId: 'org-001' } as any;
      const dto = {
        timestamp: new Date().toISOString(),
        cpu: { usage: 45.2 },
        memory: { total: 16000000000, used: 8000000000, percent: 50 },
      };

      await expect(testController.ingestMetrics(req, dto)).rejects.toThrow();
      expect(mockGateway.broadcastMetrics).not.toHaveBeenCalled();
    });

    it('emits event only to correct organization room', async () => {
      mockPrisma.deviceMetric.create.mockResolvedValue(mockMetric);
      mockPrisma.device.update.mockResolvedValue(mockDevice);
      mockPrisma.deviceHealthScore.create.mockResolvedValue(mockScore);

      const mockGateway = {
        broadcastMetrics: jest.fn(),
        broadcastAlert: jest.fn(),
      };

      const module = await Test.createTestingModule({
        imports: [QueueModule],
        controllers: [DevicesController],
        providers: [
          DevicesService,
          ScoringService,
          DeviceTokenGuard,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: DevicesGateway, useValue: mockGateway },
          { provide: AlertEvaluationService, useValue: { evaluateMetrics: jest.fn().mockResolvedValue([]) } },
          { provide: AlertsGateway, useValue: { broadcastAlert: jest.fn() } },
          { provide: EnrollmentService, useValue: { validateToken: jest.fn() } },
        ],
      })
        .overrideProvider(QueueService)
        .useClass(MockQueueService)
        .compile();

      const testController = module.get<DevicesController>(DevicesController);

      const req = { device: mockDevice, orgId: 'org-001' } as any;
      const dto = {
        timestamp: new Date().toISOString(),
        cpu: { usage: 45.2 },
        memory: { total: 16000000000, used: 8000000000, percent: 50 },
      };

      await testController.ingestMetrics(req, dto);

      const callArgs = mockGateway.broadcastMetrics.mock.calls[0];
      expect(callArgs[0]).toBe('org-001');
    });

    it('payload does not contain secrets or tokens', async () => {
      mockPrisma.deviceMetric.create.mockResolvedValue(mockMetric);
      mockPrisma.device.update.mockResolvedValue(mockDevice);
      mockPrisma.deviceHealthScore.create.mockResolvedValue(mockScore);

      const mockGateway = {
        broadcastMetrics: jest.fn(),
        broadcastAlert: jest.fn(),
      };

      const module = await Test.createTestingModule({
        imports: [QueueModule],
        controllers: [DevicesController],
        providers: [
          DevicesService,
          ScoringService,
          DeviceTokenGuard,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: DevicesGateway, useValue: mockGateway },
          { provide: AlertEvaluationService, useValue: { evaluateMetrics: jest.fn().mockResolvedValue([]) } },
          { provide: AlertsGateway, useValue: { broadcastAlert: jest.fn() } },
          { provide: EnrollmentService, useValue: { validateToken: jest.fn() } },
        ],
      })
        .overrideProvider(QueueService)
        .useClass(MockQueueService)
        .compile();

      const testController = module.get<DevicesController>(DevicesController);

      const req = { device: mockDevice, orgId: 'org-001' } as any;
      const dto = {
        timestamp: new Date().toISOString(),
        cpu: { usage: 45.2 },
        memory: { total: 16000000000, used: 8000000000, percent: 50 },
      };

      await testController.ingestMetrics(req, dto);

      const callArgs = mockGateway.broadcastMetrics.mock.calls[0];
      const payloadStr = JSON.stringify(callArgs[2], (_, v) => (typeof v === 'bigint' ? Number(v) : v));
      expect(payloadStr).not.toContain('deviceToken');
      expect(payloadStr).not.toContain('deviceTokenHash');
      expect(payloadStr).not.toContain('enrollmentToken');
      expect(payloadStr).not.toContain('identityFingerprint');
    });
  });

  describe('listDevices', () => {
    it('returns devices for authenticated organization', async () => {
      mockPrisma.device.findMany.mockResolvedValue([mockDevice]);

      const req = { user: { orgId: 'org-001' } } as any;
      const result = await controller.listDevices(req);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('dev-001');
    });

    it('returns empty array when no orgId', async () => {
      const req = { user: {} } as any;
      const result = await controller.listDevices(req);
      expect(result).toEqual([]);
    });
  });

  describe('cross-organization isolation', () => {
    it('findById scopes to organization', async () => {
      mockPrisma.device.findFirst.mockResolvedValue(null);

      const req = { user: { orgId: 'org-999' } } as any;
      await expect(controller.getDevice(req, 'dev-001')).rejects.toThrow();
    });
  });

  describe('CPU system information contract', () => {
    it('registration maps cpuModel/cpuCores/cpuLogical on new device', async () => {
      mockPrisma.device.findFirst.mockResolvedValue(null);
      mockPrisma.device.count.mockResolvedValue(0);
      mockPrisma.organization.findUnique.mockResolvedValue({ plan: 'Free' });
      mockPrisma.device.create.mockResolvedValue(mockDevice);

      const req = { headers: {} } as any;
      const dto = {
        name: 'test-host',
        hostname: 'test-host',
        os: 'Linux',
        osVersion: '6.8.0',
        cpuModel: 'Intel(R) Core(TM) i5-8250U',
        cpuCores: 4,
        cpuLogical: 8,
        ramTotal: 17179869184,
        diskTotal: 512000000000,
        isLaptop: false,
        identityFingerprint: 'sha256:abc123def456',
        installationId: 'inst-001',
        agentVersion: '1.0.0',
        enrollmentToken: mockEnrollmentToken,
      };

      await controller.registerPublic(req, dto);
      const createCall = mockPrisma.device.create.mock.calls[0][0];
      expect(createCall.data.cpuModel).toBe('Intel(R) Core(TM) i5-8250U');
      expect(createCall.data.cpuCores).toBe(4);
      expect(createCall.data.cpuLogical).toBe(8);
    });

    it('enriches existing device CPU fields without creating duplicate', async () => {
      const deviceWithoutCpu = { ...mockDevice, cpuModel: null, cpuCores: null, cpuLogical: null };
      mockPrisma.device.findFirst.mockResolvedValue(deviceWithoutCpu);
      mockPrisma.device.count.mockResolvedValue(0);
      mockPrisma.organization.findUnique.mockResolvedValue({ plan: 'Free' });
      mockPrisma.device.update.mockResolvedValue(deviceWithoutCpu);
      mockPrisma.credentialRotationEvent.create.mockResolvedValue({});
      mockPrisma.device.findUnique.mockResolvedValue({
        ...deviceWithoutCpu,
        cpuModel: 'AMD Ryzen 5 3600',
        cpuCores: 6,
        cpuLogical: 12,
      });

      const req = { headers: {} } as any;
      const dto = {
        name: 'test-host',
        hostname: 'test-host',
        cpuModel: 'AMD Ryzen 5 3600',
        cpuCores: 6,
        cpuLogical: 12,
        identityFingerprint: 'sha256:abc123def456',
        installationId: 'inst-001',
        enrollmentToken: mockEnrollmentToken,
      };

      const result = await controller.registerPublic(req, dto) as any;
      expect(result.duplicate).toBe(true);
      expect(mockPrisma.device.create).not.toHaveBeenCalled();

      const updateCalls = mockPrisma.device.update.mock.calls;
      const enrichCall = updateCalls.find(
        (call: any) => call[0].data.cpuModel !== undefined,
      );
      expect(enrichCall).toBeDefined();
      expect(enrichCall[0].data.cpuModel).toBe('AMD Ryzen 5 3600');
      expect(enrichCall[0].data.cpuCores).toBe(6);
      expect(enrichCall[0].data.cpuLogical).toBe(12);
    });

    it('missing incoming CPU fields do not erase existing data', async () => {
      const deviceWithCpu = { ...mockDevice, cpuModel: 'Existing CPU', cpuCores: 8, cpuLogical: 16 };
      mockPrisma.device.findFirst.mockResolvedValue(deviceWithCpu);
      mockPrisma.device.count.mockResolvedValue(0);
      mockPrisma.organization.findUnique.mockResolvedValue({ plan: 'Free' });
      mockPrisma.device.update.mockResolvedValue(deviceWithCpu);
      mockPrisma.credentialRotationEvent.create.mockResolvedValue({});
      mockPrisma.device.findUnique.mockResolvedValue(deviceWithCpu);

      const req = { headers: {} } as any;
      const dto = {
        name: 'test-host',
        hostname: 'test-host',
        identityFingerprint: 'sha256:abc123def456',
        installationId: 'inst-001',
        enrollmentToken: mockEnrollmentToken,
      };

      await controller.registerPublic(req, dto);

      const updateCalls = mockPrisma.device.update.mock.calls;
      const enrichCall = updateCalls.find(
        (call: any) => call[0].data.cpuModel !== undefined,
      );
      expect(enrichCall).toBeUndefined();
    });

    it('sanitizeDevice preserves CPU fields', async () => {
      mockPrisma.device.findFirst.mockResolvedValue(mockDevice);

      const req = { user: { orgId: 'org-001' } } as any;
      const result = await controller.getDevice(req, 'dev-001');
      expect(result.cpuModel).toBe('Intel Core i7');
      expect(result.cpuCores).toBe(8);
      expect(result.cpuLogical).toBe(16);
      expect(result.deviceToken).toBeUndefined();
      expect(result.deviceTokenHash).toBeUndefined();
    });

    it('listDevices includes CPU fields', async () => {
      mockPrisma.device.findMany.mockResolvedValue([mockDevice]);

      const req = { user: { orgId: 'org-001' } } as any;
      const result = await controller.listDevices(req);
      expect(result[0].cpuModel).toBe('Intel Core i7');
      expect(result[0].cpuCores).toBe(8);
      expect(result[0].cpuLogical).toBe(16);
    });

    it('lastSeenAt is not changed by duplicate registration enrichment', async () => {
      const originalLastSeen = new Date('2025-01-01T00:00:00Z');
      const deviceOld = { ...mockDevice, lastSeenAt: originalLastSeen };
      mockPrisma.device.findFirst.mockResolvedValue(deviceOld);
      mockPrisma.device.count.mockResolvedValue(0);
      mockPrisma.organization.findUnique.mockResolvedValue({ plan: 'Free' });
      mockPrisma.device.update.mockResolvedValue(deviceOld);
      mockPrisma.credentialRotationEvent.create.mockResolvedValue({});
      mockPrisma.device.findUnique.mockResolvedValue(deviceOld);

      const req = { headers: {} } as any;
      const dto = {
        name: 'test-host',
        hostname: 'test-host',
        cpuModel: 'New CPU',
        cpuCores: 4,
        cpuLogical: 8,
        identityFingerprint: 'sha256:abc123def456',
        installationId: 'inst-001',
        enrollmentToken: mockEnrollmentToken,
      };

      await controller.registerPublic(req, dto);

      const updateCalls = mockPrisma.device.update.mock.calls;
      const enrichCall = updateCalls.find(
        (call: any) => call[0].data.cpuModel !== undefined,
      );
      expect(enrichCall).toBeDefined();
      expect(enrichCall[0].data.lastSeenAt).toBeUndefined();
    });

    it('empty cpuModel string is stored as null on new device', async () => {
      mockPrisma.device.findFirst.mockResolvedValue(null);
      mockPrisma.device.count.mockResolvedValue(0);
      mockPrisma.organization.findUnique.mockResolvedValue({ plan: 'Free' });
      mockPrisma.device.create.mockResolvedValue(mockDevice);

      const req = { headers: {} } as any;
      const dto = {
        name: 'test-host',
        hostname: 'test-host',
        cpuModel: '',
        cpuCores: 2,
        cpuLogical: 4,
        ramTotal: 8589934592,
        diskTotal: 256000000000,
        isLaptop: false,
        identityFingerprint: 'sha256:abc123def456',
        installationId: 'inst-001',
        agentVersion: '1.0.0',
        enrollmentToken: mockEnrollmentToken,
      };

      await controller.registerPublic(req, dto);
      const createCall = mockPrisma.device.create.mock.calls[0][0];
      expect(createCall.data.cpuModel).toBeNull();
    });

    it('whitespace-only cpuModel string is stored as null on new device', async () => {
      mockPrisma.device.findFirst.mockResolvedValue(null);
      mockPrisma.device.count.mockResolvedValue(0);
      mockPrisma.organization.findUnique.mockResolvedValue({ plan: 'Free' });
      mockPrisma.device.create.mockResolvedValue(mockDevice);

      const req = { headers: {} } as any;
      const dto = {
        name: 'test-host',
        hostname: 'test-host',
        cpuModel: '   ',
        cpuCores: 2,
        cpuLogical: 4,
        ramTotal: 8589934592,
        diskTotal: 256000000000,
        isLaptop: false,
        identityFingerprint: 'sha256:abc123def456',
        installationId: 'inst-001',
        agentVersion: '1.0.0',
        enrollmentToken: mockEnrollmentToken,
      };

      await controller.registerPublic(req, dto);
      const createCall = mockPrisma.device.create.mock.calls[0][0];
      expect(createCall.data.cpuModel).toBeNull();
    });

    it('empty incoming cpuModel does not erase existing value on enrichment', async () => {
      const deviceWithCpu = { ...mockDevice, cpuModel: 'Existing CPU Model' };
      mockPrisma.device.findFirst.mockResolvedValue(deviceWithCpu);
      mockPrisma.device.count.mockResolvedValue(0);
      mockPrisma.organization.findUnique.mockResolvedValue({ plan: 'Free' });
      mockPrisma.device.update.mockResolvedValue(deviceWithCpu);
      mockPrisma.credentialRotationEvent.create.mockResolvedValue({});
      mockPrisma.device.findUnique.mockResolvedValue(deviceWithCpu);

      const req = { headers: {} } as any;
      const dto = {
        name: 'test-host',
        hostname: 'test-host',
        cpuModel: '',
        cpuCores: 2,
        cpuLogical: 4,
        identityFingerprint: 'sha256:abc123def456',
        installationId: 'inst-001',
        enrollmentToken: mockEnrollmentToken,
      };

      await controller.registerPublic(req, dto);
      const updateCalls = mockPrisma.device.update.mock.calls;
      const cpuUpdate = updateCalls.find(
        (call: any) => call[0].data.cpuModel !== undefined,
      );
      expect(cpuUpdate).toBeUndefined();
    });

    it('cpuModel with surrounding whitespace is trimmed on enrichment', async () => {
      const deviceWithoutCpu = { ...mockDevice, cpuModel: null };
      mockPrisma.device.findFirst.mockResolvedValue(deviceWithoutCpu);
      mockPrisma.device.count.mockResolvedValue(0);
      mockPrisma.organization.findUnique.mockResolvedValue({ plan: 'Free' });
      mockPrisma.device.update.mockResolvedValue(deviceWithoutCpu);
      mockPrisma.credentialRotationEvent.create.mockResolvedValue({});
      mockPrisma.device.findUnique.mockResolvedValue({
        ...deviceWithoutCpu,
        cpuModel: 'AMD Ryzen 5',
      });

      const req = { headers: {} } as any;
      const dto = {
        name: 'test-host',
        hostname: 'test-host',
        cpuModel: '  AMD Ryzen 5  ',
        cpuCores: 6,
        cpuLogical: 12,
        identityFingerprint: 'sha256:abc123def456',
        installationId: 'inst-001',
        enrollmentToken: mockEnrollmentToken,
      };

      await controller.registerPublic(req, dto);
      const updateCalls = mockPrisma.device.update.mock.calls;
      const enrichCall = updateCalls.find(
        (call: any) => call[0].data.cpuModel !== undefined,
      );
      expect(enrichCall).toBeDefined();
      expect(enrichCall[0].data.cpuModel).toBe('AMD Ryzen 5');
    });
  });
});
