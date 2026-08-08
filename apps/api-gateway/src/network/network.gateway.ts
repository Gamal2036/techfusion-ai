import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { createWsAuthMiddleware } from '../common/ws-auth.middleware';
import { getWsCorsOrigins } from '../common/ws-cors';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { trackWsConnection, trackWsDisconnection, trackWsAuthFailure } from '../metrics.interceptor';

@WebSocketGateway({
  cors: { origin: getWsCorsOrigins(), credentials: true },
  namespace: '/network',
})
export class NetworkGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private orgRooms = new Map<string, Set<string>>();
  private readonly logger = new Logger(NetworkGateway.name);

  constructor(private prisma: PrismaService) {}

  afterInit(server: Server) {
    server.use(createWsAuthMiddleware(this.prisma));
  }

  handleConnection(client: Socket) {
    const user = client.data.user;
    if (!user || !user.orgId) {
      trackWsAuthFailure('/network');
      this.logger.warn('WS connection rejected: no user data', { socketId: client.id });
      client.disconnect(true);
      return;
    }
    const orgId = user.orgId;
    client.join(`org:${orgId}`);
    if (!this.orgRooms.has(orgId)) {
      this.orgRooms.set(orgId, new Set());
    }
    this.orgRooms.get(orgId)!.add(client.id);
    trackWsConnection('/network');
    this.logger.debug('WS client connected', { socketId: client.id, namespace: '/network' });
  }

  handleDisconnect(client: Socket) {
    for (const [orgId, clients] of this.orgRooms.entries()) {
      if (clients.has(client.id)) {
        clients.delete(client.id);
        if (clients.size === 0) this.orgRooms.delete(orgId);
        trackWsDisconnection('/network', 'client_initiated');
        break;
      }
    }
  }

  broadcastTopology(orgId: string, topology: any) {
    this.server.to(`org:${orgId}`).emit('topology', topology);
  }

  broadcastDiagnostics(orgId: string, data: any) {
    this.server.to(`org:${orgId}`).emit('diagnostics', data);
  }

  broadcastScanStatus(orgId: string, scan: any) {
    this.server.to(`org:${orgId}`).emit('scan-status', scan);
  }
}
