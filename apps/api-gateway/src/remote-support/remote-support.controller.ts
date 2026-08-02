import { Controller, Get, Post, Param, Query, Body, Req, UnauthorizedException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RemoteSupportService } from './remote-support.service';
import { DevicesService } from '../devices/devices.service';
import { Public } from '../common/public.decorator';
import { throttle } from '../config/rate-limits';

@Controller('remote-support')
export class RemoteSupportController {
  constructor(
    private remoteService: RemoteSupportService,
    private devicesService: DevicesService,
  ) {}

  @Post('sessions')
  async createSession(@Req() req: any, @Body() body: { deviceId: string; unattendedPolicy?: string }) {
    const orgId = req.user?.orgId;
    const userId = req.user?.sub;
    if (!orgId || !userId) throw new UnauthorizedException('Authentication required');
    return this.remoteService.createSession(orgId, userId, body.deviceId, body.unattendedPolicy);
  }

  @Get('sessions')
  async listSessions(@Req() req: any, @Query('status') status?: string) {
    const orgId = req.user?.orgId;
    if (!orgId) return [];
    return this.remoteService.listSessions(orgId, status);
  }

  @Get('sessions/:id')
  async getSession(@Req() req: any, @Param('id') id: string) {
    const orgId = req.user?.orgId;
    if (!orgId) throw new UnauthorizedException('Authentication required');
    return this.remoteService.getSession(orgId, id);
  }

  @Post('sessions/:id/end')
  async endSession(@Req() req: any, @Param('id') id: string) {
    const orgId = req.user?.orgId;
    if (!orgId) throw new UnauthorizedException('Authentication required');
    return this.remoteService.endSession(orgId, id);
  }

  @Get('devices')
  async listDevices(@Req() req: any) {
    const orgId = req.user?.orgId;
    if (!orgId) return [];
    const devices = await this.devicesService.findByOrg(orgId);
    return devices.map((d: any) => ({
      id: d.id,
      hostname: d.hostname || d.name,
      os: d.os,
      osVersion: d.osVersion,
      lastSeenAt: d.lastSeenAt,
      inactive: d.inactive,
    }));
  }

  @Get('recordings')
  async getRecordings(@Req() req: any) {
    const orgId = req.user?.orgId;
    if (!orgId) return [];
    return this.remoteService.getRecordings(orgId);
  }

  @Get('recordings/:sessionId')
  async getSessionRecording(@Req() req: any, @Param('sessionId') sessionId: string) {
    const orgId = req.user?.orgId;
    if (!orgId) return null;
    return this.remoteService.getSessionRecordings(orgId, sessionId);
  }

  @Get('audit-logs')
  async getAuditLogs(@Req() req: any, @Query('sessionId') sessionId?: string, @Query('limit') limit?: string) {
    const orgId = req.user?.orgId;
    if (!orgId) return [];
    return this.remoteService.getAuditLogs(orgId, sessionId, limit ? parseInt(limit, 10) : 50);
  }

  @Post('audit-logs')
  async logAction(@Req() req: any, @Body() body: any) {
    const orgId = req.user?.orgId;
    if (!orgId) return null;
    return this.remoteService.logAction(orgId, {
      ...body,
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
  }

  @Post('recordings/:sessionId')
  async saveRecording(
    @Req() req: any,
    @Param('sessionId') sessionId: string,
    @Body() body: { recordingPath: string; sizeBytes: number; durationSeconds: number },
  ) {
    const orgId = req.user?.orgId;
    if (!orgId) return null;
    return this.remoteService.saveRecording(orgId, sessionId, body.recordingPath, body.sizeBytes, body.durationSeconds);
  }

  @Post('recordings/:sessionId/frames')
  async updateRecordingFrames(
    @Req() req: any,
    @Param('sessionId') sessionId: string,
    @Body() body: { frameData: string; timestamp: string },
  ) {
    const orgId = req.user?.orgId;
    if (!orgId) return null;
    return this.remoteService.updateRecording(orgId, sessionId, body);
  }

  @Post('cleanup')
  async cleanupStaleSessions(@Req() req: any) {
    const orgId = req.user?.orgId;
    if (!orgId) throw new UnauthorizedException('Authentication required');
    return this.remoteService.cleanupStaleSessions();
  }

  @Public()
  @Throttle(throttle(30, 60000))
  @Get('agent/pending')
  async getPendingForDevice(@Req() req: any) {
    const token = req.headers?.authorization?.replace('Bearer ', '');
    const deviceId = req.query?.deviceId as string;
    if (!token || !deviceId) return [];

    const device = await this.devicesService.findByToken(token);
    if (!device || device.id !== deviceId) {
      throw new UnauthorizedException('Invalid device token');
    }

    return this.remoteService.getPendingForDevice(device.orgId, deviceId);
  }

  @Public()
  @Throttle(throttle(10, 60000))
  @Post('consent')
  async handleConsent(@Req() req: any, @Body() body: { sessionId: string; deviceId: string; granted: boolean; method: string }) {
    const token = req.headers?.authorization?.replace('Bearer ', '');
    if (!token) throw new UnauthorizedException('Missing device token');

    const device = await this.devicesService.findByToken(token);
    if (!device || device.id !== body.deviceId) {
      throw new UnauthorizedException('Invalid device token');
    }

    return this.remoteService.handleConsent(device.orgId, body);
  }

  @Public()
  @Throttle(throttle(30, 60000))
  @Post('agent/status')
  async updateAgentStatus(@Req() req: any, @Body() body: { sessionId: string; status: string; deviceId: string }) {
    const token = req.headers?.authorization?.replace('Bearer ', '');
    if (!token) throw new UnauthorizedException('Missing device token');

    const device = await this.devicesService.findByToken(token);
    if (!device || device.id !== body.deviceId) {
      throw new UnauthorizedException('Invalid device token');
    }

    return this.remoteService.updateAgentStatus(device.orgId, body);
  }
}
