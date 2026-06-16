import {
  Controller, Get, Post, Delete, Param, Query, Body, Req, Res,
  NotFoundException, ForbiddenException, StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import { ReportingService } from './reporting.service';
import { GenerateReportDto, CreateTemplateDto, CreateScheduleDto } from './dto/generate-report.dto';
import { Roles } from '../common/roles.decorator';

@Controller('reports')
export class ReportingController {
  constructor(private readonly reporting: ReportingService) {}

  // Generate a new report
  @Post('generate')
  @Roles('Admin', 'Owner')
  async generate(@Body() dto: GenerateReportDto, @Req() req: any) {
    const orgId = req.user.orgId;
    const userId = req.user.sub;
    return this.reporting.generate(orgId, userId, dto);
  }

  // List reports
  @Get()
  async list(@Query('type') type: string, @Req() req: any) {
    return this.reporting.list(req.user.orgId, type);
  }

  // Download report by signed URL
  @Get('download/:id/:format')
  async download(
    @Param('id') id: string,
    @Param('format') format: string,
    @Query('expires') expires: string,
    @Query('sig') sig: string,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const orgId = req.user?.orgId;
    const result = await this.reporting.getDownloadInfo(id, format, orgId);
    if (!result) throw new NotFoundException('Report not found');

    const { buffer, report } = result;

    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      html: 'text/html',
    };

    res.set({
      'Content-Type': mimeTypes[format] || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${report.title}.${format}"`,
      'Content-Length': buffer.length.toString(),
    });

    return buffer;
  }

  // Branding
  @Get('branding')
  async getBranding(@Req() req: any) {
    return this.reporting.getBranding(req.user.orgId);
  }

  @Post('branding')
  @Roles('Admin', 'Owner')
  async setBranding(@Body() dto: CreateTemplateDto, @Req() req: any) {
    return this.reporting.setBranding(req.user.orgId, dto);
  }

  // Schedules
  @Get('schedules')
  async listSchedules(@Req() req: any) {
    return this.reporting.listSchedules(req.user.orgId);
  }

  @Post('schedules')
  @Roles('Admin', 'Owner')
  async createSchedule(@Body() dto: CreateScheduleDto, @Req() req: any) {
    return this.reporting.createSchedule(req.user.orgId, dto);
  }

  @Delete('schedules/:id')
  @Roles('Admin', 'Owner')
  async deleteSchedule(@Param('id') id: string, @Req() req: any) {
    const deleted = await this.reporting.deleteSchedule(id, req.user.orgId);
    if (!deleted) throw new NotFoundException('Schedule not found');
    return { deleted: true };
  }
}
