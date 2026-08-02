import { RiskLevel } from './dashboard.types';

const RISK_LEVEL_ORDER: RiskLevel[] = ['low', 'medium', 'high', 'critical'];

const RISK_LEVEL_RANK: Record<string, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export function worstRiskLevel(
  riskLevels: Array<string | null | undefined>,
): RiskLevel | null {
  let worst: RiskLevel | null = null;
  let worstRank = -1;
  for (const value of riskLevels) {
    if (!value) continue;
    const normalized = value.trim().toLowerCase();
    const rank = RISK_LEVEL_RANK[normalized];
    if (rank === undefined) continue;
    if (rank > worstRank) {
      worstRank = rank;
      worst = normalized as RiskLevel;
    }
  }
  return worst;
}

export function riskLevelOrder(): RiskLevel[] {
  return RISK_LEVEL_ORDER;
}
