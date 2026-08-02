import { Test, TestingModule } from '@nestjs/testing';
import { RemoteSupportService } from './remote-support.service';
import { PrismaService } from '../prisma/prisma.service';
import { RemoteSupportGateway } from './remote-support.gateway';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('RemoteSupportService - Device Ownership Validation', () => {
  let service: RemoteSupportService;
  let mockPrisma: any;
  let mockGateway: any;

  const mockDevice = {
    id: 'dev-001',
    orgId: 'org-001',
    name: 'Test Device',
    hostname: 'test-host',
  };

  const mockSession = {
    id: 'sess-001',
    orgId: 'org-001',
    deviceId: 'dev-001',
    technicianId: 'tech-001',
    status: 'pending',
    consentGranted: false,
  };

  beforeEach(async () => {
    mockPrisma = {
      device: {
        findFirst: jest.fn(),
      },
      remoteSession: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };

    mockGateway = {
      broadcastSessionUpdate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemoteSupportService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RemoteSupportGateway, useValue: mockGateway },
      ],
    }).compile();

    service = module.get<RemoteSupportService>(RemoteSupportService);
  });

  describe('createSession - device ownership', () => {
    it('should reject if device does not belong to the organization', async () => {
      mockPrisma.device.findFirst.mockResolvedValue(null);

      await expect(
        service.createSession('org-001', 'tech-001', 'dev-foreign'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject if device belongs to a different organization', async () => {
      mockPrisma.device.findFirst.mockResolvedValue(null);

      await expect(
        service.createSession('org-001', 'tech-001', 'dev-001'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow session creation when device belongs to the organization', async () => {
      mockPrisma.device.findFirst.mockResolvedValue(mockDevice);
      mockPrisma.remoteSession.findFirst.mockResolvedValue(null);
      mockPrisma.remoteSession.create.mockResolvedValue({
        ...mockSession,
        status: 'pending',
      });

      const result = await service.createSession('org-001', 'tech-001', 'dev-001');

      expect(result).toBeDefined();
      expect(result.orgId).toBe('org-001');
      expect(mockPrisma.device.findFirst).toHaveBeenCalledWith({
        where: { id: 'dev-001', orgId: 'org-001' },
      });
    });

    it('should reject if device already has an active session', async () => {
      mockPrisma.device.findFirst.mockResolvedValue(mockDevice);
      mockPrisma.remoteSession.findFirst.mockResolvedValue({
        ...mockSession,
        status: 'active',
      });

      await expect(
        service.createSession('org-001', 'tech-001', 'dev-001'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('session ownership', () => {
    it('getSession should reject if session does not belong to org', async () => {
      mockPrisma.remoteSession.findFirst.mockResolvedValue(null);

      await expect(
        service.getSession('org-001', 'sess-foreign'),
      ).rejects.toThrow(NotFoundException);
    });

    it('getSession should return session when it belongs to the org', async () => {
      mockPrisma.remoteSession.findFirst.mockResolvedValue(mockSession);

      const result = await service.getSession('org-001', 'sess-001');
      expect(result.id).toBe('sess-001');
      expect(result.orgId).toBe('org-001');
    });

    it('endSession should reject if session does not belong to org', async () => {
      mockPrisma.remoteSession.findFirst.mockResolvedValue(null);

      await expect(
        service.endSession('org-001', 'sess-foreign'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPendingForDevice - org scoped', () => {
    it('should query by orgId and deviceId with pending status', async () => {
      mockPrisma.remoteSession.findMany.mockResolvedValue([
        { id: 'sess-001', deviceId: 'dev-001', technicianId: 'tech-001' },
      ]);

      const result = await service.getPendingForDevice('org-001', 'dev-001');
      expect(result).toHaveLength(1);
      expect(mockPrisma.remoteSession.findMany).toHaveBeenCalledWith({
        where: { orgId: 'org-001', deviceId: 'dev-001', status: 'pending', consentGranted: false },
        select: { id: true, deviceId: true, technicianId: true },
      });
    });
  });

  describe('handleConsent - session validation', () => {
    it('should reject consent for non-existent session', async () => {
      mockPrisma.remoteSession.findFirst.mockResolvedValue(null);

      await expect(
        service.handleConsent('org-001', {
          sessionId: 'sess-foreign',
          deviceId: 'dev-001',
          granted: true,
          method: 'agent_prompt',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.remoteSession.findFirst).toHaveBeenCalledWith({
        where: { id: 'sess-foreign', deviceId: 'dev-001', orgId: 'org-001' },
      });
    });

    it('should reject consent for non-pending session', async () => {
      mockPrisma.remoteSession.findFirst.mockResolvedValue({
        ...mockSession,
        status: 'active',
      });

      await expect(
        service.handleConsent('org-001', {
          sessionId: 'sess-001',
          deviceId: 'dev-001',
          granted: true,
          method: 'agent_prompt',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should scope session lookup by orgId', async () => {
      mockPrisma.remoteSession.findFirst.mockResolvedValue(null);

      try {
        await service.handleConsent('org-999', {
          sessionId: 'sess-001',
          deviceId: 'dev-001',
          granted: true,
          method: 'agent_prompt',
        });
      } catch {
        // Expected: NotFoundException because mock returns null
      }

      expect(mockPrisma.remoteSession.findFirst).toHaveBeenCalledWith({
        where: { id: 'sess-001', deviceId: 'dev-001', orgId: 'org-999' },
      });
    });
  });

  describe('updateAgentStatus - org scoped', () => {
    it('should scope session lookup by orgId', async () => {
      mockPrisma.remoteSession.findFirst.mockResolvedValue(null);

      try {
        await service.updateAgentStatus('org-001', {
          sessionId: 'sess-001',
          status: 'active',
          deviceId: 'dev-001',
        });
      } catch {
        // Expected: NotFoundException because mock returns null
      }

      expect(mockPrisma.remoteSession.findFirst).toHaveBeenCalledWith({
        where: { id: 'sess-001', deviceId: 'dev-001', orgId: 'org-001' },
      });
    });
  });
});
