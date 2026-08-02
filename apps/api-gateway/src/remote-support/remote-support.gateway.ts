import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { createWsAuthMiddleware } from '../common/ws-auth.middleware';
import { getWsCorsOrigins } from '../common/ws-cors';
import { PrismaService } from '../prisma/prisma.service';
import { Logger } from '@nestjs/common';
import { trackWsConnection, trackWsDisconnection, trackWsAuthFailure, trackRemoteSupportSession, trackRemoteSupportSessionEnd } from '../metrics.interceptor';

interface PeerEntry {
  socketId: string;
  orgId: string;
  sessionId: string;
  role: 'technician' | 'device';
}

@WebSocketGateway({
  cors: { origin: getWsCorsOrigins(), credentials: true },
  namespace: '/remote',
})
export class RemoteSupportGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private peers = new Map<string, PeerEntry>();
  private sessionPeers = new Map<string, { technician?: string; device?: string }>();
  private readonly logger = new Logger(RemoteSupportGateway.name);

  constructor(private prisma: PrismaService) {}

  afterInit(server: Server) {
    server.use(createWsAuthMiddleware());
  }

  async handleConnection(client: Socket) {
    const user = client.data.user;
    if (!user || !user.orgId) {
      trackWsAuthFailure('/remote');
      this.logger.warn('WS connection rejected: no user data', { socketId: client.id });
      client.disconnect(true);
      return;
    }

    const orgId = user.orgId;
    const sessionId = client.handshake.query.sessionId as string;
    const role = client.handshake.query.role as string;

    if (!sessionId || (role !== 'technician' && role !== 'device')) {
      trackWsAuthFailure('/remote');
      this.logger.warn('WS connection rejected: invalid session/role', { socketId: client.id, namespace: '/remote' });
      client.disconnect(true);
      return;
    }

    const session = await this.prisma.remoteSession.findFirst({
      where: { id: sessionId, orgId },
    });
    if (!session) {
      trackWsAuthFailure('/remote');
      this.logger.warn('WS connection rejected: session not found', { socketId: client.id, namespace: '/remote' });
      client.disconnect(true);
      return;
    }

    this.peers.set(client.id, {
      socketId: client.id,
      orgId,
      sessionId,
      role,
    });
    client.join(`session:${sessionId}`);
    client.join(`org:${orgId}`);

    if (!this.sessionPeers.has(sessionId)) {
      this.sessionPeers.set(sessionId, {});
      trackRemoteSupportSession();
    }
    const sp = this.sessionPeers.get(sessionId)!;
    sp[role] = client.id;

    trackWsConnection('/remote');
    this.logger.debug('WS client connected', { socketId: client.id, namespace: '/remote', role, sessionId });
  }

  handleDisconnect(client: Socket) {
    const peer = this.peers.get(client.id);
    if (peer) {
      const sp = this.sessionPeers.get(peer.sessionId);
      if (sp) {
        if (sp.technician === client.id) delete sp.technician;
        if (sp.device === client.id) delete sp.device;
        if (!sp.technician && !sp.device) {
          this.sessionPeers.delete(peer.sessionId);
          trackRemoteSupportSessionEnd();
        }
      }
      this.peers.delete(client.id);
      trackWsDisconnection('/remote', 'client_initiated');
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
