import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const ALERT_STATUS_OPEN = 'OPEN';
export const ALERT_STATUS_ACKNOWLEDGED = 'ACKNOWLEDGED';
export const ALERT_STATUS_RESOLVED = 'RESOLVED';
export const ALERT_SOURCE_METRIC = 'metric';
export const ALERT_SOURCE_PRESENCE = 'presence';

export interface MetricSnapshot {
  deviceId: string;
  orgId: string;
  cpuUsage: number;
  ramPercent: number;
  diskPercent: number | null;
  tempCpu: number | null;
  loadAverage1Min: number | null;
  processes: number | null;
  services: { name: string; status: string }[] | null;
  healthScore?: number | null;
  performanceScore?: number | null;
  riskScore?: number | null;
}

/**
 * Builds the DB-level dedup key for an alert.  A non-null activeKey is unique,
 * so at most one OPEN/ACKNOWLEDGED alert can exist per (alertRuleId, deviceId).
 * RESOLVED alerts clear activeKey and never collide.
 */
export function buildActiveKey(alertRuleId: string, deviceId: string): string {
  return `${alertRuleId}:${deviceId}`;
}

@Injectable()
export class AlertEvaluationService {
  private readonly logger = new Logger(AlertEvaluationService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Evaluate the enabled metric rules for a device against the latest snapshot.
   *
   * Dedup semantics: a sustained breach produces exactly one OPEN alert per
   * (org, device, rule).  When an OPEN/ACKNOWLEDGED alert already exists it is
   * refreshed (metricValue, severity, lastDetectedAt) instead of creating a
   * duplicate.  A resolved alert means the condition cleared, so a re-breach
   * opens a brand new alert.
   *
   * Returns ONLY the newly created alerts so callers notify/broadcast exactly
   * once per incident, not on every re-detection.
   */
  async evaluateMetrics(deviceId: string, orgId: string, metric: MetricSnapshot): Promise<any[]> {
    const rules = await this.prisma.alertRule.findMany({
      where: { orgId, enabled: true, kind: 'metric' },
    });

    const createdAlerts: any[] = [];

    for (const rule of rules) {
      const value = this.extractMetricValue(rule.metricName, metric);
      if (value === null || value === undefined) continue;

      const breached = this.evaluateThreshold(value, rule.threshold, rule.operator);
      if (!breached) continue;

      const activeKey = buildActiveKey(rule.id, deviceId);
      const now = new Date();
      const message = this.buildAlertMessage(rule, deviceId, value);

      const existing = await this.prisma.alert.findFirst({
        where: { orgId, activeKey },
        select: { id: true },
      });

      if (existing) {
        await this.prisma.alert.update({
          where: { id: existing.id },
          data: {
            metricValue: value,
            threshold: rule.threshold,
            severity: rule.severity,
            message,
            lastDetectedAt: now,
          },
        });
        continue;
      }

      try {
        const alert = await this.prisma.alert.create({
          data: {
            orgId,
            alertRuleId: rule.id,
            deviceId,
            metricValue: value,
            threshold: rule.threshold,
            severity: rule.severity,
            message,
            status: ALERT_STATUS_OPEN,
            source: ALERT_SOURCE_METRIC,
            activeKey,
            lastDetectedAt: now,
          },
        });

        this.logger.log(`Alert created: ${alert.id} - ${message}`);
        createdAlerts.push(alert);
      } catch (err: any) {
        // Unique constraint race (parallel instance opened it first): refresh it.
        if (err?.code === 'P2002') {
          const raced = await this.prisma.alert.findFirst({
            where: { orgId, activeKey },
            select: { id: true },
          });
          if (raced) {
            await this.prisma.alert.update({
              where: { id: raced.id },
              data: {
                metricValue: value,
                threshold: rule.threshold,
                severity: rule.severity,
                message,
                lastDetectedAt: now,
              },
            });
          }
        } else {
          throw err;
        }
      }
    }

    return createdAlerts;
  }

  private extractMetricValue(metricName: string, metric: MetricSnapshot): number | null {
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

  private evaluateThreshold(value: number, threshold: number, operator: string): boolean {
    switch (operator) {
      case 'gt': return value > threshold;
      case 'lt': return value < threshold;
      case 'gte': return value >= threshold;
      case 'lte': return value <= threshold;
      case 'eq': return value === threshold;
      default: return false;
    }
  }

  private buildAlertMessage(rule: any, deviceId: string, value: number): string {
    const opLabels: Record<string, string> = {
      gt: 'exceeded', lt: 'dropped below', gte: 'reached', lte: 'fell to', eq: 'equals',
    };
    const opLabel = opLabels[rule.operator] ?? rule.operator;
    return `${rule.name}: ${rule.metricName} ${opLabel} ${rule.threshold} (current: ${value}) on device ${deviceId}`;
  }
}
