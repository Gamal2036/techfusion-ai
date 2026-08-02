import { Injectable, Logger, ForbiddenException, UnprocessableEntityException, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiOrchestratorService } from '../ai/ai-orchestrator.service';
import { BrandingService } from './services/branding.service';
import { ReportStorageService } from './services/report-storage.service';
import { DEVICE_ONLINE_THRESHOLD_MS } from '../devices/device-presence';
import { HtmlGeneratorService } from './services/html-generator.service';
import { PdfGeneratorService } from './services/pdf-generator.service';
import { DocxGeneratorService } from './services/docx-generator.service';
import { CsvGeneratorService } from './services/csv-generator.service';
import { JsonGeneratorService } from './services/json-generator.service';
import { IReportGenerator } from './services/report-generator.interface';
import { GenerateReportDto, ReportType, ReportFormat, CreateScheduleDto, UpdateScheduleDto } from './dto/generate-report.dto';
import { buildDeviceHealthReport, DeviceHealthInput } from './report-types/device-health.report';
import { buildSecurityExecutiveReport, SecurityExecutiveInput } from './report-types/security-executive.report';
import { buildFleetSummaryReport, FleetSummaryInput } from './report-types/fleet-summary.report';
import { buildNetworkReport, NetworkReportInput } from './report-types/network-report';
import { buildInventoryReport, InventoryReportInput } from './report-types/inventory-report';
import { buildRemoteSupportReport, RemoteSupportReportInput } from './report-types/remote-support-report';
import { Alert, SecurityFinding, Prisma } from '@prisma/client';
import { getPlanConfig } from '../billing/plan-features';
import { QueueService } from '../queue/queue.service';
import {
  calculateNextRunAt,
  normalizeScheduleFormats,
  parseScheduleDeviceIds,
  scheduleToResponse,
  SUPPORTED_REPORT_FORMATS,
} from './report-schedule.utils';

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
    private readonly csvGen: CsvGeneratorService,
    private readonly jsonGen: JsonGeneratorService,
    private readonly queueService: QueueService,
    private readonly ai?: AiOrchestratorService,
  ) {
    this.generators = new Map<string, IReportGenerator>([
      ['html', this.htmlGen],
      ['pdf', this.pdfGen],
      ['docx', this.docxGen],
      ['csv', this.csvGen],
      ['json', this.jsonGen],
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
      case ReportType.NETWORK:
        reportData = await this.collectNetworkData(orgId);
        break;
      case ReportType.INVENTORY:
        reportData = await this.collectInventoryData(orgId);
        break;
      case ReportType.REMOTE_SUPPORT:
        reportData = await this.collectRemoteSupportData(orgId);
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
      case ReportType.NETWORK:
        data = buildNetworkReport(reportData as NetworkReportInput, branding.companyName || 'Organization');
        break;
      case ReportType.INVENTORY:
        data = buildInventoryReport(reportData as InventoryReportInput, branding.companyName || 'Organization');
        break;
      case ReportType.REMOTE_SUPPORT:
        data = buildRemoteSupportReport(reportData as RemoteSupportReportInput, branding.companyName || 'Organization');
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
        urlExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        aiGenerated: !!dto.generateAiSummary,
        aiSummary: data.aiSummary || undefined,
        sourceIds: JSON.stringify({ deviceIds: dto.deviceIds, scanId: dto.scanId }),
        status: 'completed',
        createdBy: userId,
        completedAt: new Date(),
      },
    });

    const signedUrl = this.storage.generateSignedUrl(orgId, report.id, format);

    const updatedReport = await this.prisma.report.update({
      where: { id: report.id },
      data: { signedUrl },
    });

    return updatedReport;
  }

  async list(orgId: string, type?: string) {
    const where: any = { orgId };
    if (type) where.type = type;
    return this.prisma.report.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  async deleteReport(id: string, orgId: string) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report || report.orgId !== orgId) return null;
    await this.storage.delete(report.storagePath).catch(() => {});
    await this.prisma.report.delete({ where: { id } });
    return { deleted: true };
  }

  async getDownloadInfo(reportId: string, format: string, orgId?: string) {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) return null;
    if (orgId && report.orgId !== orgId) return null;
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

  private normalizeDeviceIds(deviceIds?: string[]) {
    if (deviceIds === undefined) return undefined;
    if (!Array.isArray(deviceIds)) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'REPORT_SCHEDULE_DEVICE_NOT_FOUND',
        message: 'Device IDs must be an array of strings.',
      });
    }

    const normalized = deviceIds
      .map((id) => (typeof id === 'string' ? id.trim() : ''))
      .filter(Boolean);

    if (normalized.length !== deviceIds.length) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'REPORT_SCHEDULE_DEVICE_NOT_FOUND',
        message: 'Device IDs must be non-empty strings.',
      });
    }

    return Array.from(new Set(normalized));
  }

  private async validateDeviceOwnership(orgId: string, deviceIds: string[] | undefined) {
    if (!deviceIds || !deviceIds.length) return;

    const ownedDevices = await this.prisma.device.findMany({
      where: { orgId, id: { in: deviceIds } },
      select: { id: true },
    });

    const ownedIds = new Set(ownedDevices.map((d) => d.id));
    if (ownedIds.size === deviceIds.length) return;

    const missingOrForbidden = deviceIds.filter((id) => !ownedIds.has(id));
    const devices = await this.prisma.device.findMany({
      where: { id: { in: missingOrForbidden } },
      select: { id: true, orgId: true },
    });

    if (devices.length > 0) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'REPORT_SCHEDULE_DEVICE_FORBIDDEN',
        code: 'REPORT_SCHEDULE_DEVICE_FORBIDDEN',
        message: 'One or more device IDs belong to another organization.',
      });
    }

    throw new NotFoundException({
      statusCode: 404,
      error: 'REPORT_SCHEDULE_DEVICE_NOT_FOUND',
      code: 'REPORT_SCHEDULE_DEVICE_NOT_FOUND',
      message: 'One or more device IDs were not found.',
    });
  }

  async listSchedules(orgId: string) {
    const schedules = await this.prisma.reportSchedule.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });
    return schedules.map(scheduleToResponse);
  }

  async createSchedule(orgId: string, dto: CreateScheduleDto) {
    const formats = normalizeScheduleFormats(dto.formats);
    if (!formats.length) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'INVALID_REPORT_SCHEDULE_FORMAT',
        code: 'INVALID_REPORT_SCHEDULE_FORMAT',
        message: 'At least one report format is required.',
      });
    }

    const unsupportedFormats = formats.filter(
      (format) => !SUPPORTED_REPORT_FORMATS.includes(format as ReportFormat),
    );
    if (unsupportedFormats.length) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'INVALID_REPORT_SCHEDULE_FORMAT',
        code: 'INVALID_REPORT_SCHEDULE_FORMAT',
        message: `Unsupported report format(s): ${unsupportedFormats.join(', ')}.`,
      });
    }

    let nextRunAt: Date;
    try {
      nextRunAt = calculateNextRunAt(dto.cron, new Date());
    } catch {
      throw new BadRequestException({
        statusCode: 400,
        error: 'INVALID_REPORT_SCHEDULE_CRON',
        code: 'INVALID_REPORT_SCHEDULE_CRON',
        message: 'The report schedule cron expression is invalid.',
      });
    }

    const deviceIds = this.normalizeDeviceIds(dto.deviceIds);
    await this.validateDeviceOwnership(orgId, deviceIds);

    const schedule = await this.prisma.reportSchedule.create({
      data: {
        orgId,
        type: dto.type,
        formats: formats.join(','),
        cron: dto.cron,
        deviceIds: deviceIds ? JSON.stringify(deviceIds) : undefined,
        nextRunAt,
      },
    });

    return scheduleToResponse(schedule);
  }

  async updateSchedule(id: string, orgId: string, dto: UpdateScheduleDto) {
    const schedule = await this.prisma.reportSchedule.findFirst({ where: { id, orgId } });
    if (!schedule) return null;

    const data: any = {};
    const now = new Date();

    if (dto.type !== undefined) {
      data.type = dto.type;
    }

    if (dto.formats !== undefined) {
      const formats = normalizeScheduleFormats(dto.formats);
      if (!formats.length) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'INVALID_REPORT_SCHEDULE_FORMAT',
          message: 'At least one report format is required.',
        });
      }

      const unsupportedFormats = formats.filter(
        (format) => !SUPPORTED_REPORT_FORMATS.includes(format as ReportFormat),
      );
      if (unsupportedFormats.length) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'INVALID_REPORT_SCHEDULE_FORMAT',
          message: `Unsupported report format(s): ${unsupportedFormats.join(', ')}.`,
        });
      }

      data.formats = formats.join(',');
    }

    if (dto.deviceIds !== undefined) {
      const deviceIds = this.normalizeDeviceIds(dto.deviceIds);
      await this.validateDeviceOwnership(orgId, deviceIds);
      data.deviceIds = deviceIds ? JSON.stringify(deviceIds) : JSON.stringify([]);
    }

    if (dto.cron !== undefined) {
      data.cron = dto.cron;
      try {
        data.nextRunAt = calculateNextRunAt(dto.cron, now);
      } catch {
        throw new BadRequestException({
          statusCode: 400,
          error: 'INVALID_REPORT_SCHEDULE_CRON',
          code: 'INVALID_REPORT_SCHEDULE_CRON',
          message: 'The report schedule cron expression is invalid.',
        });
      }
    }

    if (dto.isEnabled !== undefined) {
      data.isEnabled = dto.isEnabled;
      if (dto.isEnabled && data.nextRunAt === undefined) {
        const existingNextRunAt = schedule.nextRunAt instanceof Date ? schedule.nextRunAt : null;
        if (!existingNextRunAt || existingNextRunAt <= now) {
          try {
            data.nextRunAt = calculateNextRunAt(dto.cron ?? schedule.cron, now);
          } catch {
            throw new BadRequestException({
              statusCode: 400,
              error: 'INVALID_REPORT_SCHEDULE_CRON',
              code: 'INVALID_REPORT_SCHEDULE_CRON',
              message: 'The report schedule cron expression is invalid.',
            });
          }
        }
      }
    }

    if (Object.keys(data).length === 0) {
      return scheduleToResponse(schedule);
    }

    const updated = await this.prisma.reportSchedule.update({ where: { id }, data });
    return scheduleToResponse(updated);
  }

  async deleteSchedule(id: string, orgId: string) {
    const result = await this.prisma.reportSchedule.deleteMany({ where: { id, orgId } });
    return result.count === 1;
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

    if (!scan) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: 'SECURITY_SCAN_REQUIRED',
        message: 'No completed security scan is available. Run a security scan before generating a Security Executive report.',
      });
    }

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
        status: d.lastSeenAt && Date.now() - d.lastSeenAt.getTime() < DEVICE_ONLINE_THRESHOLD_MS ? 'online' : 'offline',
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

  private async collectNetworkData(orgId: string): Promise<NetworkReportInput> {
    const latestScan = await this.prisma.networkScan.findFirst({
      where: { orgId },
      orderBy: { startedAt: 'desc' },
    });

    const devices = await this.prisma.networkDevice.findMany({
      where: { orgId },
      orderBy: { lastSeenAt: 'desc' },
    });

    const reachableDevices = devices.filter((d) => d.reachable);
    const reachableLatencies = reachableDevices.map((d) => d.latencyMs).filter((l): l is number => l !== null);
    const avgLatency = reachableLatencies.length > 0
      ? reachableLatencies.reduce((a, b) => a + b, 0) / reachableLatencies.length
      : null;

    return {
      scanDate: latestScan?.startedAt || new Date(),
      scanCount: latestScan ? 1 : 0,
      totalDevices: devices.length,
      reachableDevices: reachableDevices.length,
      unreachableDevices: devices.length - reachableDevices.length,
      subnet: latestScan?.subnet || null,
      gatewayIp: latestScan?.gatewayIp || null,
      avgLatencyMs: avgLatency,
      devices: devices.map((d) => ({
        ip: d.ip,
        hostname: d.hostname,
        vendor: d.vendor,
        reachable: d.reachable,
        latencyMs: d.latencyMs,
      })),
    };
  }

  private async collectInventoryData(orgId: string): Promise<InventoryReportInput> {
    const drivers = await this.prisma.driver.findMany({
      where: { orgId },
      orderBy: { name: 'asc' },
    });

    const software = await this.prisma.softwareInventory.findMany({
      where: { orgId },
      orderBy: { name: 'asc' },
    });

    return {
      totalDrivers: drivers.length,
      currentDrivers: drivers.filter((d) => d.status === 'current').length,
      outdatedDrivers: drivers.filter((d) => d.status === 'outdated').length,
      missingDrivers: drivers.filter((d) => d.status === 'missing').length,
      totalSoftware: software.length,
      driverList: drivers.map((d) => ({
        name: d.name,
        vendor: d.vendor,
        version: d.version,
        status: d.status,
      })),
      softwareList: software.map((s) => ({
        name: s.name,
        version: s.version,
        vendor: s.vendor,
      })),
    };
  }

  private async collectRemoteSupportData(orgId: string): Promise<RemoteSupportReportInput> {
    const sessions = await this.prisma.remoteSession.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const recordings = await this.prisma.remoteSession.findMany({
      where: { orgId, recordingPath: { not: null } },
    });

    const totalRecordingDuration = recordings.reduce((sum, r) => sum + (r.recordingDuration || 0), 0);

    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter((s) => s.status === 'active').length,
      endedSessions: sessions.filter((s) => s.status === 'ended').length,
      failedSessions: sessions.filter((s) => s.status === 'failed' || s.status === 'error').length,
      pendingSessions: sessions.filter((s) => s.status === 'pending').length,
      totalRecordings: recordings.length,
      totalRecordingDuration,
      recentSessions: sessions.slice(0, 20).map((s) => ({
        id: s.id,
        deviceId: s.deviceId,
        status: s.status,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        duration: s.startedAt && s.endedAt
          ? Math.floor((s.endedAt.getTime() - s.startedAt.getTime()) / 1000)
          : null,
      })),
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
      case 'network': return 'Network Report';
      case 'inventory': return 'Inventory Report';
      case 'remote_support': return 'Remote Support Report';
      default: return 'Report';
    }
  }
}
