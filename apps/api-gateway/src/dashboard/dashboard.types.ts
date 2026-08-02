export const SEVERITY_BUCKETS = [
  'critical',
  'high',
  'medium',
  'low',
  'warning',
  'unknown',
] as const;

export type SeverityBucket = (typeof SEVERITY_BUCKETS)[number];

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';

export interface SeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
  warning: number;
  unknown: number;
}

export interface FreshnessCounts {
  live: number;
  recent: number;
  stale: number;
  unavailable: number;
}

export interface RecentDevice {
  id: string;
  name: string;
  hostname: string | null;
  os: string | null;
  lastSeenAt: string | null;
}

export interface DashboardSummaryResponse {
  generatedAt: string;
  fleet: {
    total: number;
    online: number;
    offline: number;
    freshness: FreshnessCounts;
    deviceHealth: number | null;
    recentDevices: RecentDevice[];
  };
  alerts: {
    unacknowledged: number;
    bySeverity: SeverityCounts;
  };
  security: {
    openFindings: {
      critical: number;
      high: number;
      medium: number;
      low: number;
      total: number;
    };
    worstRiskLevel: RiskLevel | null;
    scanCoverage: {
      scannedDevices: number;
      onlineDevices: number;
      coveragePercent: number | null;
      lastScanAt: string | null;
    };
    unscannedOnlineDevices: number;
    latestScanAgesDays: number | null;
  };
  operations: {
    backups: {
      running: number;
      pending: number;
      failedLast24h: number;
      completedLast24h: number;
      lastCompletedAt: string | null;
      lastCompletedJobName: string | null;
      nextScheduledAt: string | null;
    };
    scans: {
      running: number;
      pending: number;
      failedLast24h: number;
      completedLast24h: number;
    };
    reports: {
      generating: number;
      failed: number;
      completed: number;
      generatedLast30d: number;
    };
  };
  team: {
    total: number;
  };
}

export function emptySeverityCounts(): SeverityCounts {
  return { critical: 0, high: 0, medium: 0, low: 0, warning: 0, unknown: 0 };
}

export function emptyFreshnessCounts(): FreshnessCounts {
  return { live: 0, recent: 0, stale: 0, unavailable: 0 };
}
