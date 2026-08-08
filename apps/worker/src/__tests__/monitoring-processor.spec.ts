import { Job } from 'bullmq';

jest.mock('../metrics', () => ({
  startMetricsServer: jest.fn(),
  trackQueueDepth: jest.fn(),
  trackJobCompleted: jest.fn(),
  trackJobFailed: jest.fn(),
  trackJobDuration: jest.fn(),
  trackMonitoringSweep: jest.fn(),
  trackMonitoringSweepFailure: jest.fn(),
  getMetrics: jest.fn().mockResolvedValue(''),
  getMetricsContentType: jest.fn().mockReturnValue('text/plain'),
}));

jest.mock('../telemetry', () => ({
  initTelemetry: jest.fn().mockResolvedValue(undefined),
  shutdownTelemetry: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../prisma-client', () => ({
  getPrismaClient: jest.fn().mockReturnValue({}),
  disconnectPrisma: jest.fn(),
}));

jest.mock('../monitoring-sweep', () => ({
  runMonitoringSweep: jest.fn(),
}));

import { processMonitoringJob } from '../processors';
import { runMonitoringSweep } from '../monitoring-sweep';
import { JOB_NAMES } from '../queue-names';
import { trackMonitoringSweep, trackMonitoringSweepFailure } from '../metrics';

const runMonitoringSweepMock = runMonitoringSweep as jest.Mock;
const trackMonitoringSweepMock = trackMonitoringSweep as jest.Mock;
const trackMonitoringSweepFailureMock = trackMonitoringSweepFailure as jest.Mock;

function makeJob(name: string, data: Record<string, unknown> = {}): Job {
  return { id: 'job-1', name, data } as Job;
}

describe('processMonitoringJob', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('runs the monitoring sweep for the presence_sweep job name', async () => {
    runMonitoringSweepMock.mockResolvedValue({
      orgsProcessed: 1,
      devicesEvaluated: 3,
      presenceAlertsCreated: 1,
      presenceAlertsRefreshed: 0,
      legacyDuplicatesPromoted: 0,
      presenceAlertsResolved: 0,
      metricAlertsResolved: 0,
      notificationsQueued: 1,
    });

    const result = await processMonitoringJob(makeJob(JOB_NAMES.MONITORING.PRESENCE_SWEEP, { scheduledAt: '2026-08-06T12:00:00.000Z' }));

    expect(runMonitoringSweepMock).toHaveBeenCalledTimes(1);
    const args = runMonitoringSweepMock.mock.calls[0];
    expect(args[0]).toEqual({});
    expect(args[1].now).toBeInstanceOf(Date);
    expect(args[1].notify).toBeDefined();
    expect(result).toMatchObject({ success: true });
    expect(result.result.presenceAlertsCreated).toBe(1);
    expect(trackMonitoringSweepMock).toHaveBeenCalledWith(
      expect.objectContaining({
        presenceAlertsCreated: 1,
        metricAlertsResolved: 0,
      }),
    );
  });

  it('skips unknown monitoring job names without counting a sweep run', async () => {
    const result = await processMonitoringJob(makeJob('mystery_job'));
    expect(runMonitoringSweepMock).not.toHaveBeenCalled();
    expect(trackMonitoringSweepMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: true, skipped: true });
  });

  it('rethrows failures so bullmq retries the job and records a failed sweep run', async () => {
    runMonitoringSweepMock.mockRejectedValue(new Error('db unavailable'));
    await expect(
      processMonitoringJob(makeJob(JOB_NAMES.MONITORING.PRESENCE_SWEEP)),
    ).rejects.toThrow('db unavailable');
    expect(trackMonitoringSweepFailureMock).toHaveBeenCalledTimes(1);
  });
});
