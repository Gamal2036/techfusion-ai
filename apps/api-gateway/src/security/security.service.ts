import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScoreResult } from './services/security-scoring.service';
import { FindingDto } from './dto/submit-findings.dto';

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findDeviceByToken(token: string) {
    return this.prisma.device.findUnique({ where: { deviceToken: token } });
  }

  async createScan(
    device: { id: string; orgId: string; name: string; hostname: string | null },
    findings: FindingDto[],
    scoreResult: ScoreResult,
  ) {
    const scan = await this.prisma.securityScan.create({
      data: {
        orgId: device.orgId,
        deviceId: device.id,
        status: 'completed',
        triggeredBy: 'agent',
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });

    const findingRecords = [];
    for (const f of findings) {
      const rec = await this.prisma.securityFinding.create({
        data: {
          scanId: scan.id,
          orgId: device.orgId,
          deviceId: device.id,
          category: f.category,
          finding: f.finding,
          severity: f.severity,
          status: 'open',
          remediation: f.remediation,
          details: (f.details as any) || undefined,
        },
      });
      findingRecords.push(rec);
    }

    const score = await this.prisma.securityScore.create({
      data: {
        scanId: scan.id,
        orgId: device.orgId,
        deviceId: device.id,
        securityScore: scoreResult.securityScore,
        riskLevel: scoreResult.riskLevel,
        totalFindings: scoreResult.totalFindings,
        criticalCount: scoreResult.criticalCount,
        highCount: scoreResult.highCount,
        mediumCount: scoreResult.mediumCount,
        lowCount: scoreResult.lowCount,
      },
    });

    this.logger.log(
      `Security scan ${scan.id} for device ${device.id}: score=${scoreResult.securityScore}, risk=${scoreResult.riskLevel}, findings=${scoreResult.totalFindings}`,
    );

    return {
      scanId: scan.id,
      scoreId: score.id,
      score: scoreResult,
    };
  }

  async createPendingScan(deviceId: string, orgId: string) {
    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, orgId },
    });

    if (!device) {
      throw new Error('Device not found in this organization');
    }

    const scan = await this.prisma.securityScan.create({
      data: {
        orgId,
        deviceId,
        status: 'pending',
        triggeredBy: 'user',
      },
    });

    this.logger.log(`Pending security scan ${scan.id} triggered for device ${deviceId}`);
    return scan;
  }

  async getLatestScan(deviceId: string, orgId: string) {
    const scan = await this.prisma.securityScan.findFirst({
      where: { deviceId, orgId, status: 'completed' },
      orderBy: { completedAt: 'desc' },
      include: {
        findings: { orderBy: { severity: 'asc' } },
        score: true,
      },
    });

    if (!scan) return null;

    return {
      id: scan.id,
      status: scan.status,
      startedAt: scan.startedAt,
      completedAt: scan.completedAt,
      findings: scan.findings,
      score: scan.score,
    };
  }

  async listScans(deviceId: string, orgId: string, limit: number) {
    const scans = await this.prisma.securityScan.findMany({
      where: { deviceId, orgId },
      orderBy: { startedAt: 'desc' },
      take: limit,
      include: {
        score: true,
        _count: { select: { findings: true } },
      },
    });

    return scans.map((s) => ({
      id: s.id,
      status: s.status,
      startedAt: s.startedAt,
      completedAt: s.completedAt,
      findingCount: s._count.findings,
      score: s.score,
    }));
  }

  async getScanDetail(scanId: string, orgId: string) {
    return this.prisma.securityScan.findFirst({
      where: { id: scanId, orgId },
      include: {
        findings: { orderBy: { severity: 'asc' } },
        score: true,
      },
    });
  }

  async remediateFinding(findingId: string, orgId: string) {
    const finding = await this.prisma.securityFinding.findFirst({
      where: { id: findingId, orgId },
    });

    if (!finding) return null;

    return this.prisma.securityFinding.update({
      where: { id: findingId },
      data: {
        status: 'remediated',
        remediatedAt: new Date(),
      },
    });
  }

  async getExecutiveSummaryData(deviceId: string, orgId: string) {
    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, orgId },
    });

    if (!device) return null;

    const latestScan = await this.prisma.securityScan.findFirst({
      where: { deviceId, orgId, status: 'completed' },
      orderBy: { completedAt: 'desc' },
      include: {
        score: true,
        findings: {
          where: { status: 'open' },
          orderBy: { severity: 'asc' },
          take: 20,
        },
      },
    });

    if (!latestScan || !latestScan.score) return null;

    return {
      deviceName: device.name,
      deviceHostname: device.hostname,
      securityScore: latestScan.score.securityScore,
      riskLevel: latestScan.score.riskLevel,
      totalFindings: latestScan.score.totalFindings,
      criticalCount: latestScan.score.criticalCount,
      highCount: latestScan.score.highCount,
      mediumCount: latestScan.score.mediumCount,
      lowCount: latestScan.score.lowCount,
      scanDate: latestScan.completedAt || latestScan.startedAt,
      findings: latestScan.findings.map((f) => ({
        finding: f.finding,
        severity: f.severity,
        remediation: f.remediation,
      })),
    };
  }
}
