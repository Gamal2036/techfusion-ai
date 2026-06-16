import { Controller, Get, Post, Param, Query, Body, Req } from '@nestjs/common';
import { RemoteSupportService } from './remote-support.service';
import { Public } from '../common/public.decorator';

@Controller('remote-support')
export class RemoteSupportController {
  constructor(private remoteService: RemoteSupportService) {}

  @Post('sessions')
  async createSession(@Req() req: any, @Body() body: { deviceId: string; unattendedPolicy?: string }) {
    const orgId = req.user?.orgId;
    const userId = req.user?.sub;
    if (!orgId || !userId) return null;
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
    if (!orgId) return null;
    return this.remoteService.getSession(orgId, id);
  }

  @Post('sessions/:id/end')
  async endSession(@Req() req: any, @Param('id') id: string) {
    const orgId = req.user?.orgId;
    if (!orgId) return null;
    return this.remoteService.endSession(orgId, id);
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

  @Public()
  @Get('agent/pending')
  async getPendingForDevice(@Req() req: any) {
    const token = req.headers?.authorization?.replace('Bearer ', '');
    const deviceId = req.query?.deviceId as string;
    if (!token || !deviceId) return [];
    return this.remoteService.getPendingForDevice(token, deviceId);
  }

  @Public()
  @Post('consent')
  async handleConsent(@Req() req: any, @Body() body: { sessionId: string; deviceId: string; granted: boolean; method: string }) {
    const token = req.headers?.authorization?.replace('Bearer ', '');
    if (!token) return null;
    return this.remoteService.handleConsent(token, body);
  }

  @Public()
  @Post('agent/status')
  async updateAgentStatus(@Req() req: any, @Body() body: { sessionId: string; status: string; deviceId: string }) {
    const token = req.headers?.authorization?.replace('Bearer ', '');
    if (!token) return null;
    return this.remoteService.updateAgentStatus(token, body);
  }
}
