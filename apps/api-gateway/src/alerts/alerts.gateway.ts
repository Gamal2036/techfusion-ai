import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class AlertsGateway {
  private server: Server | null = null;

  setServer(server: Server): void {
    this.server = server;
  }

  broadcastAlert(orgId: string, data: any): void {
    if (!this.server) {
      console.warn('[AlertsGateway] Server not initialized — alert not broadcast');
      return;
    }
    this.server.to(`org:${orgId}`).emit('alerts', data);
  }
}
