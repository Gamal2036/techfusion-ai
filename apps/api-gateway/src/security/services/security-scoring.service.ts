import { Injectable } from '@nestjs/common';

export interface FindingInput {
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface ScoreResult {
  securityScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

/**
 * Security Scoring Formula (0-100, 100 = most secure):
 *
 * Penalty per finding by severity:
 *   Critical: -25 points (cap total critical penalty at -75)
 *   High:     -15 points (cap total high penalty at -60)
 *   Medium:    -8 points (cap total medium penalty at -40)
 *   Low:       -3 points (cap total low penalty at -20)
 *
 * Raw score = max(0, 100 - total_penalty)
 *
 * Risk Level:
 *   0-24  → Critical
 *  25-49  → High
 *  50-74  → Medium
 *  75-100 → Low
 */
@Injectable()
export class SecurityScoringService {
  private readonly PENALTIES = {
    critical: { perFinding: 25, cap: 75 },
    high: { perFinding: 15, cap: 60 },
    medium: { perFinding: 8, cap: 40 },
    low: { perFinding: 3, cap: 20 },
  } as const;

  compute(findings: FindingInput[]): ScoreResult {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };

    for (const f of findings) {
      if (counts[f.severity] !== undefined) {
        counts[f.severity]++;
      }
    }

    const totalFindings = findings.length;
    const criticalCount = counts.critical;
    const highCount = counts.high;
    const mediumCount = counts.medium;
    const lowCount = counts.low;

    let totalPenalty = 0;

    for (const [severity, cfg] of Object.entries(this.PENALTIES)) {
      const count = counts[severity as keyof typeof counts];
      const penalty = Math.min(count * cfg.perFinding, cfg.cap);
      totalPenalty += penalty;
    }

    const securityScore = Math.max(0, Math.min(100, 100 - totalPenalty));

    let riskLevel: ScoreResult['riskLevel'];
    if (securityScore >= 75) riskLevel = 'low';
    else if (securityScore >= 50) riskLevel = 'medium';
    else if (securityScore >= 25) riskLevel = 'high';
    else riskLevel = 'critical';

    return {
      securityScore,
      riskLevel,
      totalFindings,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
    };
  }
}
