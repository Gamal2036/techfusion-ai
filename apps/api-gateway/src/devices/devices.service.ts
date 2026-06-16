import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { MetricsPayloadDto } from './dto/metrics-payload.dto';
import { ScoringService } from './scoring.service';
import * as crypto from 'crypto';

@Injectable()
export class DevicesService {
  constructor(
    private prisma: PrismaService,
    private scoring: ScoringService,
  ) {}

  async register(orgId: string, dto: RegisterDeviceDto) {
    const existing = await this.prisma.device.findFirst({
      where: { orgId, hostname: dto.hostname ?? dto.name },
    });
    if (existing) {
      return existing;
    }

    const deviceToken = crypto.randomUUID();
    const device = await this.prisma.device.create({
      data: {
        orgId,
        name: dto.name,
        hostname: dto.hostname,
        os: dto.os ?? null,
        osVersion: dto.osVersion ?? null,
        cpuModel: dto.cpuModel ?? null,
        cpuCores: dto.cpuCores ?? null,
        cpuLogical: dto.cpuLogical ?? null,
        ramTotal: dto.ramTotal ? BigInt(dto.ramTotal) : null,
        gpuInfo: dto.gpuInfo ?? null,
        diskTotal: dto.diskTotal ? BigInt(dto.diskTotal) : null,
        isLaptop: dto.isLaptop ?? false,
        deviceToken,
        metadata: (dto.metadata as any) ?? undefined,
      },
    });

    return device;
  }

  async findByToken(token: string) {
    return this.prisma.device.findUnique({ where: { deviceToken: token } });
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
      },
    });

    // Update lastSeenAt
    await this.prisma.device.update({
      where: { id: deviceId },
      data: { lastSeenAt: new Date() },
    });

    // Compute scores
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

    return { metric, score: scoreRecord };
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
}
