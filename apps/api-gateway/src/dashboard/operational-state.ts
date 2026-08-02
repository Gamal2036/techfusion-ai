import { SeverityCounts } from './dashboard.types';

export type OperationalState =
  | 'NO_DATA'
  | 'OPERATIONAL'
  | 'ATTENTION'
  | 'DEGRADED'
  | 'CRITICAL';

export interface OperationalStateInput {
  fleetTotal: number;
  fleetOnline: number;
  alertsBySeverity: SeverityCounts;
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

export function deriveOperationalState(
  input: OperationalStateInput,
): OperationalState {
  const { fleetTotal, fleetOnline, alertsBySeverity, openFindings } = input;
  const offline = Math.max(0, fleetTotal - fleetOnline);

  if (fleetTotal === 0) return 'NO_DATA';

  if (
    alertsBySeverity.critical > 0 ||
    openFindings.critical > 0 ||
    offline === fleetTotal
  ) {
    return 'CRITICAL';
  }

  if (
    alertsBySeverity.high > 0 ||
    openFindings.high > 0 ||
    input.failedBackupsLast24h > 0 ||
    input.failedScansLast24h > 0 ||
    offline * 2 > fleetTotal
  ) {
    return 'DEGRADED';
  }

  const anyAlert =
    alertsBySeverity.critical +
      alertsBySeverity.high +
      alertsBySeverity.medium +
      alertsBySeverity.low +
      alertsBySeverity.warning +
      alertsBySeverity.unknown >
    0;
  const anyFinding =
    openFindings.critical +
      openFindings.high +
      openFindings.medium +
      openFindings.low >
    0;

  if (
    anyAlert ||
    anyFinding ||
    offline > 0 ||
    input.backupsRunning > 0 ||
    input.backupsPending > 0
  ) {
    return 'ATTENTION';
  }

  return 'OPERATIONAL';
}
