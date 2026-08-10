import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { RegisterPublicDto } from '../enrollment/dto/register-public.dto';
import { MetricsPayloadDto } from './dto/metrics-payload.dto';
import { ScoringService } from './scoring.service';
import { AlertEvaluationService } from '../alerts/alert-evaluation.service';
import { AlertsGateway } from '../alerts/alerts.gateway';
import { QueueService } from '../queue/queue.service';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { getPlanConfig } from '../billing/plan-features';

const IDENTITY_VERSION = 1;
const DEVICE_TOKEN_BYTES = 32;
// Rotating a device whose stored verifier is null means the previous credential
// hash is unknowable (plaintext was never retained). This sentinel records that
// state in CredentialRotationEvent.oldTokenHash (NOT NULL). It is not a hash
// format (real verifiers are 64 hex chars), so it cannot collide with a token.
const ROTATION_LEGACY_SENTINEL = 'legacy-no-verifier';

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);

  constructor(
    private prisma: PrismaService,
    private scoring: ScoringService,
    private alertEval: AlertEvaluationService,
    private alertsGateway: AlertsGateway,
    private queueService: QueueService,
  ) {}

  async register(orgId: string, dto: RegisterDeviceDto) {
    const existing = await this.prisma.device.findFirst({
      where: { orgId, hostname: dto.hostname ?? dto.name },
    });
    if (existing) {
      return { device: existing, deviceToken: null as string | null };
    }

    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (org) {
      const planConfig = getPlanConfig(org.plan);
      const activeCount = await this.prisma.device.count({ where: { orgId, inactive: false } });
      if (activeCount >= planConfig.limits.maxDevices) {
        throw new ForbiddenException(
          `Device limit reached (${planConfig.limits.maxDevices} max on ${planConfig.label} plan). ` +
          `Upgrade to register more devices.`,
        );
      }
    }

    const deviceToken = this.generateSecureToken();
    const deviceTokenHash = this.hashToken(deviceToken);
    const device = await this.prisma.device.create({
      data: {
        orgId,
        name: dto.name,
        hostname: dto.hostname,
        os: dto.os ?? null,
        osVersion: dto.osVersion ?? null,
        cpuModel: dto.cpuModel?.trim() || null,
        cpuCores: dto.cpuCores ?? null,
        cpuLogical: dto.cpuLogical ?? null,
        ramTotal: dto.ramTotal ? BigInt(dto.ramTotal) : null,
        gpuInfo: dto.gpuInfo ?? null,
        diskTotal: dto.diskTotal ? BigInt(dto.diskTotal) : null,
        isLaptop: dto.isLaptop ?? false,
        deviceTokenHash,
        metadata: (dto.metadata as any) ?? undefined,
      },
    });

    return { device, deviceToken };
  }

  async registerPublic(orgId: string, dto: RegisterPublicDto) {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) {
      throw new BadRequestException('Invalid organization');
    }

    const planConfig = getPlanConfig(org.plan);
    const activeCount = await this.prisma.device.count({ where: { orgId, inactive: false } });
    if (activeCount >= planConfig.limits.maxDevices) {
      throw new ForbiddenException(
        `Device limit reached (${planConfig.limits.maxDevices} max on ${planConfig.label} plan).`,
      );
    }

    const existing = await this.findExistingDevice(orgId, dto);
    if (existing) {
      await this.enrichDeviceFromRegistration(existing.id, dto);

      const rotated = await this.rotateCredential(
        existing.id,
        existing.orgId,
        'duplicate_detected',
        { reason: 'duplicate_registration' },
      );

      const enrichedDevice = await this.prisma.device.findUnique({ where: { id: existing.id } });

      if (process.env.NODE_ENV !== 'production') {
        this.logger.log(
          `[DEV_REGISTER_ENRICH] deviceId=${existing.id} ` +
          `cpuModel=${enrichedDevice?.cpuModel ?? 'null'} ` +
          `cpuCores=${enrichedDevice?.cpuCores ?? 'null'} ` +
          `cpuLogical=${enrichedDevice?.cpuLogical ?? 'null'} ` +
          `source=registration`
        );
      }

      return { device: enrichedDevice ?? rotated.device, deviceToken: rotated.newToken, duplicate: true };
    }

    const deviceToken = this.generateSecureToken();
    const deviceTokenHash = this.hashToken(deviceToken);
    const device = await this.prisma.device.create({
      data: {
        orgId,
        name: dto.name,
        hostname: dto.hostname,
        os: dto.os ?? null,
        osVersion: dto.osVersion ?? null,
        cpuModel: dto.cpuModel?.trim() || null,
        cpuCores: dto.cpuCores ?? null,
        cpuLogical: dto.cpuLogical ?? null,
        ramTotal: dto.ramTotal ? BigInt(dto.ramTotal) : null,
        gpuInfo: dto.gpuInfo ?? null,
        diskTotal: dto.diskTotal ? BigInt(dto.diskTotal) : null,
        isLaptop: dto.isLaptop ?? false,
        deviceTokenHash,
        identityFingerprint: dto.identityFingerprint,
        installationId: dto.installationId ?? null,
        agentVersion: dto.agentVersion ?? null,
        identityVersion: dto.identityVersion ?? IDENTITY_VERSION,
        metadata: (dto.metadata as any) ?? undefined,
      },
    });

    return { device, deviceToken, duplicate: false };
  }

  private async enrichDeviceFromRegistration(deviceId: string, dto: RegisterPublicDto) {
    const updateData: Record<string, any> = {};

    if (dto.cpuModel != null && dto.cpuModel.trim() !== '') {
      updateData.cpuModel = dto.cpuModel.trim();
    }
    if (dto.cpuCores != null) {
      updateData.cpuCores = dto.cpuCores;
    }
    if (dto.cpuLogical != null) {
      updateData.cpuLogical = dto.cpuLogical;
    }
    if (dto.os != null && dto.os !== '') {
      updateData.os = dto.os;
    }
    if (dto.osVersion != null && dto.osVersion !== '') {
      updateData.osVersion = dto.osVersion;
    }
    if (dto.hostname != null && dto.hostname !== '') {
      updateData.hostname = dto.hostname;
    }
    if (dto.ramTotal != null) {
      updateData.ramTotal = BigInt(dto.ramTotal);
    }
    if (dto.diskTotal != null) {
      updateData.diskTotal = BigInt(dto.diskTotal);
    }
    if (dto.gpuInfo != null && dto.gpuInfo !== '') {
      updateData.gpuInfo = dto.gpuInfo;
    }

    if (Object.keys(updateData).length > 0) {
      await this.prisma.device.update({
        where: { id: deviceId },
        data: updateData,
      });
    }
  }

  private async findExistingDevice(orgId: string, dto: RegisterPublicDto) {
    if (dto.identityFingerprint) {
      const existing = await this.prisma.device.findFirst({
        where: { orgId, identityFingerprint: dto.identityFingerprint },
      });
      if (existing) return existing;
    }

    if (dto.installationId) {
      const existing = await this.prisma.device.findFirst({
        where: { orgId, installationId: dto.installationId },
      });
      if (existing) return existing;
    }

    const hostname = dto.hostname ?? dto.name;
    if (hostname) {
      const existing = await this.prisma.device.findFirst({
        where: { orgId, hostname },
      });
      if (existing) return existing;
    }

    return null;
  }

  async rotateCredential(
    deviceId: string,
    orgId: string,
    reason: string = 'rotation',
    metadata?: Record<string, any>,
  ): Promise<{ device: any; newToken: string }> {
    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, orgId },
    });
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    const oldTokenHash = device.deviceTokenHash ?? ROTATION_LEGACY_SENTINEL;
    const newToken = this.generateSecureToken();
    const newTokenHash = this.hashToken(newToken);

    const updated = await this.prisma.device.update({
      where: { id: deviceId },
      data: {
        deviceTokenHash: newTokenHash,
        credentialVersion: { increment: 1 },
        lastRegisteredAt: new Date(),
      },
    });

    await this.prisma.credentialRotationEvent.create({
      data: {
        deviceId,
        orgId,
        oldTokenHash,
        newTokenHash,
        reason,
        metadata: (metadata as any) ?? undefined,
      },
    });

    return { device: updated, newToken };
  }

  async findByToken(token: string) {
    const tokenHash = this.hashToken(token);
    return this.prisma.device.findFirst({
      where: { deviceTokenHash: tokenHash },
    });
  }

  async findByOrg(orgId: string) {
    return this.prisma.device.findMany({
      where: { orgId },
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  async findById(id: string, orgId: string) {
    const device = await this.prisma.device.findFirst({
      where: { id, orgId },
    });
    if (!device) throw new NotFoundException('Device not found');
    return device;
  }

  async ingestMetrics(deviceId: string, orgId: string, dto: MetricsPayloadDto) {
    const metric = await this.prisma.deviceMetric.create({
      data: {
        deviceId,
        orgId,
        recordedAt: dto.timestamp ? new Date(dto.timestamp) : new Date(),
        cpuUsage: dto.cpu?.usage ?? 0,
        ramUsed: dto.memory?.used ? BigInt(Math.round(dto.memory.used)) : BigInt(0),
        ramTotal: dto.memory?.total ? BigInt(Math.round(dto.memory.total)) : BigInt(1),
        ramPercent: dto.memory?.percent ?? 0,
        diskUsed: dto.disk?.used ? BigInt(Math.round(dto.disk.used)) : null,
        diskTotal: dto.disk?.total ? BigInt(Math.round(dto.disk.total)) : null,
        diskReadBytes: dto.disk?.readBytes ? BigInt(dto.disk.readBytes) : null,
        diskWriteBytes: dto.disk?.writeBytes ? BigInt(dto.disk.writeBytes) : null,
        diskSmartStatus: dto.disk?.smartStatus ?? null,
        diskSmartReallocatedSectors: dto.disk?.smartReallocatedSectors ?? null,
        diskSmartTemperature: dto.disk?.smartTemperature ?? null,
        gpuUsage: dto.gpu?.usage ?? null,
        gpuTemp: dto.gpu?.temp ?? null,
        gpuMemoryUsed: dto.gpu?.memoryUsed ? BigInt(dto.gpu.memoryUsed) : null,
        batteryPercent: dto.battery?.percent ?? null,
        batteryStatus: dto.battery?.status ?? null,
        tempCpu: dto.temperatures?.cpu ?? null,
        tempGpu: dto.temperatures?.gpu ?? null,
        tempMotherboard: dto.temperatures?.motherboard ?? null,
        fanRpm: dto.fans?.rpm ?? null,
        networkRxBytes: dto.network?.rxBytes ? BigInt(dto.network.rxBytes) : null,
        networkTxBytes: dto.network?.txBytes ? BigInt(dto.network.txBytes) : null,
        loadAverage1Min: dto.cpu?.loadAverage1Min ?? null,
        loadAverage5Min: dto.cpu?.loadAverage5Min ?? null,
        loadAverage15Min: dto.cpu?.loadAverage15Min ?? null,
        processes: dto.processes ?? null,
        uptime: dto.uptime ? BigInt(dto.uptime) : null,
        serviceChecks: dto.services ? dto.services as any : Prisma.JsonNull,
      },
    });

    await this.prisma.device.update({
      where: { id: deviceId },
      data: { lastSeenAt: new Date() },
    });

    const scores = this.scoring.computeAll({
      cpuUsage: dto.cpu?.usage ?? 0,
      ramPercent: dto.memory?.percent ?? 0,
      diskUsed: dto.disk?.used ?? null,
      diskTotal: dto.disk?.total ?? null,
      tempCpu: dto.temperatures?.cpu ?? null,
      smartStatus: dto.disk?.smartStatus ?? null,
      loadAverage1Min: dto.cpu?.loadAverage1Min ?? null,
      processes: dto.processes ?? null,
      batteryPercent: dto.battery?.percent ?? null,
    });

    const scoreRecord = await this.prisma.deviceHealthScore.create({
      data: {
        deviceId,
        orgId,
        ...scores,
      },
    });

    const alerts: any[] = [];
    try {
      const diskPercent = metric.diskTotal && metric.diskTotal > BigInt(0) && metric.diskUsed != null
        ? Number((metric.diskUsed * BigInt(100)) / metric.diskTotal) : null;

      const triggeredAlerts = await this.alertEval.evaluateMetrics(deviceId, orgId, {
        deviceId,
        orgId,
        cpuUsage: dto.cpu?.usage ?? 0,
        ramPercent: dto.memory?.percent ?? 0,
        diskPercent,
        tempCpu: dto.temperatures?.cpu ?? null,
        loadAverage1Min: dto.cpu?.loadAverage1Min ?? null,
        processes: dto.processes ?? null,
        services: dto.services ?? null,
        healthScore: scores.healthScore,
        performanceScore: scores.performanceScore,
        riskScore: scores.riskScore,
      });

      for (const alert of triggeredAlerts) {
        alerts.push(alert);
        this.alertsGateway.broadcastAlert(orgId, alert);

        const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
        const rule = await this.prisma.alertRule.findUnique({ where: { id: alert.alertRuleId } });
        if (rule) {
          this.queueService.addAlertNotification({
            alert,
            rule,
            deviceName: device?.name ?? deviceId,
            orgId,
          }).catch((e) =>
            console.error('Alert queue job failed:', e),
          );
        }
      }
    } catch (err) {
      console.error('Alert evaluation error:', err);
    }

    return { metric, score: scoreRecord, alerts };
  }

  async getMetrics(deviceId: string, orgId: string, minutes = 60, limit = 100) {
    const since = new Date(Date.now() - minutes * 60_000);
    return this.prisma.deviceMetric.findMany({
      where: {
        deviceId,
        orgId,
        recordedAt: { gte: since },
      },
      orderBy: { recordedAt: 'asc' },
      take: limit,
    });
  }

  async getLatestScores(deviceId: string, orgId: string) {
    const score = await this.prisma.deviceHealthScore.findFirst({
      where: { deviceId, orgId },
      orderBy: { calculatedAt: 'desc' },
    });
    return score;
  }

  async getLatestMetrics(deviceId: string, orgId: string) {
    const metric = await this.prisma.deviceMetric.findFirst({
      where: { deviceId, orgId },
      orderBy: { recordedAt: 'desc' },
    });
    return metric;
  }

  async findFirstOrNull(where: any): Promise<any> {
    return this.prisma.device.findFirst({ where });
  }

  generateSecureToken(): string {
    return crypto.randomBytes(DEVICE_TOKEN_BYTES).toString('hex');
  }

  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
