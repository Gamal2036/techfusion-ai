import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AlertsGateway } from '../alerts/alerts.gateway';
import { createWsAuthMiddleware } from '../common/ws-auth.middleware';
import { getWsCorsOrigins } from '../common/ws-cors';
import { Logger } from '@nestjs/common';
import { trackWsConnection, trackWsDisconnection, trackWsAuthFailure } from '../metrics.interceptor';

@WebSocketGateway({
  cors: { origin: getWsCorsOrigins(), credentials: true },
  namespace: '/metrics',
})
export class DevicesGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private orgRooms = new Map<string, Set<string>>();
  private readonly logger = new Logger(DevicesGateway.name);

  constructor(private alertsGateway: AlertsGateway) {}

  afterInit(server: Server) {
    this.alertsGateway.setServer(server);
    server.use(createWsAuthMiddleware());
  }

  handleConnection(client: Socket) {
    const user = client.data.user;
    if (!user || !user.orgId) {
      trackWsAuthFailure('/metrics');
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
    trackWsConnection('/metrics');
    this.logger.debug('WS client connected', { socketId: client.id, namespace: '/metrics' });
  }

  handleDisconnect(client: Socket) {
    for (const [orgId, clients] of this.orgRooms.entries()) {
      if (clients.has(client.id)) {
        clients.delete(client.id);
        if (clients.size === 0) this.orgRooms.delete(orgId);
        trackWsDisconnection('/metrics', 'client_initiated');
        break;
      }
    }
  }

  broadcastMetrics(orgId: string, deviceId: string, data: any) {
    const safe = JSON.parse(
      JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? Number(v) : v)),
    );
    const payload = {
      deviceId,
      ...safe,
    };
    
    this.server.to(`org:${orgId}`).emit('metrics', payload);
    
    this.logger.debug('Metrics event emitted', {
      deviceId,
      orgId,
      recordedAt: safe.metric?.recordedAt,
      lastSeenAt: safe.lastSeenAt,
      room: `org:${orgId}`,
    });
  }

  broadcastAlert(orgId: string, data: any) {
    this.server.to(`org:${orgId}`).emit('alerts', data);
  }
}
