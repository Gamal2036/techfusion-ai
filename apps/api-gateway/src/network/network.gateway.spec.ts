import { Test, TestingModule } from '@nestjs/testing';
import { NetworkGateway } from './network.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { Server, Socket } from 'socket.io';

const mockPrisma = {
  organizationMember: { findUnique: jest.fn() },
};

describe('NetworkGateway', () => {
  let gateway: NetworkGateway;
  let mockServer: any;

  beforeEach(async () => {
    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NetworkGateway,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    gateway = module.get<NetworkGateway>(NetworkGateway);
    gateway.server = mockServer;
  });

  describe('organization isolation', () => {
    it('should reject connection without user data', () => {
      const client = {
        id: 'socket-001',
        data: {},
        handshake: { query: {} },
        join: jest.fn(),
        disconnect: jest.fn(),
      } as any;

      gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(client.join).not.toHaveBeenCalled();
    });

    it('should accept connection with valid user data', () => {
      const client = {
        id: 'socket-002',
        data: { user: { userId: 'user-001', orgId: 'org-001', role: 'Technician' } },
        handshake: { query: {} },
        join: jest.fn(),
        disconnect: jest.fn(),
      } as any;

      gateway.handleConnection(client);

      expect(client.disconnect).not.toHaveBeenCalledWith(true);
      expect(client.join).toHaveBeenCalledWith('org:org-001');
    });

    it('should emit to correct org room on topology broadcast', () => {
      const topology = { nodes: [], links: [], scan: null };
      gateway.broadcastTopology('org-001', topology);

      expect(mockServer.to).toHaveBeenCalledWith('org:org-001');
      expect(mockServer.emit).toHaveBeenCalledWith('topology', topology);
    });

    it('should emit to correct org room on diagnostics broadcast', () => {
      const data = { type: 'latency', results: [] };
      gateway.broadcastDiagnostics('org-001', data);

      expect(mockServer.to).toHaveBeenCalledWith('org:org-001');
      expect(mockServer.emit).toHaveBeenCalledWith('diagnostics', data);
    });

    it('should emit scan status to correct org room', () => {
      const scan = { id: 'scan-001', status: 'completed' };
      gateway.broadcastScanStatus('org-001', scan);

      expect(mockServer.to).toHaveBeenCalledWith('org:org-001');
      expect(mockServer.emit).toHaveBeenCalledWith('scan-status', scan);
    });

    it('should not leak broadcasts across organizations', () => {
      const topology = { nodes: [{ id: '1' }], links: [], scan: null };
      gateway.broadcastTopology('org-001', topology);

      expect(mockServer.to).toHaveBeenCalledTimes(1);
      expect(mockServer.to).toHaveBeenCalledWith('org:org-001');
    });
  });

  describe('disconnect cleanup', () => {
    it('should remove client from org room tracking on disconnect', () => {
      const client = {
        id: 'socket-003',
        data: { user: { userId: 'user-001', orgId: 'org-001', role: 'Technician' } },
        handshake: { query: {} },
        join: jest.fn(),
        disconnect: jest.fn(),
      } as any;

      gateway.handleConnection(client);
      gateway.handleDisconnect(client);

      const orgRooms = (gateway as any).orgRooms;
      expect(orgRooms.has('org-001')).toBe(false);
    });
  });
});
