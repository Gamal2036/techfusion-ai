import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

interface PeerEntry {
  socketId: string;
  orgId: string;
  sessionId: string;
  role: 'technician' | 'device';
}

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/remote',
})
export class RemoteSupportGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private peers = new Map<string, PeerEntry>();
  private sessionPeers = new Map<string, { technician?: string; device?: string }>();

  handleConnection(client: Socket) {
    const orgId = client.handshake.query.orgId as string;
    const sessionId = client.handshake.query.sessionId as string;
    const role = client.handshake.query.role as string;

    if (orgId && sessionId && (role === 'technician' || role === 'device')) {
      this.peers.set(client.id, { socketId: client.id, orgId, sessionId, role });
      client.join(`session:${sessionId}`);
      client.join(`org:${orgId}`);

      if (!this.sessionPeers.has(sessionId)) {
        this.sessionPeers.set(sessionId, {});
      }
      const sp = this.sessionPeers.get(sessionId)!;
      sp[role] = client.id;
    }
  }

  handleDisconnect(client: Socket) {
    const peer = this.peers.get(client.id);
    if (peer) {
      const sp = this.sessionPeers.get(peer.sessionId);
      if (sp) {
        if (sp.technician === client.id) delete sp.technician;
        if (sp.device === client.id) delete sp.device;
        if (!sp.technician && !sp.device) this.sessionPeers.delete(peer.sessionId);
      }
      this.peers.delete(client.id);
    }
  }

  @SubscribeMessage('signal')
  handleSignal(client: Socket, payload: { to: string; type: string; data: any }) {
    const peer = this.peers.get(client.id);
    if (!peer) return;

    this.server.to(`session:${peer.sessionId}`).emit('signal', {
      from: client.id,
      type: payload.type,
      data: payload.data,
    });
  }

  @SubscribeMessage('screen-frame')
  handleScreenFrame(client: Socket, payload: { sessionId: string; data: string }) {
    const peer = this.peers.get(client.id);
    if (!peer || peer.role !== 'device') return;

    this.server
      .to(`session:${peer.sessionId}`)
      .emit('screen-frame', { data: payload.data, timestamp: Date.now() });
  }

  @SubscribeMessage('input-event')
  handleInputEvent(client: Socket, payload: { sessionId: string; eventType: string; data: any }) {
    const peer = this.peers.get(client.id);
    if (!peer || peer.role !== 'technician') return;

    this.server
      .to(`session:${peer.sessionId}`)
      .emit('input-event', { eventType: payload.eventType, data: payload.data });
  }

  @SubscribeMessage('session-ended')
  handleSessionEnded(client: Socket, payload: { sessionId: string }) {
    const peer = this.peers.get(client.id);
    if (!peer) return;
    this.server.to(`session:${peer.sessionId}`).emit('session-ended', { sessionId: payload.sessionId });
  }

  broadcastSessionUpdate(orgId: string, session: any) {
    this.server.to(`org:${orgId}`).emit('session-update', session);
  }
}
