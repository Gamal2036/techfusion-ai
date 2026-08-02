/**
 * Command Center Operational State — shared frontend utilities.
 *
 * Mirrors apps/api-gateway/src/dashboard/operational-state.ts so the web
 * dashboard and the API can never disagree about an organization's
 * operational state.  Both files MUST stay in sync.  A test in
 * apps/web/src/__tests__/command-state.spec.ts verifies the exact backend
 * cases.
 *
 * UNKNOWN is a web-only status: it represents a client-side fetch failure
 * (no summary available), never a backend-computed state.
 */

import { safeParseDate } from '@/lib/device-presence';
import type { DashboardSummary } from '@/hooks/useDashboardSummary';

export type OperationalState =
  | 'NO_DATA'
  | 'OPERATIONAL'
  | 'ATTENTION'
  | 'DEGRADED'
  | 'CRITICAL';

/**
 * Web-only status representing a client-side fetch failure.  Never produced
 * by the backend derivation; callers map a missing summary + error to this.
 */
export type OperationalStatus = OperationalState | 'UNKNOWN';

export interface OperationalStateInput {
  fleetTotal: number;
  fleetOnline: number;
  alertsBySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    warning: number;
    unknown: number;
  };
  openFindings: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  backupsRunning: number;
  backupsPending: number;
  failedBackupsLast24h: number;
  failedScansLast24h: number;
}

/**
 * A summary is considered stale when it was generated more than this long ago.
 */
export const SUMMARY_STALE_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Returns true when the summary was generated too long ago to be treated as
 * fresh.  Invalid or missing timestamps are treated as stale.
 */
export function isSummaryStale(
  generatedAt: string | Date | null | undefined,
  now?: Date,
): boolean {
  const ref = now ?? new Date();
  const ts = safeParseDate(generatedAt);
  if (!ts) return true;
  return ref.getTime() - ts.getTime() > SUMMARY_STALE_THRESHOLD_MS;
}

const plural = (n: number) => (n === 1 ? '' : 's');

/**
 * Derive the operational state AND the human-readable reasons that explain
 * it.  This mirrors the backend rule order exactly; deriveOperationalState
 * below is a thin wrapper around this function so state and reasons can
 * never disagree.
 */
export function deriveOperationalStateDetailed(
  input: OperationalStateInput,
): { state: OperationalState; reasons: string[] } {
  const { fleetTotal, fleetOnline, alertsBySeverity, openFindings } = input;
  const offline = Math.max(0, fleetTotal - fleetOnline);

  const totalAlerts =
    alertsBySeverity.critical +
    alertsBySeverity.high +
    alertsBySeverity.medium +
    alertsBySeverity.low +
    alertsBySeverity.warning +
    alertsBySeverity.unknown;
  const totalFindings =
    openFindings.critical + openFindings.high + openFindings.medium + openFindings.low;

  if (fleetTotal === 0) {
    return { state: 'NO_DATA', reasons: ['No fleet data has been reported yet.'] };
  }

  if (
    alertsBySeverity.critical > 0 ||
    openFindings.critical > 0 ||
    offline === fleetTotal
  ) {
    const reasons: string[] = [];
    if (alertsBySeverity.critical > 0) {
      reasons.push(`${alertsBySeverity.critical} critical alert${plural(alertsBySeverity.critical)}`);
    }
    if (openFindings.critical > 0) {
      reasons.push(`${openFindings.critical} critical finding${plural(openFindings.critical)}`);
    }
    if (offline === fleetTotal) reasons.push('All devices are offline.');
    return { state: 'CRITICAL', reasons };
  }

  if (
    alertsBySeverity.high > 0 ||
    openFindings.high > 0 ||
    input.failedBackupsLast24h > 0 ||
    input.failedScansLast24h > 0 ||
    offline * 2 > fleetTotal
  ) {
    const reasons: string[] = [];
    if (alertsBySeverity.high > 0) {
      reasons.push(`${alertsBySeverity.high} high alert${plural(alertsBySeverity.high)}`);
    }
    if (openFindings.high > 0) {
      reasons.push(`${openFindings.high} high finding${plural(openFindings.high)}`);
    }
    if (input.failedBackupsLast24h > 0) {
      reasons.push(`${input.failedBackupsLast24h} failed backup${plural(input.failedBackupsLast24h)} in the last 24h`);
    }
    if (input.failedScansLast24h > 0) {
      reasons.push(`${input.failedScansLast24h} failed scan${plural(input.failedScansLast24h)} in the last 24h`);
    }
    if (offline * 2 > fleetTotal) reasons.push('More than half of devices are offline.');
    return { state: 'DEGRADED', reasons };
  }

  if (
    totalAlerts > 0 ||
    totalFindings > 0 ||
    offline > 0 ||
    input.backupsRunning > 0 ||
    input.backupsPending > 0
  ) {
    const reasons: string[] = [];
    if (totalAlerts > 0) {
      reasons.push(`${totalAlerts} alert${plural(totalAlerts)} need${totalAlerts === 1 ? 's' : ''} attention`);
    }
    if (totalFindings > 0) {
      reasons.push(`${totalFindings} open finding${plural(totalFindings)}`);
    }
    if (offline > 0) reasons.push(`${offline} device${plural(offline)} offline`);
    if (input.backupsRunning > 0) {
      reasons.push(`${input.backupsRunning} backup${plural(input.backupsRunning)} running`);
    }
    if (input.backupsPending > 0) {
      reasons.push(`${input.backupsPending} backup${plural(input.backupsPending)} pending`);
    }
    return { state: 'ATTENTION', reasons };
  }

  return { state: 'OPERATIONAL', reasons: ['All monitored systems are operating normally.'] };
}

/**
 * Mirror of the backend deriveOperationalState.  Exact rule order:
 * NO_DATA -> CRITICAL -> DEGRADED -> ATTENTION -> OPERATIONAL.
 */
export function deriveOperationalState(
  input: OperationalStateInput,
): OperationalState {
  return deriveOperationalStateDetailed(input).state;
}

/**
 * Thin adapter from the real /dashboard/summary contract into the shared
 * derivation input.  A null/undefined summary is treated as NO_DATA; callers
 * decide whether a fetch failure should be shown as UNKNOWN instead.
 */
export function deriveOperationalStateDetailedFromSummary(
  summary: DashboardSummary | null | undefined,
): { state: OperationalState; reasons: string[] } {
  if (!summary) {
    return { state: 'NO_DATA', reasons: ['No fleet data has been reported yet.'] };
  }
  return deriveOperationalStateDetailed({
    fleetTotal: summary.fleet.total,
    fleetOnline: summary.fleet.online,
    alertsBySeverity: summary.alerts.bySeverity,
    openFindings: summary.security.openFindings,
    backupsRunning: summary.operations.backups.running,
    backupsPending: summary.operations.backups.pending,
    failedBackupsLast24h: summary.operations.backups.failedLast24h,
    failedScansLast24h: summary.operations.scans.failedLast24h,
  });
}

/**
 * Mirror of deriveOperationalState driven by the /dashboard/summary contract.
 */
export function deriveOperationalStateFromSummary(
  summary: DashboardSummary | null | undefined,
): OperationalState {
  return deriveOperationalStateDetailedFromSummary(summary).state;
}

export const OPERATIONAL_STATE_LABELS: Record<OperationalStatus, string> = {
  NO_DATA: 'No data',
  OPERATIONAL: 'Operational',
  ATTENTION: 'Attention',
  DEGRADED: 'Degraded',
  CRITICAL: 'Critical',
  UNKNOWN: 'Status unavailable',
};
