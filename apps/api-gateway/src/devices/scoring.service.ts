import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * SCORING FORMULAS — fully documented for auditability.
 *
 * All scores are 0-100. Higher is better for health & performance.
 * Higher is WORSE for risk (so risk=100 means maximum risk).
 */

interface MetricInput {
  cpuUsage: number;
  ramPercent: number;
  diskUsed: number | null;
  diskTotal: number | null;
  tempCpu: number | null;
  smartStatus: string | null;
  loadAverage1Min: number | null;
  processes: number | null;
  batteryPercent: number | null;
}

@Injectable()
export class ScoringService {
  constructor(private prisma: PrismaService) {}

  /**
   * HEALTH SCORE (0-100, higher = healthier)
   *
   * Weights:
   *   cpuHealth   25% — CPU utilization (inverse linear)
   *   ramHealth   20% — RAM utilization (inverse linear)
   *   diskHealth  20% — Disk utilization (inverse linear)
   *   tempHealth  20% — CPU temperature (piecewise: 100 if <70C, steep drop after)
   *   smartHealth 15% — SMART status (100 if PASS, 0 if FAIL/any issue)
   *
   * Formula:
   *   cpuHealth   = max(0, 100 - cpuUsage)
   *   ramHealth   = max(0, 100 - ramPercent)
   *   diskHealth  = diskTotal > 0
   *                   ? max(0, 100 - (diskUsed / diskTotal) * 100)
   *                   : 100
   *   tempHealth  = tempCpu == null
   *                   ? 100
   *                   : tempCpu < 70 ? 100
   *                   : max(0, 100 - (tempCpu - 70) * 3.33)
   *   smartHealth = smartStatus == null || smartStatus == 'PASS' ? 100 : 0
   *
   *   healthScore = cpuHealth*0.25 + ramHealth*0.20 + diskHealth*0.20
   *                + tempHealth*0.20 + smartHealth*0.15
   */
  computeHealthScore(input: MetricInput): number {
    const cpuHealth = Math.max(0, 100 - input.cpuUsage);
    const ramHealth = Math.max(0, 100 - input.ramPercent);

    let diskHealth = 100;
    if (input.diskTotal && input.diskTotal > 0 && input.diskUsed != null) {
      const diskPct = (input.diskUsed / input.diskTotal) * 100;
      diskHealth = Math.max(0, 100 - diskPct);
    }

    let tempHealth = 100;
    if (input.tempCpu != null) {
      if (input.tempCpu >= 70) {
        tempHealth = Math.max(0, 100 - (input.tempCpu - 70) * 3.33);
      }
    }

    const smartHealth =
      input.smartStatus == null || input.smartStatus === 'PASS' ? 100 : 0;

    return Math.round(
      cpuHealth * 0.25 +
      ramHealth * 0.20 +
      diskHealth * 0.20 +
      tempHealth * 0.20 +
      smartHealth * 0.15,
    );
  }

  /**
   * PERFORMANCE SCORE (0-100, higher = better)
   *
   * Weights:
   *   cpuPerf   35% — CPU utilization (inverse)
   *   ramPerf   25% — RAM utilization (inverse)
   *   loadPerf  25% — 1-min load average normalized to logical CPUs
   *   procPerf  15% — Process count (inverse, normalized)
   *
   * Formula:
   *   cpuPerf  = max(0, 100 - cpuUsage)
   *   ramPerf  = max(0, 100 - ramPercent)
   *   loadPerf = loadAvg1Min == null
   *                ? 100
   *                : max(0, 100 - min(loadAvg1Min * 20, 100))
   *   procPerf = processes == null
   *                ? 100
   *                : max(0, 100 - min(processes / 2, 100))
   *
   *   performanceScore = cpuPerf*0.35 + ramPerf*0.25 + loadPerf*0.25 + procPerf*0.15
   */
  computePerformanceScore(input: MetricInput): number {
    const cpuPerf = Math.max(0, 100 - input.cpuUsage);
    const ramPerf = Math.max(0, 100 - input.ramPercent);

    let loadPerf = 100;
    if (input.loadAverage1Min != null) {
      loadPerf = Math.max(0, 100 - Math.min(input.loadAverage1Min * 20, 100));
    }

    let procPerf = 100;
    if (input.processes != null) {
      procPerf = Math.max(0, 100 - Math.min(input.processes / 2, 100));
    }

    return Math.round(
      cpuPerf * 0.35 +
      ramPerf * 0.25 +
      loadPerf * 0.25 +
      procPerf * 0.15,
    );
  }

  /**
   * RISK SCORE (0-100, higher = RISKIER)
   *
   * Weights:
   *   cpuRisk   30% — CPU utilization (direct: higher CPU = higher risk)
   *   ramRisk   20% — RAM utilization (direct)
   *   diskRisk  30% — Disk utilization (direct; near-full disk is high risk)
   *   tempRisk  10% — High temperature (>80C triggers risk)
   *   smartRisk 10% — SMART failure (0 or 100)
   *
   * Formula:
   *   cpuRisk  = cpuUsage
   *   ramRisk  = ramPercent
   *   diskRisk = diskTotal > 0
   *                ? (diskUsed / diskTotal) * 100
   *                : 0
   *   tempRisk = tempCpu == null || tempCpu <= 80
   *                ? 0
   *                : min(100, (tempCpu - 80) * 5)
   *   smartRisk = smartStatus == 'FAIL' ? 100 : 0
   *
   *   riskScore = cpuRisk*0.30 + ramRisk*0.20 + diskRisk*0.30
   *              + tempRisk*0.10 + smartRisk*0.10
   */
  computeRiskScore(input: MetricInput): number {
    const cpuRisk = input.cpuUsage;
    const ramRisk = input.ramPercent;

    let diskRisk = 0;
    if (input.diskTotal && input.diskTotal > 0 && input.diskUsed != null) {
      diskRisk = (input.diskUsed / input.diskTotal) * 100;
    }

    let tempRisk = 0;
    if (input.tempCpu != null && input.tempCpu > 80) {
      tempRisk = Math.min(100, (input.tempCpu - 80) * 5);
    }

    const smartRisk = input.smartStatus === 'FAIL' ? 100 : 0;

    return Math.round(
      cpuRisk * 0.30 +
      ramRisk * 0.20 +
      diskRisk * 0.30 +
      tempRisk * 0.10 +
      smartRisk * 0.10,
    );
  }

  /**
   * Compute all three scores from a single metric snapshot.
   */
  computeAll(input: MetricInput): {
    healthScore: number;
    performanceScore: number;
    riskScore: number;
  } {
    return {
      healthScore: this.computeHealthScore(input),
      performanceScore: this.computePerformanceScore(input),
      riskScore: this.computeRiskScore(input),
    };
  }
}
