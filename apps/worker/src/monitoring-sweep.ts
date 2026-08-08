import { PrismaClient } from '@prisma/client';
import { derivePresenceState } from './presence-state';

export const ALERT_STATUS_OPEN = 'OPEN';
export const ALERT_STATUS_ACKNOWLEDGED = 'ACKNOWLEDGED';
export const ALERT_STATUS_RESOLVED = 'RESOLVED';
export const ALERT_SOURCE_PRESENCE = 'presence';
export const ALERT_SOURCE_METRIC = 'metric';

export function buildActiveKey(alertRuleId: string, deviceId: string): string {
  return `${alertRuleId}:${deviceId}`;
}

export interface AlertNotificationPayload {
  alert: {
    id: string;
    severity: string;
    message: string;
    metricValue: number;
  };
  rule: {
    id: string;
    name: string;
    webhookUrl: string | null;
  };
  deviceName: string;
  orgId: string;
}

export interface PresenceSweepResult {
  orgsProcessed: number;
  devicesEvaluated: number;
  presenceAlertsCreated: number;
  presenceAlertsRefreshed: number;
  legacyDuplicatesPromoted: number;
  presenceAlertsResolved: number;
  metricAlertsResolved: number;
  notificationsQueued: number;
}

export interface MonitoringSweepDeps {
  now?: Date;
  notify?: (payload: AlertNotificationPayload) => Promise<void>;
}

interface MetricSnapshot {
  cpuUsage: number;
  ramPercent: number;
  diskPercent: number | null;
  tempCpu: number | null;
  loadAverage1Min: number | null;
  processes: number | null;
  healthScore: number | null;
  performanceScore: number | null;
  riskScore: number | null;
}

const ACTIVE_STATUSES = [ALERT_STATUS_OPEN, ALERT_STATUS_ACKNOWLEDGED];

function emptyResult(): PresenceSweepResult {
  return {
    orgsProcessed: 0,
    devicesEvaluated: 0,
    presenceAlertsCreated: 0,
    presenceAlertsRefreshed: 0,
    legacyDuplicatesPromoted: 0,
    presenceAlertsResolved: 0,
    metricAlertsResolved: 0,
    notificationsQueued: 0,
  };
}

async function resolveAlertIds(
  prisma: PrismaClient,
  ids: string[],
  now: Date,
): Promise<void> {
  if (ids.length === 0) return;
  await prisma.alert.updateMany({
    where: { id: { in: ids } },
    data: { status: ALERT_STATUS_RESOLVED, resolvedAt: now, activeKey: null },
  });
}

function buildPresenceMessage(ruleName: string, deviceName: string, minutesOffline: number): string {
  return `Presence: device ${deviceName} is OFFLINE (no heartbeat for ${minutesOffline} minutes)`;
}

export function extractMetricValue(metricName: string, metric: MetricSnapshot): number | null {
  switch (metricName) {
    case 'cpuUsage': return metric.cpuUsage;
    case 'ramPercent': return metric.ramPercent;
    case 'diskPercent': return metric.diskPercent;
    case 'tempCpu': return metric.tempCpu;
    case 'loadAverage1Min': return metric.loadAverage1Min;
    case 'processes': return metric.processes != null ? metric.processes : null;
    case 'healthScore': return metric.healthScore != null ? metric.healthScore : null;
    case 'performanceScore': return metric.performanceScore != null ? metric.performanceScore : null;
    case 'riskScore': return metric.riskScore != null ? metric.riskScore : null;
    default: return null;
  }
}

export function evaluateThreshold(value: number, threshold: number, operator: string): boolean {
  switch (operator) {
    case 'gt': return value > threshold;
    case 'lt': return value < threshold;
    case 'gte': return value >= threshold;
    case 'lte': return value <= threshold;
    case 'eq': return value === threshold;
    default: return false;
  }
}

async function buildMetricSnapshot(
  prisma: PrismaClient,
  orgId: string,
  deviceId: string,
): Promise<MetricSnapshot> {
  const metric = await prisma.deviceMetric.findFirst({
    where: { deviceId, orgId },
    orderBy: { recordedAt: 'desc' },
  });
  const score = await prisma.deviceHealthScore.findFirst({
    where: { deviceId, orgId },
    orderBy: { calculatedAt: 'desc' },
  });

  let diskPercent: number | null = null;
  if (metric && metric.diskTotal && metric.diskTotal > BigInt(0) && metric.diskUsed != null) {
    diskPercent = Number((metric.diskUsed * BigInt(100)) / metric.diskTotal);
  }

  return {
    cpuUsage: metric?.cpuUsage ?? 0,
    ramPercent: metric?.ramPercent ?? 0,
    diskPercent,
    tempCpu: metric?.tempCpu ?? null,
    loadAverage1Min: metric?.loadAverage1Min ?? null,
    processes: metric?.processes ?? null,
    healthScore: score?.healthScore ?? null,
    performanceScore: score?.performanceScore ?? null,
    riskScore: score?.riskScore ?? null,
  };
}

async function autoResolveMetricAlerts(
  prisma: PrismaClient,
  now: Date,
  result: PresenceSweepResult,
): Promise<void> {
  const activeAlerts = await prisma.alert.findMany({
    where: { source: ALERT_SOURCE_METRIC, status: { in: ACTIVE_STATUSES } },
    select: { id: true, orgId: true, deviceId: true, alertRuleId: true },
  });

  for (const alert of activeAlerts) {
    const rule = await prisma.alertRule.findUnique({ where: { id: alert.alertRuleId } });
    if (!rule || !rule.enabled) {
      await resolveAlertIds(prisma, [alert.id], now);
      result.metricAlertsResolved += 1;
      continue;
    }

    const snapshot = await buildMetricSnapshot(prisma, alert.orgId, alert.deviceId);
    const value = extractMetricValue(rule.metricName, snapshot);
    const breached = value !== null && evaluateThreshold(value, rule.threshold, rule.operator);

    if (!breached) {
      await resolveAlertIds(prisma, [alert.id], now);
      result.metricAlertsResolved += 1;
    }
  }
}

/**
 * Runs the monitoring sweep. Evaluates presence rules against device heartbeat
 * freshness, opening deduped OFFLINE alerts and auto-resolving alerts when the
 * device is reachable again. Also auto-resolves OPEN metric alerts whose
 * triggering condition has cleared, and reconciles legacy unresolved duplicate
 * alerts (NULL activeKey) into a single active alert per (rule, device).
 */
export async function runMonitoringSweep(
  prisma: PrismaClient,
  deps: MonitoringSweepDeps = {},
): Promise<PresenceSweepResult> {
  const now = deps.now ?? new Date();
  const notify = deps.notify ?? (async () => {});
  const result = emptyResult();

  const presenceRules = await prisma.alertRule.findMany({
    where: { enabled: true, kind: 'presence' },
    select: {
      id: true,
      orgId: true,
      name: true,
      threshold: true,
      severity: true,
      webhookUrl: true,
    },
  });

  const orgIds = [...new Set(presenceRules.map((r) => r.orgId))];
  result.orgsProcessed = orgIds.length;

  for (const orgId of orgIds) {
    const devices = await prisma.device.findMany({
      where: { orgId },
      select: { id: true, name: true, hostname: true, lastSeenAt: true },
    });
    const rulesForOrg = presenceRules.filter((r) => r.orgId === orgId);

    for (const device of devices) {
      result.devicesEvaluated += rulesForOrg.length;
      const presence = derivePresenceState(device.lastSeenAt, now);

      for (const rule of rulesForOrg) {
        const activeKey = buildActiveKey(rule.id, device.id);
        const isOffline = presence === 'OFFLINE';

        const activeAlert = await prisma.alert.findFirst({
          where: { orgId, activeKey, status: { in: ACTIVE_STATUSES } },
          select: { id: true },
        });
        const legacyAlerts = await prisma.alert.findMany({
          where: {
            orgId,
            alertRuleId: rule.id,
            deviceId: device.id,
            activeKey: null,
            status: { in: ACTIVE_STATUSES },
          },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });

        if (isOffline) {
          const lastSeen = device.lastSeenAt ? device.lastSeenAt.getTime() : now.getTime();
          const minutesOffline = Math.max(0, Math.floor((now.getTime() - lastSeen) / 60000));
          const message = buildPresenceMessage(rule.name, device.name ?? device.hostname ?? device.id, minutesOffline);
          const deviceName = device.name ?? device.hostname ?? device.id;

          if (activeAlert) {
            await prisma.alert.update({
              where: { id: activeAlert.id },
              data: {
                metricValue: minutesOffline,
                threshold: rule.threshold,
                severity: rule.severity,
                message,
                lastDetectedAt: now,
              },
            });
            result.presenceAlertsRefreshed += 1;
            if (legacyAlerts.length > 0) {
              await resolveAlertIds(prisma, legacyAlerts.map((a) => a.id), now);
              result.presenceAlertsResolved += legacyAlerts.length;
            }
          } else if (legacyAlerts.length > 0) {
            const [oldest, ...rest] = legacyAlerts;
            await prisma.alert.update({
              where: { id: oldest.id },
              data: {
                activeKey,
                metricValue: minutesOffline,
                threshold: rule.threshold,
                severity: rule.severity,
                message,
                lastDetectedAt: now,
              },
            });
            await resolveAlertIds(prisma, rest.map((a) => a.id), now);
            result.legacyDuplicatesPromoted += 1;
            result.presenceAlertsResolved += rest.length;
            await notify({
              alert: { id: oldest.id, severity: rule.severity, message, metricValue: minutesOffline },
              rule: { id: rule.id, name: rule.name, webhookUrl: rule.webhookUrl },
              deviceName,
              orgId,
            });
            result.notificationsQueued += 1;
          } else {
            const alert = await prisma.alert.create({
              data: {
                orgId,
                alertRuleId: rule.id,
                deviceId: device.id,
                metricValue: minutesOffline,
                threshold: rule.threshold,
                severity: rule.severity,
                message,
                status: ALERT_STATUS_OPEN,
                source: ALERT_SOURCE_PRESENCE,
                activeKey,
                lastDetectedAt: now,
              },
            });
            result.presenceAlertsCreated += 1;
            await notify({
              alert: { id: alert.id, severity: alert.severity, message: alert.message, metricValue: alert.metricValue },
              rule: { id: rule.id, name: rule.name, webhookUrl: rule.webhookUrl },
              deviceName,
              orgId,
            });
            result.notificationsQueued += 1;
          }
        } else {
          if (activeAlert) {
            await resolveAlertIds(prisma, [activeAlert.id], now);
            result.presenceAlertsResolved += 1;
          }
          if (legacyAlerts.length > 0) {
            await resolveAlertIds(prisma, legacyAlerts.map((a) => a.id), now);
            result.presenceAlertsResolved += legacyAlerts.length;
          }
        }
      }
    }
  }

  await autoResolveMetricAlerts(prisma, now, result);

  return result;
}
