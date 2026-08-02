import { deriveOperationalState, OperationalStateInput } from './operational-state';
import { emptySeverityCounts } from './dashboard.types';

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

describe('deriveOperationalState', () => {
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

  it('is DEGRADED when exactly half the fleet is offline', () => {
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
