import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/metrics',
})
export class DevicesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private orgRooms = new Map<string, Set<string>>();

  handleConnection(client: Socket) {
    const orgId = client.handshake.query.orgId as string;
    if (orgId) {
      client.join(`org:${orgId}`);
      if (!this.orgRooms.has(orgId)) {
        this.orgRooms.set(orgId, new Set());
      }
      this.orgRooms.get(orgId)!.add(client.id);
    }
  }

  handleDisconnect(client: Socket) {
    for (const [orgId, clients] of this.orgRooms.entries()) {
      if (clients.has(client.id)) {
        clients.delete(client.id);
        if (clients.size === 0) this.orgRooms.delete(orgId);
        break;
      }
    }
  }

  broadcastMetrics(orgId: string, deviceId: string, data: any) {
    this.server.to(`org:${orgId}`).emit('metrics', {
      deviceId,
      ...data,
    });
  }
}
