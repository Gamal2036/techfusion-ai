import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiOrchestratorService } from '../ai/ai-orchestrator.service';
import { BrandingService } from './services/branding.service';
import { ReportStorageService } from './services/report-storage.service';
import { HtmlGeneratorService } from './services/html-generator.service';
import { PdfGeneratorService } from './services/pdf-generator.service';
import { DocxGeneratorService } from './services/docx-generator.service';
import { IReportGenerator } from './services/report-generator.interface';
import { GenerateReportDto, ReportType, ReportFormat } from './dto/generate-report.dto';
import { buildDeviceHealthReport, DeviceHealthInput } from './report-types/device-health.report';
import { buildSecurityExecutiveReport, SecurityExecutiveInput } from './report-types/security-executive.report';
import { buildFleetSummaryReport, FleetSummaryInput } from './report-types/fleet-summary.report';
import { Alert, SecurityFinding, Prisma } from '@prisma/client';
import { getPlanConfig } from '../billing/plan-features';

type DeviceWithRelations = Prisma.DeviceGetPayload<{
  include: { alerts: true; scores: true; securityScores: true };
}>;

@Injectable()
export class ReportingService {
  private readonly logger = new Logger(ReportingService.name);
  private readonly generators: Map<string, IReportGenerator>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly branding: BrandingService,
    private readonly storage: ReportStorageService,
    private readonly htmlGen: HtmlGeneratorService,
    private readonly pdfGen: PdfGeneratorService,
    private readonly docxGen: DocxGeneratorService,
    private readonly ai?: AiOrchestratorService,
  ) {
    this.generators = new Map<string, IReportGenerator>([
      ['html', this.htmlGen],
      ['pdf', this.pdfGen],
      ['docx', this.docxGen],
    ]);
  }

  async generate(orgId: string, userId: string, dto: GenerateReportDto) {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (org) {
      const planConfig = getPlanConfig(org.plan);
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const monthCount = await this.prisma.report.count({
        where: { orgId, createdAt: { gte: startOfMonth } },
      });
      if (monthCount >= planConfig.limits.maxReportsPerMonth) {
        throw new ForbiddenException(
          `Monthly report limit reached (${planConfig.limits.maxReportsPerMonth} max on ${planConfig.label} plan). ` +
          `Upgrade to generate more reports.`,
        );
      }
    }

    const format = dto.format;
    const generator = this.generators.get(format);
    if (!generator) throw new Error(`Unsupported format: ${format}`);

    const branding = await this.branding.getBranding(orgId);
    const reportTitle = dto.title || this.defaultTitle(dto.type);

    let reportData: any;
    switch (dto.type) {
      case ReportType.DEVICE_HEALTH:
        reportData = await this.collectDeviceHealthData(orgId, dto.deviceIds?.[0]);
        break;
      case ReportType.SECURITY_EXECUTIVE:
        reportData = await this.collectSecurityData(orgId, dto.scanId, dto.deviceIds?.[0]);
        break;
      case ReportType.FLEET_SUMMARY:
        reportData = await this.collectFleetSummaryData(orgId);
        break;
      default:
        throw new Error(`Unknown report type: ${dto.type}`);
    }

    let data: any;
    switch (dto.type) {
      case ReportType.DEVICE_HEALTH:
        data = buildDeviceHealthReport(reportData as DeviceHealthInput, branding.companyName || 'Organization');
        break;
      case ReportType.SECURITY_EXECUTIVE:
        data = buildSecurityExecutiveReport(reportData as SecurityExecutiveInput, branding.companyName || 'Organization');
        break;
      case ReportType.FLEET_SUMMARY:
        data = buildFleetSummaryReport(reportData as FleetSummaryInput, branding.companyName || 'Organization');
        break;
    }

    data.branding = branding;

    if (dto.generateAiSummary && this.ai) {
      data.aiSummary = await this.generateAiSummary(orgId, dto.type, data);
    }

    const buffer = await generator.generate(data);
    const safeName = reportTitle.replace(/[^a-zA-Z0-9]/g, '_');
    const stored = await this.storage.store(orgId, safeName, format, buffer);

    const report = await this.prisma.report.create({
      data: {
        orgId,
        type: dto.type,
        format,
        title: reportTitle,
        description: dto.description,
        storagePath: stored.storagePath,
        fileSize: stored.fileSize,
        signedUrl: this.storage.generateSignedUrl(orgId, safeName, format),
        urlExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        aiGenerated: !!dto.generateAiSummary,
        aiSummary: data.aiSummary || undefined,
        sourceIds: JSON.stringify({ deviceIds: dto.deviceIds, scanId: dto.scanId }),
        status: 'completed',
      },
    });

    return report;
  }

  async list(orgId: string, type?: string) {
    const where: any = { orgId };
    if (type) where.type = type;
    return this.prisma.report.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  async getDownloadInfo(reportId: string, format: string, orgId: string) {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report || report.orgId !== orgId) return null;
    if (report.format !== format) return null;
    const buffer = await this.storage.read(report.storagePath);
    if (!buffer) return null;
    return { buffer, report };
  }

  async getBranding(orgId: string) {
    return this.branding.getBranding(orgId);
  }

  async setBranding(orgId: string, config: { companyName?: string; logoPath?: string; accentColor?: string }) {
    return this.branding.setBranding(orgId, config);
  }

  async listSchedules(orgId: string) {
    return this.prisma.reportSchedule.findMany({ where: { orgId } });
  }

  async createSchedule(orgId: string, dto: { type: string; formats: string; cron: string; deviceIds?: string[] }) {
    return this.prisma.reportSchedule.create({
      data: { orgId, type: dto.type, formats: dto.formats, cron: dto.cron, deviceIds: dto.deviceIds ? JSON.stringify(dto.deviceIds) : undefined },
    });
  }

  async deleteSchedule(id: string, orgId: string) {
    const schedule = await this.prisma.reportSchedule.findUnique({ where: { id } });
    if (!schedule || schedule.orgId !== orgId) return false;
    await this.prisma.reportSchedule.delete({ where: { id } });
    return true;
  }

  private async collectDeviceHealthData(orgId: string, deviceId?: string): Promise<DeviceHealthInput> {
    const device = await this.prisma.device.findFirst({
      where: { orgId, ...(deviceId ? { id: deviceId } : {}) },
      orderBy: { lastSeenAt: 'desc' },
      include: {
        metrics: { orderBy: { recordedAt: 'desc' }, take: 1 },
        scores: { orderBy: { calculatedAt: 'desc' }, take: 1 },
        alerts: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });

    if (!device) throw new Error(deviceId ? `Device ${deviceId} not found` : 'No devices found');

    const m = device.metrics[0];
    const s = device.scores[0];

    return {
      deviceName: device.name,
      deviceId: device.id,
      uptime: Number(m?.uptime ?? 0),
      cpuUsage: m?.cpuUsage ?? 0,
      memoryUsage: m?.ramPercent ?? 0,
      diskUsage: m?.diskReadBytes && m?.diskTotal ? Number(m.diskReadBytes) / Number(m.diskTotal) * 100 : 50,
      lastBoot: device.lastSeenAt,
      temperature: m?.tempCpu ?? 0,
      alerts: device.alerts.map((a: Alert) => ({ severity: a.severity, message: a.message, timestamp: a.createdAt })),
      metrics: m ? [
        { label: 'CPU', value: m.cpuUsage, unit: '%' },
        { label: 'Memory', value: m.ramPercent, unit: '%' },
        { label: 'Temperature', value: m.tempCpu ?? 0, unit: '°C' },
      ] : [],
      score: {
        overall: s?.healthScore ?? 100,
        cpu: s?.performanceScore ?? 100,
        memory: s?.performanceScore ?? 100,
        disk: s?.performanceScore ?? 100,
        network: s?.healthScore ?? 100,
      },
    };
  }

  private async collectSecurityData(orgId: string, scanId?: string, deviceId?: string): Promise<SecurityExecutiveInput> {
    const scan = await this.prisma.securityScan.findFirst({
      where: { orgId, ...(scanId ? { id: scanId } : {}), ...(deviceId ? { deviceId } : {}) },
      orderBy: { createdAt: 'desc' },
      include: { findings: true, score: true, device: true },
    });

    if (!scan) throw new Error('No security scan found');

    const score = scan.score;

    return {
      scanName: `Scan ${new Date(scan.createdAt).toLocaleDateString()}`,
      scanDate: scan.createdAt,
      totalFindings: scan.findings.length,
      criticalCount: score?.criticalCount ?? scan.findings.filter((f: SecurityFinding) => f.severity === 'critical').length,
      highCount: score?.highCount ?? scan.findings.filter((f: SecurityFinding) => f.severity === 'high').length,
      mediumCount: score?.mediumCount ?? scan.findings.filter((f: SecurityFinding) => f.severity === 'medium').length,
      lowCount: score?.lowCount ?? scan.findings.filter((f: SecurityFinding) => f.severity === 'low').length,
      scores: {
        critical: 100 - (score?.criticalCount ? Math.min(score.criticalCount * 20, 100) : 0),
        high: 100 - (score?.highCount ? Math.min(score.highCount * 15, 100) : 0),
        medium: 100 - (score?.mediumCount ? Math.min(score.mediumCount * 10, 100) : 0),
        low: 100 - (score?.lowCount ? Math.min(score.lowCount * 5, 100) : 0),
        overall: score?.securityScore ?? 100,
      },
      findings: scan.findings.map((f: SecurityFinding) => ({
        title: f.finding,
        severity: f.severity,
        description: (f.details as any)?.description ?? f.finding,
        recommendation: f.remediation || 'No recommendation available.',
      })),
      deviceName: scan.device?.name || 'Unknown Device',
    };
  }

  private async collectFleetSummaryData(orgId: string): Promise<FleetSummaryInput> {
    const devices = await this.prisma.device.findMany({
      where: { orgId },
      include: {
        alerts: { where: { acknowledgedAt: null } },
        scores: { orderBy: { calculatedAt: 'desc' }, take: 1 },
        securityScores: { orderBy: { calculatedAt: 'desc' }, take: 1 },
      },
    });

    let totalHealth = 0;
    let totalSecurity = 0;
    let healthCount = 0;
    let securityCount = 0;
    let totalAlerts = 0;
    let criticalAlerts = 0;

    const deviceSummaries = devices.map((d: DeviceWithRelations) => {
      const health = d.scores[0]?.healthScore ?? 0;
      const security = d.securityScores[0]?.securityScore ?? 0;
      const alerts = d.alerts.length;
      const critical = d.alerts.filter((a: Alert) => a.severity === 'critical').length;

      totalHealth += health;
      totalSecurity += security;
      healthCount++;
      securityCount++;
      totalAlerts += alerts;
      criticalAlerts += critical;

      return {
        name: d.name,
        health,
        security,
        status: d.lastSeenAt && Date.now() - d.lastSeenAt.getTime() < 300000 ? 'online' : 'offline',
      };
    });

    const onlineCount = deviceSummaries.filter((d: { status: string }) => d.status === 'online').length;

    return {
      totalDevices: devices.length,
      onlineDevices: onlineCount,
      offlineDevices: devices.length - onlineCount,
      avgHealthScore: healthCount > 0 ? totalHealth / healthCount : 0,
      avgSecurityScore: securityCount > 0 ? totalSecurity / securityCount : 0,
      totalAlerts,
      criticalAlerts,
      deviceSummaries,
    };
  }

  private async generateAiSummary(orgId: string, type: string, data: any): Promise<string> {
    if (!this.ai) return '';
    try {
      const scoreText = data.scoreData
        ? data.scoreData.map((s: any) => `${s.label}: ${Math.round(s.value)}/${s.max || 100}`).join(', ')
        : '';
      const findingsText = data.findingsSummary
        ? data.findingsSummary.map((f: any) => `${f.label}: ${f.count}`).join(', ')
        : '';

      const result = await this.ai.complete(orgId, {
        systemPrompt: `You are a technical report analyst. Generate a concise 2-3 sentence executive summary for a ${type.replace(/_/g, ' ')} report. Use ONLY the data provided below — do NOT invent scores, counts, or metrics not present.`,
        messages: [{
          role: 'user',
          content: `Report: ${data.title}\nOrg: ${data.orgName}${data.deviceName ? '\nDevice: ' + data.deviceName : ''}${scoreText ? '\nScores: ' + scoreText : ''}${findingsText ? '\nFindings: ' + findingsText : ''}\n\nGenerate a concise executive summary.`,
        }],
        maxTokens: 300,
        temperature: 0.3,
      });

      return result.content.trim();
    } catch (err) {
      this.logger.warn(`AI summary generation failed: ${(err as Error).message}`);
      return '';
    }
  }

  private defaultTitle(type: string): string {
    switch (type) {
      case 'device_health': return 'Device Health Report';
      case 'security_executive': return 'Security Executive Report';
      case 'fleet_summary': return 'Fleet Summary Report';
      default: return 'Report';
    }
  }
}
