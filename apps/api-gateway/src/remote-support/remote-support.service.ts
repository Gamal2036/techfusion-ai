import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RemoteSupportGateway } from './remote-support.gateway';

@Injectable()
export class RemoteSupportService {
  constructor(
    private prisma: PrismaService,
    private gateway: RemoteSupportGateway,
  ) {}

  async createSession(orgId: string, technicianId: string, deviceId: string, unattendedPolicy?: string) {
    const existingActive = await this.prisma.remoteSession.findFirst({
      where: { orgId, deviceId, status: { in: ['pending', 'active'] } },
    });
    if (existingActive) {
      throw new ForbiddenException('Device already has an active or pending session');
    }

    const session = await this.prisma.remoteSession.create({
      data: {
        orgId,
        deviceId,
        technicianId,
        status: 'pending',
        consentGranted: false,
        unattendedPolicy: unattendedPolicy || null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        orgId,
        sessionId: session.id,
        action: 'session_start',
        actorId: technicianId,
        targetId: deviceId,
        details: { method: 'technician_initiated' },
      },
    });

    this.gateway.broadcastSessionUpdate(orgId, session);
    return session;
  }

  async listSessions(orgId: string, status?: string) {
    const where: any = { orgId };
    if (status) where.status = status;
    return this.prisma.remoteSession.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getSession(orgId: string, sessionId: string) {
    const session = await this.prisma.remoteSession.findFirst({
      where: { id: sessionId, orgId },
    });
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  async getPendingForDevice(deviceToken: string, deviceId: string) {
    return this.prisma.remoteSession.findMany({
      where: { deviceId, status: 'pending', consentGranted: false },
      select: {
        id: true,
        deviceId: true,
        technicianId: true,
      },
    });
  }

  async handleConsent(deviceToken: string, body: { sessionId: string; deviceId: string; granted: boolean; method: string }) {
    const session = await this.prisma.remoteSession.findFirst({
      where: { id: body.sessionId, deviceId: body.deviceId },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.status !== 'pending') throw new ForbiddenException('Session is not pending');

    const updates: any = {
      consentGranted: body.granted,
      consentMethod: body.method,
    };

    if (body.granted) {
      updates.status = 'active';
      updates.startedAt = new Date();
    } else {
      updates.status = 'error';
      updates.errorMessage = 'Consent denied by device operator';
    }

    await this.prisma.remoteSession.update({
      where: { id: body.sessionId },
      data: updates,
    });

    await this.prisma.auditLog.create({
      data: {
        orgId: session.orgId,
        sessionId: session.id,
        action: body.granted ? 'consent_granted' : 'consent_denied',
        targetId: body.deviceId,
        details: { method: body.method },
      },
    });

    this.gateway.broadcastSessionUpdate(session.orgId, { id: session.id, ...updates });
    return { status: 'ok', sessionId: body.sessionId, granted: body.granted };
  }

  async updateAgentStatus(deviceToken: string, body: { sessionId: string; status: string; deviceId: string }) {
    const session = await this.prisma.remoteSession.findFirst({
      where: { id: body.sessionId, deviceId: body.deviceId },
    });
    if (!session) throw new NotFoundException('Session not found');

    const data: any = { status: body.status };
    if (body.status === 'ended') {
      data.endedAt = new Date();
    }

    await this.prisma.remoteSession.update({
      where: { id: body.sessionId },
      data,
    });

    if (body.status === 'ended' || body.status === 'error') {
      await this.prisma.auditLog.create({
        data: {
          orgId: session.orgId,
          sessionId: session.id,
          action: 'session_end',
          targetId: body.deviceId,
          details: { status: body.status },
        },
      });
    }

    this.gateway.broadcastSessionUpdate(session.orgId, { id: body.sessionId, status: body.status });
    return { status: 'ok' };
  }

  async endSession(orgId: string, sessionId: string) {
    const session = await this.prisma.remoteSession.findFirst({
      where: { id: sessionId, orgId },
    });
    if (!session) throw new NotFoundException('Session not found');

    await this.prisma.remoteSession.update({
      where: { id: sessionId },
      data: { status: 'ended', endedAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: {
        orgId,
        sessionId: session.id,
        action: 'session_end',
        actorId: session.technicianId,
        targetId: session.deviceId,
        details: { method: 'manual_termination' },
      },
    });

    this.gateway.broadcastSessionUpdate(orgId, { id: sessionId, status: 'ended' });
    return { status: 'ended' };
  }

  async getAuditLogs(orgId: string, sessionId?: string, limit = 50) {
    const where: any = { orgId };
    if (sessionId) where.sessionId = sessionId;
    return this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async logAction(orgId: string, body: { sessionId?: string; action: string; actorId?: string; targetId?: string; details?: any; ipAddress?: string; userAgent?: string }) {
    const log = await this.prisma.auditLog.create({
      data: {
        orgId,
        sessionId: body.sessionId || null,
        action: body.action,
        actorId: body.actorId || null,
        targetId: body.targetId || null,
        details: body.details || undefined,
        ipAddress: body.ipAddress || null,
        userAgent: body.userAgent || null,
      },
    });
    return log;
  }

  async saveRecording(orgId: string, sessionId: string, recordingPath: string, sizeBytes: number, durationSeconds: number) {
    const session = await this.prisma.remoteSession.findFirst({
      where: { id: sessionId, orgId },
    });
    if (!session) throw new NotFoundException('Session not found');

    await this.prisma.remoteSession.update({
      where: { id: sessionId },
      data: {
        recordingPath,
        recordingSize: BigInt(sizeBytes),
        recordingDuration: durationSeconds,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        orgId,
        sessionId,
        action: 'recording_saved',
        targetId: session.deviceId,
        details: { path: recordingPath, sizeBytes, durationSeconds },
      },
    });

    return { status: 'ok' };
  }

  async getRecordings(orgId: string) {
    const rows = await this.prisma.remoteSession.findMany({
      where: { orgId, recordingPath: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        deviceId: true,
        recordingPath: true,
        recordingSize: true,
        recordingDuration: true,
        startedAt: true,
        endedAt: true,
      },
    });
    return rows.map((r: { id: string; deviceId: string; recordingPath: string | null; recordingSize: bigint | null; recordingDuration: number | null; startedAt: Date | null; endedAt: Date | null }) => ({
      ...r,
      recordingSize: r.recordingSize ? Number(r.recordingSize) : null,
    }));
  }

  async getSessionRecordings(orgId: string, sessionId: string) {
    const session = await this.prisma.remoteSession.findFirst({
      where: { id: sessionId, orgId, recordingPath: { not: null } },
      select: {
        id: true,
        deviceId: true,
        recordingPath: true,
        recordingSize: true,
        recordingDuration: true,
        startedAt: true,
        endedAt: true,
      },
    });
    if (!session) throw new NotFoundException('Recording not found for this session');
    return {
      ...session,
      recordingSize: session.recordingSize ? Number(session.recordingSize) : null,
    };
  }

  async updateRecording(orgId: string, sessionId: string, body: { frameData: string; timestamp: string }) {
    const session = await this.prisma.remoteSession.findFirst({
      where: { id: sessionId, orgId },
    });
    if (!session) throw new NotFoundException('Session not found');

    const existing = (session.metadata as any) || {};
    const frames = existing.recordingFrames || [];
    frames.push({ data: body.frameData.substring(0, 1000), timestamp: body.timestamp });
    const trimmed = frames.slice(-600);

    await this.prisma.remoteSession.update({
      where: { id: sessionId },
      data: { metadata: { ...existing, recordingFrames: trimmed } },
    });

    return { status: 'ok', frameCount: trimmed.length };
  }
}
