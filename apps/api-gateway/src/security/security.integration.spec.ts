import { Test, TestingModule } from '@nestjs/testing';
import { SecurityController } from './security.controller';
import { SecurityService } from './security.service';
import { SecurityScoringService } from './services/security-scoring.service';
import { SecurityReportingService } from './services/security-reporting.service';
import { PrismaService } from '../prisma/prisma.service';

describe('Security Integration', () => {
  let controller: SecurityController;
  let mockPrisma: any;

  const mockDevice = {
    id: 'dev-1',
    orgId: 'org-1',
    name: 'Test Device',
    hostname: 'test-pc',
    deviceToken: 'tok-123',
  };

  beforeEach(async () => {
    mockPrisma = {
      device: {
        findUnique: jest.fn().mockResolvedValue(mockDevice),
        findFirst: jest.fn().mockResolvedValue(mockDevice),
      },
      securityScan: {
        create: jest.fn().mockImplementation((data) => ({
          id: 'scan-1',
          ...data.data,
        })),
        findFirst: jest.fn().mockResolvedValue({
          id: 'scan-1',
          status: 'completed',
          startedAt: new Date(),
          completedAt: new Date(),
          score: {
            id: 'score-1',
            securityScore: 62,
            riskLevel: 'medium',
            totalFindings: 3,
            criticalCount: 0,
            highCount: 2,
            mediumCount: 1,
            lowCount: 0,
          },
          findings: [
            { id: 'f-1', category: 'firewall', finding: 'Firewall inactive', severity: 'high', status: 'open', remediation: 'Enable firewall', details: null, remediatedAt: null, createdAt: new Date(), scanId: 'scan-1', orgId: 'org-1', deviceId: 'dev-1' },
            { id: 'f-2', category: 'updates', finding: '3 pending updates', severity: 'medium', status: 'open', remediation: 'Run updates', details: null, remediatedAt: null, createdAt: new Date(), scanId: 'scan-1', orgId: 'org-1', deviceId: 'dev-1' },
          ],
        }),
        findMany: jest.fn().mockResolvedValue([
          { id: 'scan-1', status: 'completed', startedAt: new Date(), completedAt: new Date(), _count: { findings: 3 }, score: { securityScore: 62, riskLevel: 'medium' } },
        ]),
      },
      securityFinding: {
        create: jest.fn().mockImplementation((data) => ({ id: 'f-new', ...data.data })),
        findFirst: jest.fn().mockResolvedValue({
          id: 'f-1',
          category: 'firewall',
          finding: 'Firewall inactive',
          severity: 'high',
          status: 'open',
          remediation: 'Enable firewall',
          orgId: 'org-1',
        }),
        update: jest.fn().mockImplementation(({ where, data }) => ({
          id: where.id,
          status: data.status,
          remediatedAt: data.remediatedAt,
        })),
      },
      securityScore: {
        create: jest.fn().mockImplementation((data) => ({ id: 'score-1', ...data.data })),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SecurityController],
      providers: [
        SecurityService,
        SecurityScoringService,
        SecurityReportingService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    controller = module.get<SecurityController>(SecurityController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('submitFindings', () => {
    it('creates scan and returns score', async () => {
      const result = await controller.submitFindings({
        deviceToken: 'tok-123',
        findings: [
          { category: 'firewall', finding: 'Firewall inactive', severity: 'high', remediation: 'Enable firewall' },
          { category: 'updates', finding: '3 pending updates', severity: 'medium', remediation: 'Run updates' },
        ],
      });

      expect(result).toBeDefined();
      expect(result.scanId).toBe('scan-1');
      expect(result.securityScore).toBe(77);
      expect(result.riskLevel).toBe('low');
      expect(result.totalFindings).toBe(2);
    });

    it('rejects invalid device token', async () => {
      mockPrisma.device.findUnique.mockResolvedValue(null);

      const result = await controller.submitFindings({
        deviceToken: 'bad-token',
        findings: [],
      });

      expect(result).toEqual({ error: 'Invalid device token' });
    });
  });

  describe('getLatestScan', () => {
    it('returns latest scan with findings and score', async () => {
      const req = { orgId: 'org-1' } as any;
      const result = await controller.getLatestScan('dev-1', req);

      expect(result).toBeDefined();
      expect(result!.status).toBe('completed');
      expect(result!.findings).toHaveLength(2);
      expect(result!.score).toBeDefined();
      expect(result!.score!.securityScore).toBe(62);
    });
  });

  describe('executiveSummary', () => {
    it('returns formatted summary with non-technical text', async () => {
      const req = { orgId: 'org-1' } as any;
      const result = await controller.executiveSummary('dev-1', req);

      expect(result).toBeDefined();
      expect(result.summaryText).toBeDefined();
      expect(result.summaryText).toContain('Test Device');
      expect(result.topFindings).toHaveLength(2);
      expect(result.recommendations).toBeDefined();
    });
  });
});
