import { Test, TestingModule } from '@nestjs/testing';
import { RemoteSupportGateway } from './remote-support.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { Server, Socket } from 'socket.io';

describe('RemoteSupportGateway', () => {
  let gateway: RemoteSupportGateway;
  let mockPrisma: any;
  let mockServer: any;

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
      remoteSession: {
        findFirst: jest.fn().mockResolvedValue(mockSession),
      },
    };

    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemoteSupportGateway,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    gateway = module.get<RemoteSupportGateway>(RemoteSupportGateway);
    gateway.server = mockServer;
  });

  describe('organization isolation', () => {
    it('should reject connection when session does not belong to org', async () => {
      mockPrisma.remoteSession.findFirst.mockResolvedValue(null);

      const client = {
        id: 'socket-001',
        data: { user: { userId: 'user-001', orgId: 'org-001', role: 'Technician' } },
        handshake: { query: { sessionId: 'sess-foreign', role: 'technician' } },
        join: jest.fn(),
        disconnect: jest.fn(),
      } as any;

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(client.join).not.toHaveBeenCalled();
    });

    it('should accept connection when session belongs to org', async () => {
      const client = {
        id: 'socket-002',
        data: { user: { userId: 'user-001', orgId: 'org-001', role: 'Technician' } },
        handshake: { query: { sessionId: 'sess-001', role: 'technician' } },
        join: jest.fn(),
        disconnect: jest.fn(),
      } as any;

      await gateway.handleConnection(client);

      expect(client.disconnect).not.toHaveBeenCalledWith(true);
      expect(client.join).toHaveBeenCalledWith('session:sess-001');
      expect(client.join).toHaveBeenCalledWith('org:org-001');
    });

    it('should reject when no user data', async () => {
      const client = {
        id: 'socket-003',
        data: {},
        handshake: { query: { sessionId: 'sess-001', role: 'technician' } },
        join: jest.fn(),
        disconnect: jest.fn(),
      } as any;

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('should reject when sessionId is missing', async () => {
      const client = {
        id: 'socket-004',
        data: { user: { userId: 'user-001', orgId: 'org-001', role: 'Technician' } },
        handshake: { query: { role: 'technician' } },
        join: jest.fn(),
        disconnect: jest.fn(),
      } as any;

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('should reject when role is invalid', async () => {
      const client = {
        id: 'socket-005',
        data: { user: { userId: 'user-001', orgId: 'org-001', role: 'Technician' } },
        handshake: { query: { sessionId: 'sess-001', role: 'admin' } },
        join: jest.fn(),
        disconnect: jest.fn(),
      } as any;

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalledWith(true);
    });
  });

  describe('session ownership validation', () => {
    it('should query database to validate session belongs to org', async () => {
      const client = {
        id: 'socket-006',
        data: { user: { userId: 'user-001', orgId: 'org-001', role: 'Technician' } },
        handshake: { query: { sessionId: 'sess-001', role: 'technician' } },
        join: jest.fn(),
        disconnect: jest.fn(),
      } as any;

      await gateway.handleConnection(client);

      expect(mockPrisma.remoteSession.findFirst).toHaveBeenCalledWith({
        where: { id: 'sess-001', orgId: 'org-001' },
      });
    });

    it('should reject cross-org session access', async () => {
      mockPrisma.remoteSession.findFirst.mockResolvedValue(null);

      const client = {
        id: 'socket-007',
        data: { user: { userId: 'user-002', orgId: 'org-002', role: 'Technician' } },
        handshake: { query: { sessionId: 'sess-001', role: 'technician' } },
        join: jest.fn(),
        disconnect: jest.fn(),
      } as any;

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(client.join).not.toHaveBeenCalled();
    });
  });

  describe('broadcast to org room only', () => {
    it('should emit to org room when broadcasting session update', () => {
      const session = { id: 'sess-001', status: 'active' };
      gateway.broadcastSessionUpdate('org-001', session);

      expect(mockServer.to).toHaveBeenCalledWith('org:org-001');
      expect(mockServer.emit).toHaveBeenCalledWith('session-update', session);
    });
  });

  describe('disconnect cleanup', () => {
    it('should remove peer on disconnect', async () => {
      const client = {
        id: 'socket-008',
        data: { user: { userId: 'user-001', orgId: 'org-001', role: 'Technician' } },
        handshake: { query: { sessionId: 'sess-001', role: 'technician' } },
        join: jest.fn(),
        disconnect: jest.fn(),
      } as any;

      await gateway.handleConnection(client);
      gateway.handleDisconnect(client);

      const peer = (gateway as any).peers.get('socket-008');
      expect(peer).toBeUndefined();
    });
  });
});
