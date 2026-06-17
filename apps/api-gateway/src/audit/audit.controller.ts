import { Controller, Get, Post, Query, Req, Res, Headers } from '@nestjs/common';
import { Response } from 'express';
import { AuditService } from './audit.service';
import { Roles } from '../common/roles.decorator';

@Controller()
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get('audit/logs')
  @Roles('Owner', 'Admin')
  async getAuditLogs(
    @Req() req: any,
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('targetId') targetId?: string,
    @Query('sessionId') sessionId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.auditService.query(req.user.orgId, {
      action,
      actorId,
      targetId,
      sessionId,
      startDate,
      endDate,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  @Get('audit/export/csv')
  @Roles('Owner', 'Admin')
  async exportCsv(
    @Req() req: any,
    @Res() res: Response,
    @Query('action') action?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const csv = await this.auditService.exportCsv(req.user.orgId, { action, startDate, endDate });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit-log-${Date.now()}.csv"`);
    res.send(csv);
  }

  @Get('audit/export/json')
  @Roles('Owner', 'Admin')
  async exportJson(
    @Req() req: any,
    @Query('action') action?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.auditService.exportJson(req.user.orgId, { action, startDate, endDate });
  }
}
