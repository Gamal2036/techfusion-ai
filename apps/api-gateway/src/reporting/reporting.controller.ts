import {
  Controller, Get, Post, Delete, Patch, Param, Query, Body, Req, Res,
  NotFoundException, ForbiddenException, UnauthorizedException, BadRequestException,
  ParseUUIDPipe,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import { ReportingService } from './reporting.service';
import { ReportStorageService } from './services/report-storage.service';
import { GenerateReportDto, CreateTemplateDto, CreateScheduleDto, UpdateScheduleDto } from './dto/generate-report.dto';
import { RequirePermissions } from '../common/permissions.decorator';
import { Permission } from '../common/permissions';
import { Public } from '../common/public.decorator';
import { RequireFeature } from '../common/plan.decorator';

@Controller('reports')
export class ReportingController {
  constructor(
    private readonly reporting: ReportingService,
    private readonly storage: ReportStorageService,
  ) {}

  // Generate a new report
  @RequirePermissions(Permission.REPORTS_CREATE)
  @Post('generate')
  async generate(@Body() dto: GenerateReportDto, @Req() req: any) {
    const orgId = req.user.orgId;
    const userId = req.user.sub;
    return this.reporting.generate(orgId, userId, dto);
  }

  // List reports
  @RequirePermissions(Permission.REPORTS_VIEW)
  @Get()
  async list(@Query('type') type: string, @Req() req: any) {
    return this.reporting.list(req.user.orgId, type);
  }

  // Download report by signed URL (public — HMAC signature replaces JWT)
  @Get('download/:id/:format')
  @Public()
  async download(
    @Param('id') id: string,
    @Param('format') format: string,
    @Query('expires') expires: string,
    @Query('sig') sig: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!expires || !sig) {
      throw new BadRequestException('Missing required query parameters: expires, sig');
    }

    const result = await this.reporting.getDownloadInfo(id, format);
    if (!result) throw new NotFoundException('Report not found');

    const { buffer, report } = result;

    const urlValidation = this.storage.validateSignedUrl(id, format, expires, sig, report.orgId);
    if (!urlValidation.valid) {
      throw new UnauthorizedException(urlValidation.reason || 'Invalid download URL');
    }

    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      html: 'text/html; charset=utf-8',
    };

    const safeFilename = report.title.replace(/[^a-zA-Z0-9_\- ]/g, '_');

    return new StreamableFile(buffer, {
      type: mimeTypes[format] || 'application/octet-stream',
      disposition: `attachment; filename="${safeFilename}.${format}"`,
      length: buffer.length,
    });
  }

  // Branding
  @RequirePermissions(Permission.REPORTS_VIEW)
  @Get('branding')
  @RequireFeature('customBranding')
  async getBranding(@Req() req: any) {
    return this.reporting.getBranding(req.user.orgId);
  }

  @RequirePermissions(Permission.REPORTS_MANAGE)
  @Post('branding')
  @RequireFeature('customBranding')
  async setBranding(@Body() dto: CreateTemplateDto, @Req() req: any) {
    return this.reporting.setBranding(req.user.orgId, dto);
  }

  @RequirePermissions(Permission.REPORTS_MANAGE)
  @Delete(':id')
  async deleteReport(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    const deleted = await this.reporting.deleteReport(id, req.user.orgId);
    if (!deleted) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'REPORT_NOT_FOUND',
        code: 'REPORT_NOT_FOUND',
        message: 'Report not found',
      });
    }
    return { deleted: true };
  }

  // Schedules
  @RequirePermissions(Permission.REPORTS_VIEW)
  @Get('schedules')
  async listSchedules(@Req() req: any) {
    return this.reporting.listSchedules(req.user.orgId);
  }

  @RequirePermissions(Permission.REPORTS_MANAGE)
  @Post('schedules')
  async createSchedule(@Body() dto: CreateScheduleDto, @Req() req: any) {
    return this.reporting.createSchedule(req.user.orgId, dto);
  }

  @RequirePermissions(Permission.REPORTS_MANAGE)
  @Patch('schedules/:id')
  async updateSchedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateScheduleDto,
    @Req() req: any,
  ) {
    const updated = await this.reporting.updateSchedule(id, req.user.orgId, dto);
    if (!updated) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'REPORT_SCHEDULE_NOT_FOUND',
        code: 'REPORT_SCHEDULE_NOT_FOUND',
        message: 'Schedule not found',
      });
    }
    return updated;
  }

  @RequirePermissions(Permission.REPORTS_MANAGE)
  @Delete('schedules/:id')
  async deleteSchedule(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    const deleted = await this.reporting.deleteSchedule(id, req.user.orgId);
    if (!deleted) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'REPORT_SCHEDULE_NOT_FOUND',
        code: 'REPORT_SCHEDULE_NOT_FOUND',
        message: 'Schedule not found',
      });
    }
    return { deleted: true };
  }
}
