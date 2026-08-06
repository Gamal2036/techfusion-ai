import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { RemoteSupportController } from './remote-support.controller';
import { RemoteSupportService } from './remote-support.service';
import { DevicesService } from '../devices/devices.service';
import { RemoteSupportGateway } from './remote-support.gateway';
import { PrismaService } from '../prisma/prisma.service';

describe('RemoteSupportController', () => {
  let controller: RemoteSupportController;
  let mockService: any;
  let mockDevicesService: any;

  const mockDevice = {
    id: 'dev-001',
    orgId: 'org-001',
    deviceToken: 'tok-test-123',
  };

  beforeEach(async () => {
    mockDevicesService = {
      findByToken: jest.fn(),
    };

    mockService = {
      createSession: jest.fn(),
      listSessions: jest.fn(),
      getSession: jest.fn(),
      endSession: jest.fn(),
      getPendingForDevice: jest.fn(),
      handleConsent: jest.fn(),
      updateAgentStatus: jest.fn(),
      getAuditLogs: jest.fn(),
      logAction: jest.fn(),
      getRecordings: jest.fn(),
      getSessionRecordings: jest.fn(),
      saveRecording: jest.fn(),
      updateRecording: jest.fn(),
    };

    const mockGateway = {
      broadcastSessionUpdate: jest.fn(),
    };

    const mockPrisma = {
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

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RemoteSupportController],
      providers: [
        { provide: RemoteSupportService, useValue: mockService },
        { provide: DevicesService, useValue: mockDevicesService },
        { provide: RemoteSupportGateway, useValue: mockGateway },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    controller = module.get<RemoteSupportController>(RemoteSupportController);
  });

  describe('getPendingForDevice', () => {
    it('returns pending sessions after verifying device token via hashed lookup', async () => {
      mockDevicesService.findByToken.mockResolvedValue(mockDevice);
      mockService.getPendingForDevice.mockResolvedValue([
        { id: 'sess-001', deviceId: 'dev-001', technicianId: 'tech-001' },
      ]);

      const req = {
        headers: { authorization: 'Bearer tok-test-123' },
        query: { deviceId: 'dev-001' },
      } as any;

      const result = await controller.getPendingForDevice(req);
      expect(Array.isArray(result)).toBe(true);
      expect((result as any[]).length).toBe(1);
      expect(mockDevicesService.findByToken).toHaveBeenCalledWith('tok-test-123');
      expect(mockService.getPendingForDevice).toHaveBeenCalledWith('org-001', 'dev-001');
    });

    it('throws UnauthorizedException when token does not match any device', async () => {
      mockDevicesService.findByToken.mockResolvedValue(null);

      const req = {
        headers: { authorization: 'Bearer fake-token' },
        query: { deviceId: 'dev-001' },
      } as any;

      await expect(controller.getPendingForDevice(req)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when device id does not match claimed deviceId', async () => {
      mockDevicesService.findByToken.mockResolvedValue({ ...mockDevice, id: 'dev-other' });

      const req = {
        headers: { authorization: 'Bearer tok-test-123' },
        query: { deviceId: 'dev-001' },
      } as any;

      await expect(controller.getPendingForDevice(req)).rejects.toThrow(UnauthorizedException);
    });

    it('returns empty when no token', async () => {
      const req = {
        headers: {},
        query: { deviceId: 'dev-001' },
      } as any;

      const result = await controller.getPendingForDevice(req);
      expect(result).toEqual([]);
    });

    it('returns empty when no deviceId', async () => {
      const req = {
        headers: { authorization: 'Bearer tok-test-123' },
        query: {},
      } as any;

      const result = await controller.getPendingForDevice(req);
      expect(result).toEqual([]);
    });
  });

  describe('handleConsent', () => {
    it('processes consent after verifying device token', async () => {
      mockDevicesService.findByToken.mockResolvedValue(mockDevice);
      mockService.handleConsent.mockResolvedValue({
        status: 'ok',
        sessionId: 'sess-001',
        granted: true,
      });

      const req = {
        headers: { authorization: 'Bearer tok-test-123' },
      } as any;

      const body = {
        sessionId: 'sess-001',
        deviceId: 'dev-001',
        granted: true,
        method: 'agent_prompt',
      };

      const result = await controller.handleConsent(req, body);
      expect(result).not.toBeNull();
      expect(result!.status).toBe('ok');
      expect(result!.granted).toBe(true);
      expect(mockDevicesService.findByToken).toHaveBeenCalledWith('tok-test-123');
      expect(mockService.handleConsent).toHaveBeenCalledWith('org-001', body);
    });

    it('throws UnauthorizedException when token is invalid', async () => {
      mockDevicesService.findByToken.mockResolvedValue(null);

      const req = {
        headers: { authorization: 'Bearer bad-token' },
      } as any;

      const body = {
        sessionId: 'sess-001',
        deviceId: 'dev-001',
        granted: true,
        method: 'agent_prompt',
      };

      await expect(controller.handleConsent(req, body)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when device id mismatch', async () => {
      mockDevicesService.findByToken.mockResolvedValue({ ...mockDevice, id: 'dev-wrong' });

      const req = {
        headers: { authorization: 'Bearer tok-test-123' },
      } as any;

      const body = {
        sessionId: 'sess-001',
        deviceId: 'dev-001',
        granted: true,
        method: 'agent_prompt',
      };

      await expect(controller.handleConsent(req, body)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when no token', async () => {
      const req = { headers: {} } as any;
      const body = {
        sessionId: 'sess-001',
        deviceId: 'dev-001',
        granted: true,
        method: 'agent_prompt',
      };

      await expect(controller.handleConsent(req, body)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('updateAgentStatus', () => {
    it('updates session status after verifying device token', async () => {
      mockDevicesService.findByToken.mockResolvedValue(mockDevice);
      mockService.updateAgentStatus.mockResolvedValue({ status: 'ok' });

      const req = {
        headers: { authorization: 'Bearer tok-test-123' },
      } as any;

      const body = {
        sessionId: 'sess-001',
        status: 'active',
        deviceId: 'dev-001',
      };

      const result = await controller.updateAgentStatus(req, body);
      expect(result).not.toBeNull();
      expect(result!.status).toBe('ok');
      expect(mockDevicesService.findByToken).toHaveBeenCalledWith('tok-test-123');
      expect(mockService.updateAgentStatus).toHaveBeenCalledWith('org-001', body);
    });

    it('throws UnauthorizedException when token is invalid', async () => {
      mockDevicesService.findByToken.mockResolvedValue(null);

      const req = {
        headers: { authorization: 'Bearer bad-token' },
      } as any;

      const body = {
        sessionId: 'sess-001',
        status: 'active',
        deviceId: 'dev-001',
      };

      await expect(controller.updateAgentStatus(req, body)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when device id mismatch', async () => {
      mockDevicesService.findByToken.mockResolvedValue({ ...mockDevice, id: 'dev-other' });

      const req = {
        headers: { authorization: 'Bearer tok-test-123' },
      } as any;

      const body = {
        sessionId: 'sess-001',
        status: 'active',
        deviceId: 'dev-001',
      };

      await expect(controller.updateAgentStatus(req, body)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when no token', async () => {
      const req = { headers: {} } as any;
      const body = {
        sessionId: 'sess-001',
        status: 'active',
        deviceId: 'dev-001',
      };

      await expect(controller.updateAgentStatus(req, body)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('createSession', () => {
    it('creates a remote session for authenticated technician', async () => {
      mockService.createSession.mockResolvedValue({
        id: 'sess-002',
        orgId: 'org-001',
        deviceId: 'dev-001',
        technicianId: 'tech-001',
        status: 'pending',
      });

      const req = {
        user: { orgId: 'org-001', sub: 'tech-001' },
      } as any;

      const body = { deviceId: 'dev-001' };
      const result = await controller.createSession(req, body);
      expect(result).not.toBeNull();
      expect(result!.status).toBe('pending');
    });

    it('throws when no auth', async () => {
      const req = { user: {} } as any;
      const body = { deviceId: 'dev-001' };
      await expect(controller.createSession(req, body)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
