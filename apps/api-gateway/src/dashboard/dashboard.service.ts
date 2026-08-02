import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { classifyFreshness, isDeviceOnline } from '../devices/device-presence';
import {
  DashboardSummaryResponse,
  SeverityCounts,
  emptyFreshnessCounts,
  emptySeverityCounts,
} from './dashboard.types';
import { normalizeSeverity } from './severity-normalization';
import { worstRiskLevel } from './worst-risk-level';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getSummary(orgId: string): Promise<DashboardSummaryResponse> {
    const now = new Date();
    const since24h = new Date(now.getTime() - TWENTY_FOUR_HOURS_MS);
    const since30d = new Date(now.getTime() - THIRTY_DAYS_MS);

    const [
      devices,
      alertGroups,
      findingGroups,
      latestRiskScores,
      scannedScans,
      lastCompletedScan,
      healthScores,
      backupRunning,
      backupPending,
      backupFailed24h,
      backupCompleted24h,
      lastCompletedRun,
      nextScheduledJob,
      scanRunning,
      scanPending,
      scanFailed24h,
      scanCompleted24h,
      reportGenerating,
      reportFailed,
      reportCompleted,
      reportLast30d,
      teamTotal,
    ] = await Promise.all([
      this.prisma.device.findMany({
        where: { orgId },
        select: { id: true, name: true, hostname: true, os: true, lastSeenAt: true },
        orderBy: { lastSeenAt: 'desc' },
      }),
      this.prisma.alert.groupBy({
        by: ['severity'],
        where: { orgId, acknowledgedAt: null },
        _count: { _all: true },
      }),
      this.prisma.securityFinding.groupBy({
        by: ['severity'],
        where: { orgId, status: 'open' },
        _count: { _all: true },
      }),
      this.prisma.securityScore.findMany({
        where: { orgId },
        orderBy: { calculatedAt: 'desc' },
        distinct: ['deviceId'],
        select: { riskLevel: true },
      }),
      this.prisma.securityScan.findMany({
        where: { orgId, status: 'completed' },
        distinct: ['deviceId'],
        select: { deviceId: true },
      }),
      this.prisma.securityScan.findFirst({
        where: { orgId, status: 'completed', completedAt: { not: null } },
        orderBy: { completedAt: 'desc' },
        select: { completedAt: true, startedAt: true },
      }),
      this.prisma.deviceHealthScore.findMany({
        where: { orgId },
        orderBy: { calculatedAt: 'desc' },
        distinct: ['deviceId'],
        select: { healthScore: true },
      }),
      this.prisma.backupRun.count({ where: { orgId, status: 'running' } }),
      this.prisma.backupRun.count({ where: { orgId, status: 'pending' } }),
      this.prisma.backupRun.count({
        where: { orgId, status: 'failed', startedAt: { gte: since24h } },
      }),
      this.prisma.backupRun.count({
        where: { orgId, status: 'completed', startedAt: { gte: since24h } },
      }),
      this.prisma.backupRun.findFirst({
        where: { orgId, status: 'completed', completedAt: { not: null } },
        orderBy: { completedAt: 'desc' },
        include: { job: { select: { name: true } } },
      }),
      this.prisma.backupJob.findFirst({
        where: { orgId, isEnabled: true, nextRunAt: { not: null } },
        orderBy: { nextRunAt: 'asc' },
        select: { nextRunAt: true },
      }),
      this.prisma.securityScan.count({ where: { orgId, status: 'running' } }),
      this.prisma.securityScan.count({ where: { orgId, status: 'pending' } }),
      this.prisma.securityScan.count({
        where: { orgId, status: 'failed', startedAt: { gte: since24h } },
      }),
      this.prisma.securityScan.count({
        where: { orgId, status: 'completed', startedAt: { gte: since24h } },
      }),
      this.prisma.report.count({ where: { orgId, status: 'generating' } }),
      this.prisma.report.count({ where: { orgId, status: 'failed' } }),
      this.prisma.report.count({ where: { orgId, status: 'completed' } }),
      this.prisma.report.count({
        where: { orgId, status: 'completed', createdAt: { gte: since30d } },
      }),
      this.prisma.user.count({ where: { orgId } }),
    ]);

    const onlineDevices: string[] = [];
    const freshness = emptyFreshnessCounts();
    for (const device of devices) {
      const band = classifyFreshness(device.lastSeenAt, now);
      freshness[band] += 1;
      if (isDeviceOnline(device.lastSeenAt, now)) {
        onlineDevices.push(device.id);
      }
    }

    const bySeverity = emptySeverityCounts();
    let unacknowledgedAlerts = 0;
    for (const group of alertGroups) {
      const count = group._count._all;
      unacknowledgedAlerts += count;
      bySeverity[normalizeSeverity(group.severity)] += count;
    }

    const openFindings = { critical: 0, high: 0, medium: 0, low: 0 };
    let openFindingsTotal = 0;
    for (const group of findingGroups) {
      const count = group._count._all;
      openFindingsTotal += count;
      const bucket = normalizeSeverity(group.severity);
      if (bucket === 'critical' || bucket === 'high' || bucket === 'medium' || bucket === 'low') {
        openFindings[bucket] += count;
      }
    }

    const scannedDeviceIds = new Set(scannedScans.map((scan) => scan.deviceId));
    const scannedOnlineCount = onlineDevices.filter((id) => scannedDeviceIds.has(id)).length;
    const onlineCount = onlineDevices.length;
    const coveragePercent =
      onlineCount === 0 ? null : Math.round((scannedOnlineCount / onlineCount) * 100);

    const lastScanTimestamp = lastCompletedScan
      ? (lastCompletedScan.completedAt ?? lastCompletedScan.startedAt)
      : null;
    const latestScanAgesDays =
      lastScanTimestamp === null
        ? null
        : Math.max(0, Math.floor((now.getTime() - lastScanTimestamp.getTime()) / DAY_MS));

    const healthScoreSum = healthScores.reduce((sum, score) => sum + score.healthScore, 0);
    const deviceHealth =
      healthScores.length === 0
        ? null
        : Math.round(healthScoreSum / healthScores.length);

    return {
      generatedAt: now.toISOString(),
      fleet: {
        total: devices.length,
        online: onlineCount,
        offline: devices.length - onlineCount,
        freshness,
        deviceHealth,
        recentDevices: devices.slice(0, 8).map((device) => ({
          id: device.id,
          name: device.name,
          hostname: device.hostname,
          os: device.os,
          lastSeenAt: device.lastSeenAt ? device.lastSeenAt.toISOString() : null,
        })),
      },
      alerts: {
        unacknowledged: unacknowledgedAlerts,
        bySeverity: bySeverity as SeverityCounts,
      },
      security: {
        openFindings: {
          critical: openFindings.critical,
          high: openFindings.high,
          medium: openFindings.medium,
          low: openFindings.low,
          total: openFindingsTotal,
        },
        worstRiskLevel: worstRiskLevel(latestRiskScores.map((score) => score.riskLevel)),
        scanCoverage: {
          scannedDevices: scannedDeviceIds.size,
          onlineDevices: onlineCount,
          coveragePercent,
          lastScanAt: lastScanTimestamp ? lastScanTimestamp.toISOString() : null,
        },
        unscannedOnlineDevices: onlineCount - scannedOnlineCount,
        latestScanAgesDays,
      },
      operations: {
        backups: {
          running: backupRunning,
          pending: backupPending,
          failedLast24h: backupFailed24h,
          completedLast24h: backupCompleted24h,
          lastCompletedAt: lastCompletedRun?.completedAt
            ? lastCompletedRun.completedAt.toISOString()
            : null,
          lastCompletedJobName: lastCompletedRun?.job?.name ?? null,
          nextScheduledAt: nextScheduledJob?.nextRunAt
            ? nextScheduledJob.nextRunAt.toISOString()
            : null,
        },
        scans: {
          running: scanRunning,
          pending: scanPending,
          failedLast24h: scanFailed24h,
          completedLast24h: scanCompleted24h,
        },
        reports: {
          generating: reportGenerating,
          failed: reportFailed,
          completed: reportCompleted,
          generatedLast30d: reportLast30d,
        },
      },
      team: {
        total: teamTotal,
      },
    };
  }
}
