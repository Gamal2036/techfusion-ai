import { Controller, Get, Post, Body, Param, Query, Req, Res, HttpCode, NotFoundException, Logger } from '@nestjs/common';
import { Response, Request } from 'express';
import { Roles } from '../common/roles.decorator';
import { Public } from '../common/public.decorator';
import { SecurityService } from './security.service';
import { SecurityScoringService } from './services/security-scoring.service';
import { SecurityReportingService } from './services/security-reporting.service';
import { SubmitFindingsDto } from './dto/submit-findings.dto';
import { ScanQueryDto } from './dto/scan-query.dto';

@Controller()
export class SecurityController {
  private readonly logger = new Logger(SecurityController.name);

  constructor(
    private readonly securityService: SecurityService,
    private readonly scoringService: SecurityScoringService,
    private readonly reportingService: SecurityReportingService,
  ) {}

  @Public()
  @Post('devices/security-report')
  @HttpCode(200)
  async submitFindings(@Body() dto: SubmitFindingsDto) {
    const device = await this.securityService.findDeviceByToken(dto.deviceToken);
    if (!device) {
      return { error: 'Invalid device token' };
    }

    const scoreResult = this.scoringService.compute(
      dto.findings.map((f) => ({ severity: f.severity as any })),
    );

    const scan = await this.securityService.createScan(device, dto.findings, scoreResult);

    return {
      scanId: scan.scanId,
      scoreId: scan.scoreId,
      securityScore: scoreResult.securityScore,
      riskLevel: scoreResult.riskLevel,
      totalFindings: scoreResult.totalFindings,
    };
  }

  @Roles('Owner', 'Admin', 'Technician', 'Viewer')
  @Post('security/scans/:deviceId/trigger')
  @HttpCode(201)
  async triggerScan(@Param('deviceId') deviceId: string, @Req() req: Request) {
    const orgId = (req as any).orgId;
    const scan = await this.securityService.createPendingScan(deviceId, orgId);
    return { scanId: scan.id, status: scan.status };
  }

  @Roles('Owner', 'Admin', 'Technician', 'Viewer')
  @Get('security/latest/:deviceId')
  async getLatestScan(@Param('deviceId') deviceId: string, @Req() req: Request) {
    const orgId = (req as any).orgId;
    const result = await this.securityService.getLatestScan(deviceId, orgId);
    if (!result) {
      throw new NotFoundException('No security scan found for this device');
    }
    return result;
  }

  @Roles('Owner', 'Admin', 'Technician', 'Viewer')
  @Get('security/scans/:deviceId')
  async listScans(
    @Param('deviceId') deviceId: string,
    @Query() query: ScanQueryDto,
    @Req() req: Request,
  ) {
    const orgId = (req as any).orgId;
    return this.securityService.listScans(deviceId, orgId, query.limit || 10);
  }

  @Roles('Owner', 'Admin', 'Technician', 'Viewer')
  @Get('security/scans/detail/:scanId')
  async getScanDetail(@Param('scanId') scanId: string, @Req() req: Request) {
    const orgId = (req as any).orgId;
    const scan = await this.securityService.getScanDetail(scanId, orgId);
    if (!scan) {
      throw new NotFoundException('Scan not found');
    }
    return scan;
  }

  @Roles('Owner', 'Admin', 'Technician', 'Viewer')
  @Post('security/findings/:findingId/remediate')
  @HttpCode(200)
  async remediateFinding(@Param('findingId') findingId: string, @Req() req: Request) {
    const orgId = (req as any).orgId;
    const finding = await this.securityService.remediateFinding(findingId, orgId);
    if (!finding) {
      throw new NotFoundException('Finding not found');
    }
    return finding;
  }

  @Roles('Owner', 'Admin', 'Technician', 'Viewer')
  @Get('security/executive-summary/:deviceId')
  async executiveSummary(@Param('deviceId') deviceId: string, @Req() req: Request) {
    const orgId = (req as any).orgId;
    const data = await this.securityService.getExecutiveSummaryData(deviceId, orgId);
    if (!data) {
      throw new NotFoundException('No security data available for this device');
    }
    const summary = this.reportingService.generateSummary(data);
    return summary;
  }

  @Roles('Owner', 'Admin', 'Technician', 'Viewer')
  @Get('security/export-pdf/:deviceId')
  async exportPdf(@Param('deviceId') deviceId: string, @Req() req: Request, @Res() res: Response) {
    const orgId = (req as any).orgId;
    const data = await this.securityService.getExecutiveSummaryData(deviceId, orgId);
    if (!data) {
      throw new NotFoundException('No security data available for this device');
    }
    const summary = this.reportingService.generateSummary(data);

    const html = this.renderPdfHtml(summary);

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `inline; filename="security-report-${deviceId.slice(0, 8)}.html"`);
    res.send(html);
  }

  private renderPdfHtml(summary: any): string {
    const severityColor = (s: string) => {
      switch (s) {
        case 'critical': return '#dc2626';
        case 'high': return '#ea580c';
        case 'medium': return '#ca8a04';
        case 'low': return '#16a34a';
        default: return '#6b7280';
      }
    };

    const findingsRows = summary.topFindings
      .map(
        (f: any) => `
        <tr>
          <td style="padding:8px;border:1px solid #e5e7eb;color:${severityColor(f.severity)};font-weight:600;text-transform:uppercase;font-size:11px">${f.severity}</td>
          <td style="padding:8px;border:1px solid #e5e7eb">${f.finding}</td>
          <td style="padding:8px;border:1px solid #e5e7eb;font-size:13px">${f.remediation}</td>
        </tr>`,
      )
      .join('');

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Security Report - ${summary.deviceName}</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 40px; color: #1f2937; }
  h1 { color: #111827; font-size: 24px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; }
  h2 { color: #374151; font-size: 18px; margin-top: 24px; }
  .score-box { display: inline-block; padding: 16px 32px; border-radius: 8px; font-size: 36px; font-weight: 700; margin: 16px 0; }
  .score-critical { background: #fef2f2; color: #dc2626; }
  .score-high { background: #fff7ed; color: #ea580c; }
  .score-medium { background: #fefce8; color: #ca8a04; }
  .score-low { background: #f0fdf4; color: #16a34a; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th { background: #f3f4f6; padding: 8px; text-align: left; border: 1px solid #e5e7eb; font-size: 12px; text-transform: uppercase; }
  .summary { background: #f9fafb; padding: 16px; border-radius: 8px; border-left: 4px solid #3b82f6; margin: 16px 0; }
  .meta { color: #6b7280; font-size: 13px; }
  ul { padding-left: 20px; }
  li { margin: 8px 0; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
  .counts { display: flex; gap: 16px; margin: 16px 0; }
  .count-box { flex: 1; padding: 12px; border-radius: 6px; text-align: center; }
</style></head><body>
  <h1>Executive Security Summary</h1>
  <p class="meta">Device: ${summary.deviceName}${summary.deviceHostname ? ' (' + summary.deviceHostname + ')' : ''} | Report Date: ${new Date(summary.scanDate).toLocaleDateString()}</p>
  <div class="score-box score-${summary.riskLevel}">${summary.securityScore}/100</div>
  <p style="margin-top:8px;font-size:14px;color:#6b7280">Risk Level: <strong style="text-transform:uppercase;color:${severityColor(summary.riskLevel)}">${summary.riskLevel}</strong></p>
  <div class="counts">
    <div class="count-box" style="background:#fef2f2;color:#dc2626"><strong>${summary.criticalCount}</strong><br>Critical</div>
    <div class="count-box" style="background:#fff7ed;color:#ea580c"><strong>${summary.highCount}</strong><br>High</div>
    <div class="count-box" style="background:#fefce8;color:#ca8a04"><strong>${summary.mediumCount}</strong><br>Medium</div>
    <div class="count-box" style="background:#f0fdf4;color:#16a34a"><strong>${summary.lowCount}</strong><br>Low</div>
  </div>
  <h2>Posture Summary</h2>
  <div class="summary"><p>${summary.summaryText}</p></div>
  <h2>Top Findings</h2>
  <table><thead><tr><th>Severity</th><th>Finding</th><th>Remediation</th></tr></thead><tbody>${findingsRows}</tbody></table>
  <h2>Recommendations</h2>
  <ul>${summary.recommendations.map((r: string) => `<li>${r}</li>`).join('')}</ul>
  <div class="footer">Generated by TechFusion AI Security Center | This report contains confidential security assessment data.</div>
</body></html>`;
  }
}
