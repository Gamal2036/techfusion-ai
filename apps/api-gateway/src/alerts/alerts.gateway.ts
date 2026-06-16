import {
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/metrics',
})
export class AlertsGateway {
  @WebSocketServer()
  server: Server;

  broadcastAlert(orgId: string, data: any) {
    this.server.to(`org:${orgId}`).emit('alerts', data);
  }
}
