import {
  deriveOperationalState,
  deriveOperationalStateDetailed,
  deriveOperationalStateFromSummary,
  isSummaryStale,
  OPERATIONAL_STATE_LABELS,
  SUMMARY_STALE_THRESHOLD_MS,
  type OperationalStateInput,
} from '@/lib/command-state';
import type { DashboardSummary } from '@/hooks/useDashboardSummary';

function emptySeverityCounts() {
  return { critical: 0, high: 0, medium: 0, low: 0, warning: 0, unknown: 0 };
}

function baseInput(): OperationalStateInput {
  return {
    fleetTotal: 3,
    fleetOnline: 3,
    alertsBySeverity: emptySeverityCounts(),
    openFindings: { critical: 0, high: 0, medium: 0, low: 0 },
    backupsRunning: 0,
    backupsPending: 0,
    failedBackupsLast24h: 0,
    failedScansLast24h: 0,
  };
}

describe('deriveOperationalState (mirror of backend operational-state.spec.ts)', () => {
  it('is NO_DATA when the fleet is empty', () => {
    expect(deriveOperationalState({ ...baseInput(), fleetTotal: 0, fleetOnline: 0 })).toBe('NO_DATA');
  });

  it('is NO_DATA even when alerts exist but the fleet is empty', () => {
    const input = baseInput();
    input.fleetTotal = 0;
    input.fleetOnline = 0;
    input.alertsBySeverity.critical = 1;
    expect(deriveOperationalState(input)).toBe('NO_DATA');
  });

  it('is OPERATIONAL when nothing requires attention', () => {
    expect(deriveOperationalState(baseInput())).toBe('OPERATIONAL');
  });

  it('is CRITICAL when an unresolved critical alert exists', () => {
    const input = baseInput();
    input.alertsBySeverity.critical = 1;
    expect(deriveOperationalState(input)).toBe('CRITICAL');
  });

  it('is CRITICAL when a critical open finding exists', () => {
    const input = baseInput();
    input.openFindings.critical = 1;
    expect(deriveOperationalState(input)).toBe('CRITICAL');
  });

  it('is CRITICAL when every enrolled device is offline', () => {
    const input = baseInput();
    input.fleetOnline = 0;
    expect(deriveOperationalState(input)).toBe('CRITICAL');
  });

  it('is DEGRADED when a high alert exists', () => {
    const input = baseInput();
    input.alertsBySeverity.high = 1;
    expect(deriveOperationalState(input)).toBe('DEGRADED');
  });

  it('is DEGRADED when a high open finding exists', () => {
    const input = baseInput();
    input.openFindings.high = 1;
    expect(deriveOperationalState(input)).toBe('DEGRADED');
  });

  it('is DEGRADED when a backup failed in the last 24h', () => {
    const input = baseInput();
    input.failedBackupsLast24h = 1;
    expect(deriveOperationalState(input)).toBe('DEGRADED');
  });

  it('is DEGRADED when a scan failed in the last 24h', () => {
    const input = baseInput();
    input.failedScansLast24h = 1;
    expect(deriveOperationalState(input)).toBe('DEGRADED');
  });

  it('is DEGRADED when more than 50% of devices are offline', () => {
    const input = baseInput();
    input.fleetTotal = 4;
    input.fleetOnline = 1;
    expect(deriveOperationalState(input)).toBe('DEGRADED');
  });

  it('is ATTENTION when exactly half the fleet is offline', () => {
    const input = baseInput();
    input.fleetTotal = 4;
    input.fleetOnline = 2;
    expect(deriveOperationalState(input)).toBe('ATTENTION');
  });

  it('is ATTENTION when any single device is offline', () => {
    const input = baseInput();
    input.fleetTotal = 3;
    input.fleetOnline = 2;
    expect(deriveOperationalState(input)).toBe('ATTENTION');
  });

  it('is ATTENTION when a low-severity alert exists', () => {
    const input = baseInput();
    input.alertsBySeverity.low = 2;
    expect(deriveOperationalState(input)).toBe('ATTENTION');
  });

  it('is ATTENTION when an unknown-severity alert exists', () => {
    const input = baseInput();
    input.alertsBySeverity.unknown = 1;
    expect(deriveOperationalState(input)).toBe('ATTENTION');
  });

  it('is ATTENTION when a medium open finding exists', () => {
    const input = baseInput();
    input.openFindings.medium = 3;
    expect(deriveOperationalState(input)).toBe('ATTENTION');
  });

  it('is ATTENTION when a backup is running', () => {
    const input = baseInput();
    input.backupsRunning = 1;
    expect(deriveOperationalState(input)).toBe('ATTENTION');
  });

  it('is ATTENTION when a backup is pending', () => {
    const input = baseInput();
    input.backupsPending = 1;
    expect(deriveOperationalState(input)).toBe('ATTENTION');
  });

  it('lets a higher-severity state win over a lower one', () => {
    const input = baseInput();
    input.alertsBySeverity.critical = 1;
    input.alertsBySeverity.high = 1;
    input.fleetOnline = 1;
    expect(deriveOperationalState(input)).toBe('CRITICAL');
  });

  it('keeps DEGRADED above ATTENTION', () => {
    const input = baseInput();
    input.failedBackupsLast24h = 1;
    input.backupsRunning = 1;
    input.alertsBySeverity.low = 1;
    expect(deriveOperationalState(input)).toBe('DEGRADED');
  });
});

describe('deriveOperationalStateDetailed', () => {
  it('returns reasons that match the resulting state', () => {
    const input = baseInput();
    input.alertsBySeverity.critical = 1;
    const { state, reasons } = deriveOperationalStateDetailed(input);
    expect(state).toBe('CRITICAL');
    expect(reasons).toContain('1 critical alert');
  });

  it('reports pluralized counts correctly', () => {
    const input = baseInput();
    input.alertsBySeverity.critical = 2;
    const { reasons } = deriveOperationalStateDetailed(input);
    expect(reasons).toContain('2 critical alerts');
  });

  it('reports all-offline as the critical reason', () => {
    const input = baseInput();
    input.fleetOnline = 0;
    const { state, reasons } = deriveOperationalStateDetailed(input);
    expect(state).toBe('CRITICAL');
    expect(reasons).toContain('All devices are offline.');
  });

  it('reports degraded causes for failures and majority offline', () => {
    const input = baseInput();
    input.failedBackupsLast24h = 1;
    const { state, reasons } = deriveOperationalStateDetailed(input);
    expect(state).toBe('DEGRADED');
    expect(reasons).toContain('1 failed backup in the last 24h');
  });

  it('reports attention causes without duplicating higher-level reasons', () => {
    const input = baseInput();
    input.alertsBySeverity.low = 1;
    input.backupsRunning = 1;
    const { state, reasons } = deriveOperationalStateDetailed(input);
    expect(state).toBe('ATTENTION');
    expect(reasons).toContain('1 alert needs attention');
    expect(reasons).toContain('1 backup running');
    expect(reasons).not.toContain('2 alerts need attention');
  });

  it('reports a stable message for OPERATIONAL', () => {
    const { state, reasons } = deriveOperationalStateDetailed(baseInput());
    expect(state).toBe('OPERATIONAL');
    expect(reasons).toEqual(['All monitored systems are operating normally.']);
  });

  it('reports a stable message for NO_DATA', () => {
    const { state, reasons } = deriveOperationalStateDetailed({
      ...baseInput(),
      fleetTotal: 0,
      fleetOnline: 0,
    });
    expect(state).toBe('NO_DATA');
    expect(reasons).toEqual(['No fleet data has been reported yet.']);
  });
});

describe('deriveOperationalStateFromSummary', () => {
  function baseSummary(): DashboardSummary {
    return {
      generatedAt: '2026-01-01T00:00:00.000Z',
      fleet: {
        total: 3,
        online: 3,
        degraded: 0,
        offline: 0,
        unknown: 0,
        freshness: { live: 3, recent: 0, stale: 0, unavailable: 0 },
        deviceHealth: 90,
        recentDevices: [],
      },
      alerts: {
        unacknowledged: 0,
        bySeverity: { critical: 0, high: 0, medium: 0, low: 0, warning: 0, unknown: 0 },
      },
      security: {
        openFindings: { critical: 0, high: 0, medium: 0, low: 0, total: 0 },
        worstRiskLevel: null,
        scanCoverage: { scannedDevices: 3, onlineDevices: 3, coveragePercent: 100, lastScanAt: null },
        unscannedOnlineDevices: 0,
        latestScanAgesDays: null,
      },
      operations: {
        backups: {
          running: 0,
          pending: 0,
          failedLast24h: 0,
          completedLast24h: 0,
          lastCompletedAt: null,
          lastCompletedJobName: null,
          nextScheduledAt: null,
        },
        scans: { running: 0, pending: 0, failedLast24h: 0, completedLast24h: 0 },
        reports: { generating: 0, failed: 0, completed: 0, generatedLast30d: 0 },
      },
      team: { total: 5 },
    };
  }

  it('derives OPERATIONAL from a healthy summary', () => {
    expect(deriveOperationalStateFromSummary(baseSummary())).toBe('OPERATIONAL');
  });

  it('derives ATTENTION from warnings', () => {
    const summary = baseSummary();
    summary.alerts.bySeverity.warning = 2;
    expect(deriveOperationalStateFromSummary(summary)).toBe('ATTENTION');
  });

  it('derives CRITICAL from a critical finding', () => {
    const summary = baseSummary();
    summary.security.openFindings.critical = 1;
    expect(deriveOperationalStateFromSummary(summary)).toBe('CRITICAL');
  });

  it('derives ATTENTION when a backup is running', () => {
    const summary = baseSummary();
    summary.operations.backups.running = 1;
    expect(deriveOperationalStateFromSummary(summary)).toBe('ATTENTION');
  });

  it('derives DEGRADED when a scan failed in the last 24h', () => {
    const summary = baseSummary();
    summary.operations.scans.failedLast24h = 1;
    expect(deriveOperationalStateFromSummary(summary)).toBe('DEGRADED');
  });

  it('treats a missing summary as NO_DATA', () => {
    expect(deriveOperationalStateFromSummary(null)).toBe('NO_DATA');
    expect(deriveOperationalStateFromSummary(undefined)).toBe('NO_DATA');
  });
});

describe('isSummaryStale', () => {
  const now = new Date('2026-01-01T12:00:00.000Z');

  it('is false for a summary generated within the threshold', () => {
    const fresh = new Date(now.getTime() - SUMMARY_STALE_THRESHOLD_MS + 1000).toISOString();
    expect(isSummaryStale(fresh, now)).toBe(false);
  });

  it('is true exactly at the threshold boundary', () => {
    const boundary = new Date(now.getTime() - SUMMARY_STALE_THRESHOLD_MS).toISOString();
    expect(isSummaryStale(boundary, now)).toBe(false);
  });

  it('is true for a summary generated beyond the threshold', () => {
    const old = new Date(now.getTime() - SUMMARY_STALE_THRESHOLD_MS - 1000).toISOString();
    expect(isSummaryStale(old, now)).toBe(true);
  });

  it('is true for invalid or missing timestamps', () => {
    expect(isSummaryStale(null, now)).toBe(true);
    expect(isSummaryStale(undefined, now)).toBe(true);
    expect(isSummaryStale('not-a-date', now)).toBe(true);
  });
});

describe('OPERATIONAL_STATE_LABELS', () => {
  it('exposes a label for every status including UNKNOWN', () => {
    expect(OPERATIONAL_STATE_LABELS.NO_DATA).toBe('No data');
    expect(OPERATIONAL_STATE_LABELS.OPERATIONAL).toBe('Operational');
    expect(OPERATIONAL_STATE_LABELS.ATTENTION).toBe('Attention');
    expect(OPERATIONAL_STATE_LABELS.DEGRADED).toBe('Degraded');
    expect(OPERATIONAL_STATE_LABELS.CRITICAL).toBe('Critical');
    expect(OPERATIONAL_STATE_LABELS.UNKNOWN).toBe('Status unavailable');
  });
});
