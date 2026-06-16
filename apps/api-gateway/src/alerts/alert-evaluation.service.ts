import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface MetricSnapshot {
  deviceId: string;
  orgId: string;
  cpuUsage: number;
  ramPercent: number;
  diskPercent: number | null;
  tempCpu: number | null;
  loadAverage1Min: number | null;
  processes: number | null;
  services: { name: string; status: string }[] | null;
}

@Injectable()
export class AlertEvaluationService {
  private readonly logger = new Logger(AlertEvaluationService.name);
  private lastAlertedTimestamps = new Map<string, number>();

  constructor(private prisma: PrismaService) {}

  async evaluateMetrics(deviceId: string, orgId: string, metric: MetricSnapshot): Promise<any[]> {
    const rules = await this.prisma.alertRule.findMany({
      where: { orgId, enabled: true },
    });

    const createdAlerts: any[] = [];

    for (const rule of rules) {
      const value = this.extractMetricValue(rule.metricName, metric);
      if (value === null || value === undefined) continue;

      const breached = this.evaluateThreshold(value, rule.threshold, rule.operator);
      if (!breached) continue;

      const key = `${rule.id}:${deviceId}`;
      const lastAlerted = this.lastAlertedTimestamps.get(key) ?? 0;
      const now = Date.now();

      if (now - lastAlerted < rule.debounceSeconds * 1000) continue;

      this.lastAlertedTimestamps.set(key, now);

      const message = this.buildAlertMessage(rule, deviceId, value);

      const alert = await this.prisma.alert.create({
        data: {
          orgId,
          alertRuleId: rule.id,
          deviceId,
          metricValue: value,
          threshold: rule.threshold,
          severity: rule.severity,
          message,
        },
      });

      this.logger.log(`Alert created: ${alert.id} - ${message}`);
      createdAlerts.push(alert);
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
