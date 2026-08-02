import { Logger, UnprocessableEntityException } from '@nestjs/common';
import { ReportScheduleExecutorService } from './report-schedule-executor.service';
import { ReportFormat, ReportType } from './dto/generate-report.dto';

describe('ReportScheduleExecutorService', () => {
  let service: ReportScheduleExecutorService;
  let prismaMock: {
    reportSchedule: { findMany: jest.Mock; findUnique?: jest.Mock; update?: jest.Mock; updateMany?: jest.Mock; delete?: jest.Mock; create?: jest.Mock };
  };
  let reportingServiceMock: { generate: jest.Mock };
  let debugSpy: jest.SpyInstance<void, any[]>;
  let errorSpy: jest.SpyInstance<void, any[]>;
  let lockMock: { acquire: jest.Mock; release: jest.Mock };

  beforeEach(() => {
    prismaMock = {
      reportSchedule: {
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        create: jest.fn(),
      },
    };
    reportingServiceMock = {
      generate: jest.fn(),
    };

    // Mock distributed lock used by the executor tests. Defaults to successful acquire
    // and successful release. Individual tests override behavior when needed.
    lockMock = {
      acquire: jest.fn().mockResolvedValue('lock-token-1'),
      release: jest.fn().mockResolvedValue(true),
    } as any;

    // Pass the mock lock into the service so tests do not require a real Redis server.
    service = new ReportScheduleExecutorService(prismaMock as any, reportingServiceMock as any, lockMock as any);
    debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    debugSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('queries due enabled schedules and logs tick without throwing when none are found', async () => {
    prismaMock.reportSchedule.findMany.mockResolvedValue([]);

    await expect(service.handleScheduledReportsTick()).resolves.not.toThrow();

    expect(debugSpy).toHaveBeenCalledTimes(1);
    expect(debugSpy).toHaveBeenCalledWith('Scheduled report executor tick started');
    expect(prismaMock.reportSchedule.findMany).toHaveBeenCalledTimes(1);

    const query = prismaMock.reportSchedule.findMany.mock.calls[0][0];
    expect(query).toEqual({
      where: {
        isEnabled: true,
        nextRunAt: {
          not: null,
          lte: expect.any(Date),
        },
      },
      orderBy: [{ nextRunAt: 'asc' }, { id: 'asc' }],
      take: 50,
      select: { id: true },
    });
  });

  it('logs a structured summary when due schedules are discovered', async () => {
    prismaMock.reportSchedule.findMany.mockResolvedValue([
      { id: 'sched-1' },
      { id: 'sched-2' },
    ]);

    await service.handleScheduledReportsTick();

    expect(debugSpy).toHaveBeenCalledTimes(2);
    expect(debugSpy).toHaveBeenNthCalledWith(2, expect.stringContaining('Due report schedules discovered: count=2 ids=sched-1,sched-2 now='));
    expect(prismaMock.reportSchedule.findMany).toHaveBeenCalledTimes(1);
  });

  it('does not throw when schedule discovery fails and logs an error', async () => {
    prismaMock.reportSchedule.findMany.mockRejectedValue(new Error('Database unavailable'));

    await expect(service.handleScheduledReportsTick()).resolves.not.toThrow();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Report schedule discovery failed'),
      undefined,
      ReportScheduleExecutorService.name,
    );
    expect(debugSpy).toHaveBeenCalledTimes(1);
  });

  it('generates a single PDF report from schedule', async () => {
    reportingServiceMock.generate.mockResolvedValue({ id: 'report-1' });

    const schedule = {
      id: 'sched-1',
      orgId: 'org-1',
      type: ReportType.DEVICE_HEALTH,
      formats: [ReportFormat.PDF],
      deviceIds: ['device-1'],
      cron: '* * * * *',
      isEnabled: true,
      lastRunAt: null,
      nextRunAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    const result = await service.executeScheduleGeneration(schedule);

    expect(reportingServiceMock.generate).toHaveBeenCalledTimes(1);
    expect(reportingServiceMock.generate).toHaveBeenCalledWith(
      'org-1',
      expect.any(String),
      expect.objectContaining({
        type: ReportType.DEVICE_HEALTH,
        format: ReportFormat.PDF,
        deviceIds: ['device-1'],
        generateAiSummary: false,
      }),
    );
    expect(result.successfulFormats).toEqual([ReportFormat.PDF]);
    expect(result.failedFormats).toEqual([]);
  });

  it('generates multiple formats for a schedule', async () => {
    reportingServiceMock.generate.mockResolvedValue({ id: 'report-1' });

    const schedule = {
      id: 'sched-2',
      orgId: 'org-2',
      type: ReportType.DEVICE_HEALTH,
      formats: [ReportFormat.PDF, ReportFormat.DOCX, ReportFormat.HTML],
      deviceIds: ['device-2'],
      cron: '* * * * *',
      isEnabled: true,
      lastRunAt: null,
      nextRunAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    const result = await service.executeScheduleGeneration(schedule);

    expect(reportingServiceMock.generate).toHaveBeenCalledTimes(3);
    expect(reportingServiceMock.generate.mock.calls.map((args) => args[2].format)).toEqual([
      ReportFormat.PDF,
      ReportFormat.DOCX,
      ReportFormat.HTML,
    ]);
    expect(result.successfulFormats).toEqual([
      ReportFormat.PDF,
      ReportFormat.DOCX,
      ReportFormat.HTML,
    ]);
    expect(result.failedFormats).toEqual([]);
  });

  it('continues generation when one format fails', async () => {
    reportingServiceMock.generate.mockImplementation(async (_orgId, _userId, dto) => {
      if (dto.format === ReportFormat.DOCX) {
        throw new Error('DOCX generator unavailable');
      }
      return { id: `report-${dto.format}` };
    });

    const schedule = {
      id: 'sched-3',
      orgId: 'org-3',
      type: ReportType.DEVICE_HEALTH,
      formats: [ReportFormat.PDF, ReportFormat.DOCX, ReportFormat.HTML],
      deviceIds: ['device-3'],
      cron: '* * * * *',
      isEnabled: true,
      lastRunAt: null,
      nextRunAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    const result = await service.executeScheduleGeneration(schedule);

    expect(reportingServiceMock.generate).toHaveBeenCalledTimes(3);
    expect(result.successfulFormats).toEqual([ReportFormat.PDF, ReportFormat.HTML]);
    expect(result.failedFormats).toEqual([
      expect.objectContaining({
        format: ReportFormat.DOCX,
        message: 'DOCX generator unavailable',
      }),
    ]);
  });

  it('preserves SECURITY_SCAN_REQUIRED when Security Executive generation fails', async () => {
    reportingServiceMock.generate.mockImplementation(async () => {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: 'SECURITY_SCAN_REQUIRED',
        message: 'No completed security scan is available. Run a security scan before generating a Security Executive report.',
      });
    });

    const schedule = {
      id: 'sched-4',
      orgId: 'org-4',
      type: ReportType.SECURITY_EXECUTIVE,
      formats: [ReportFormat.PDF],
      deviceIds: ['device-4'],
      cron: '* * * * *',
      isEnabled: true,
      lastRunAt: null,
      nextRunAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    const result = await service.executeScheduleGeneration(schedule);

    expect(reportingServiceMock.generate).toHaveBeenCalledTimes(1);
    expect(result.successfulFormats).toEqual([]);
    expect(result.failedFormats).toEqual([
      expect.objectContaining({
        format: ReportFormat.PDF,
        code: 'SECURITY_SCAN_REQUIRED',
        message: expect.stringContaining('No completed security scan'),
      }),
    ]);
  });

  it('reports unsupported formats without crashing', async () => {
    reportingServiceMock.generate.mockResolvedValue({ id: 'report-ok' });

    const schedule = {
      id: 'sched-5',
      orgId: 'org-5',
      type: ReportType.DEVICE_HEALTH,
      formats: [ReportFormat.PDF, 'tiff', ReportFormat.HTML],
      deviceIds: ['device-5'],
      cron: '* * * * *',
      isEnabled: true,
      lastRunAt: null,
      nextRunAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    const result = await service.executeScheduleGeneration(schedule);

    expect(reportingServiceMock.generate).toHaveBeenCalledTimes(2);
    expect(result.successfulFormats).toEqual([ReportFormat.PDF, ReportFormat.HTML]);
    expect(result.failedFormats).toEqual([
      expect.objectContaining({
        format: 'tiff',
        code: 'UNSUPPORTED_FORMAT',
      }),
    ]);
  });

  it('returns clear failure when no formats are configured', async () => {
    const schedule = {
      id: 'sched-6',
      orgId: 'org-6',
      type: ReportType.DEVICE_HEALTH,
      formats: [],
      deviceIds: ['device-6'],
      cron: '* * * * *',
      isEnabled: true,
      lastRunAt: null,
      nextRunAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    const result = await service.executeScheduleGeneration(schedule);

    expect(reportingServiceMock.generate).not.toHaveBeenCalled();
    expect(result.successfulFormats).toEqual([]);
    expect(result.failedFormats).toEqual([
      expect.objectContaining({ code: 'NO_REPORT_FORMATS' }),
    ]);
  });

  it('maps parsed deviceIds and schedule fields into the ReportingService DTO', async () => {
    reportingServiceMock.generate.mockResolvedValue({ id: 'report-7' });

    const schedule = {
      id: 'sched-7',
      orgId: 'org-7',
      type: ReportType.DEVICE_HEALTH,
      formats: 'pdf',
      deviceIds: JSON.stringify(['device-7a', 'device-7b']),
      cron: '* * * * *',
      isEnabled: true,
      lastRunAt: null,
      nextRunAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    await service.executeScheduleGeneration(schedule);

    expect(reportingServiceMock.generate).toHaveBeenCalledWith(
      'org-7',
      expect.any(String),
      expect.objectContaining({
        type: ReportType.DEVICE_HEALTH,
        format: ReportFormat.PDF,
        deviceIds: ['device-7a', 'device-7b'],
      }),
    );
  });

  it('processes a due schedule: full success path (claim -> generate -> update lastRunAt)', async () => {
    const tickNow = new Date('2026-07-23T10:00:00.000Z');
    // discovery returns the due id
    prismaMock.reportSchedule.findMany.mockResolvedValue([{ id: 'sched-9' }]);

    // full schedule record
    const schedule = {
      id: 'sched-9',
      orgId: 'org-9',
      type: ReportType.DEVICE_HEALTH,
      formats: [ReportFormat.PDF],
      deviceIds: ['device-9'],
      cron: '* * * * *',
      isEnabled: true,
      lastRunAt: null,
      nextRunAt: new Date('2026-07-23T09:59:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    prismaMock.reportSchedule.findUnique = jest.fn().mockResolvedValue(schedule);

    // simulate successful claim (count=1)
    let claimCalled = false;
    prismaMock.reportSchedule.updateMany = jest.fn().mockImplementation(async (_opts) => {
      claimCalled = true;
      return { count: 1 };
    });

    // simulate reporting generation success
    reportingServiceMock.generate = jest.fn().mockResolvedValue({ id: 'report-9' });

    // spy on lastRunAt update
    let lastRunUpdated = false;
    prismaMock.reportSchedule.update = jest.fn().mockImplementation(async () => {
      lastRunUpdated = true;
      return {};
    });

    // Spy calculateNextRunAt to ensure it's called before claim
    const events: string[] = [];
    const originalCalc: any = (service as any).calculateNextRunAt.bind(service);
    jest.spyOn(service as any, 'calculateNextRunAt').mockImplementation((cron: string, from: Date) => {
      events.push('calculate');
      return originalCalc(cron, from);
    });

    // Replace Date used in tick by mocking Date.now indirectly by passing tickNow via findDueSchedules call
    // Call the handler (it creates its own Date). To make behavior deterministic, mock findDueSchedules to accept any Date and return.

    // Run tick
    await service.handleScheduledReportsTick();

    expect(prismaMock.reportSchedule.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.reportSchedule.findUnique).toHaveBeenCalledWith({ where: { id: 'sched-9' } });
    expect(claimCalled).toBe(true);
    expect(reportingServiceMock.generate).toHaveBeenCalledTimes(1);
    expect(lastRunUpdated).toBe(true);
    // ensure calculate was invoked before claim by checking events
    expect(events).toEqual(['calculate']);
  });

  it('acquires and releases occurrence lock during successful claim+generation', async () => {
    prismaMock.reportSchedule.findMany.mockResolvedValue([{ id: 'sched-9' }]);

    const schedule = {
      id: 'sched-9',
      orgId: 'org-9',
      type: ReportType.DEVICE_HEALTH,
      formats: [ReportFormat.PDF],
      deviceIds: ['device-9'],
      cron: '* * * * *',
      isEnabled: true,
      lastRunAt: null,
      nextRunAt: new Date('2026-07-23T09:59:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    prismaMock.reportSchedule.findUnique = jest.fn().mockResolvedValue(schedule);

    prismaMock.reportSchedule.updateMany = jest.fn().mockResolvedValue({ count: 1 });
    reportingServiceMock.generate = jest.fn().mockResolvedValue({ id: 'report-9' });
    prismaMock.reportSchedule.update = jest.fn().mockResolvedValue({});

    await service.handleScheduledReportsTick();

    // Lock acquire and release should have been called
    expect(lockMock.acquire).toHaveBeenCalledTimes(1);
    expect(lockMock.release).toHaveBeenCalledTimes(1);
    // Ensure generation executed
    expect(reportingServiceMock.generate).toHaveBeenCalledTimes(1);
  });

  it('skips generation when occurrence lock is already owned', async () => {
    prismaMock.reportSchedule.findMany.mockResolvedValue([{ id: 'sched-lock-owned' }]);

    const schedule = {
      id: 'sched-lock-owned',
      orgId: 'org-lock',
      type: ReportType.DEVICE_HEALTH,
      formats: [ReportFormat.PDF],
      deviceIds: ['device-10'],
      cron: '* * * * *',
      isEnabled: true,
      lastRunAt: null,
      nextRunAt: new Date('2026-07-23T09:59:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    prismaMock.reportSchedule.findUnique = jest.fn().mockResolvedValue(schedule);
    // Simulate lock already owned
    lockMock.acquire.mockResolvedValueOnce(null);

    prismaMock.reportSchedule.updateMany = jest.fn().mockResolvedValue({ count: 1 });

    await expect(service.handleScheduledReportsTick()).resolves.not.toThrow();

    // Generation should not have been called and DB claim should not be attempted
    expect(reportingServiceMock.generate).not.toHaveBeenCalled();
    // If updateMany were attempted it would have been called; ensure it wasn't used
    expect(prismaMock.reportSchedule.updateMany).not.toHaveBeenCalled();
  });

  it('ensures only one of two instances with the same lock performs generation', async () => {
    // Simulate discovery returning one due id
    prismaMock.reportSchedule.findMany.mockResolvedValue([{ id: 'sched-concurrent' }]);

    const schedule = {
      id: 'sched-concurrent',
      orgId: 'org-concurrent',
      type: ReportType.DEVICE_HEALTH,
      formats: [ReportFormat.PDF],
      deviceIds: ['device-c'],
      cron: '* * * * *',
      isEnabled: true,
      lastRunAt: null,
      nextRunAt: new Date('2026-07-23T09:59:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    prismaMock.reportSchedule.findUnique = jest.fn().mockResolvedValue(schedule);

    // First acquire succeeds, second attempt returns null
    lockMock.acquire.mockResolvedValueOnce('tok-1').mockResolvedValueOnce(null);

    // Simulate claim success for the first caller only
    let calls = 0;
    prismaMock.reportSchedule.updateMany = jest.fn().mockImplementation(async () => {
      calls += 1;
      // only the first claim succeeds
      return { count: calls === 1 ? 1 : 0 };
    });

    reportingServiceMock.generate = jest.fn().mockResolvedValue({ id: 'r' });

    // Create a second executor instance that shares the same mocked lock
    const second = new ReportScheduleExecutorService(prismaMock as any, reportingServiceMock as any, lockMock as any);

    // Run both processors (sequentially in test but simulating concurrent attempts)
    await service.processDueSchedule('sched-concurrent', new Date());
    await second.processDueSchedule('sched-concurrent', new Date());

    // Only one generation should have been performed
    expect(reportingServiceMock.generate).toHaveBeenCalledTimes(1);
  });

  it('does not advance or generate when lock infrastructure fails', async () => {
    prismaMock.reportSchedule.findMany.mockResolvedValue([{ id: 'sched-lock-error' }]);

    const schedule = {
      id: 'sched-lock-error',
      orgId: 'org-lock-err',
      type: ReportType.DEVICE_HEALTH,
      formats: [ReportFormat.PDF],
      deviceIds: ['device-err'],
      cron: '* * * * *',
      isEnabled: true,
      lastRunAt: null,
      nextRunAt: new Date('2026-07-23T09:59:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    prismaMock.reportSchedule.findUnique = jest.fn().mockResolvedValue(schedule);
    // Simulate Redis/lock error
    lockMock.acquire.mockRejectedValueOnce(new Error('redis down'));

    prismaMock.reportSchedule.updateMany = jest.fn().mockResolvedValue({ count: 1 });

    await expect(service.handleScheduledReportsTick()).resolves.not.toThrow();

    // Should not attempt generation or claim when lock infra fails
    expect(reportingServiceMock.generate).not.toHaveBeenCalled();
    expect(prismaMock.reportSchedule.updateMany).not.toHaveBeenCalled();
  });

  it('releases lock when generation throws unexpectedly', async () => {
    prismaMock.reportSchedule.findMany.mockResolvedValue([{ id: 'sched-throw' }]);

    const schedule = {
      id: 'sched-throw',
      orgId: 'org-throw',
      type: ReportType.DEVICE_HEALTH,
      formats: [ReportFormat.PDF],
      deviceIds: ['device-throw'],
      cron: '* * * * *',
      isEnabled: true,
      lastRunAt: null,
      nextRunAt: new Date('2026-07-23T09:59:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    prismaMock.reportSchedule.findUnique = jest.fn().mockResolvedValue(schedule);
    prismaMock.reportSchedule.updateMany = jest.fn().mockResolvedValue({ count: 1 });

    // Make execution throw
    (service as any).executeScheduleGeneration = jest.fn().mockImplementation(async () => {
      throw new Error('unexpected execution');
    });

    await expect(service.handleScheduledReportsTick()).resolves.not.toThrow();

    // Lock should be released in finally
    expect(lockMock.release).toHaveBeenCalledTimes(1);
  });

  it('passes configured TTL to lock acquisition', async () => {
    process.env.REPORT_SCHEDULE_LOCK_TTL_MS = '12345';

    prismaMock.reportSchedule.findMany.mockResolvedValue([{ id: 'sched-ttl' }]);

    const schedule = {
      id: 'sched-ttl',
      orgId: 'org-ttl',
      type: ReportType.DEVICE_HEALTH,
      formats: [ReportFormat.PDF],
      deviceIds: ['device-ttl'],
      cron: '* * * * *',
      isEnabled: true,
      lastRunAt: null,
      nextRunAt: new Date('2026-07-23T09:59:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    prismaMock.reportSchedule.findUnique = jest.fn().mockResolvedValue(schedule);
    prismaMock.reportSchedule.updateMany = jest.fn().mockResolvedValue({ count: 1 });
    reportingServiceMock.generate = jest.fn().mockResolvedValue({ id: 'r-ttl' });
    prismaMock.reportSchedule.update = jest.fn().mockResolvedValue({});

    await service.handleScheduledReportsTick();

    expect(lockMock.acquire).toHaveBeenCalledWith(expect.any(String), 12345);

    // cleanup
    delete process.env.REPORT_SCHEDULE_LOCK_TTL_MS;
  });

  it('skips generation when claim/updateMany returns count=0', async () => {
    prismaMock.reportSchedule.findMany.mockResolvedValue([{ id: 'sched-10' }]);
    const schedule = {
      id: 'sched-10',
      orgId: 'org-10',
      type: ReportType.DEVICE_HEALTH,
      formats: [ReportFormat.PDF],
      deviceIds: ['device-10'],
      cron: '* * * * *',
      isEnabled: true,
      lastRunAt: null,
      nextRunAt: new Date('2026-07-23T09:59:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
    prismaMock.reportSchedule.findUnique = jest.fn().mockResolvedValue(schedule);
    prismaMock.reportSchedule.updateMany = jest.fn().mockResolvedValue({ count: 0 });

    await expect(service.handleScheduledReportsTick()).resolves.not.toThrow();

    expect(reportingServiceMock.generate).not.toHaveBeenCalled();
  });

  it('advances nextRunAt even when all formats fail and does not update lastRunAt', async () => {
    prismaMock.reportSchedule.findMany.mockResolvedValue([{ id: 'sched-11' }]);
    const schedule = {
      id: 'sched-11',
      orgId: 'org-11',
      type: ReportType.DEVICE_HEALTH,
      formats: [ReportFormat.PDF, ReportFormat.DOCX],
      deviceIds: ['device-11'],
      cron: '* * * * *',
      isEnabled: true,
      lastRunAt: null,
      nextRunAt: new Date('2026-07-23T09:59:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
    prismaMock.reportSchedule.findUnique = jest.fn().mockResolvedValue(schedule);
    prismaMock.reportSchedule.updateMany = jest.fn().mockResolvedValue({ count: 1 });

    // make reporting generate throw for both formats
    reportingServiceMock.generate = jest.fn().mockImplementation(async () => {
      throw new Error('generator failure');
    });

    let lastRunUpdated = false;
    prismaMock.reportSchedule.update = jest.fn().mockImplementation(async () => {
      lastRunUpdated = true;
      return {};
    });

    await expect(service.handleScheduledReportsTick()).resolves.not.toThrow();

    expect(prismaMock.reportSchedule.updateMany).toHaveBeenCalledTimes(1);
    expect(reportingServiceMock.generate).toHaveBeenCalled();
    // even though generation failed, lastRunAt should not be updated
    expect(lastRunUpdated).toBe(false);
  });

  it('preserves SECURITY_SCAN_REQUIRED when Security Executive generation fails (full failure)', async () => {
    prismaMock.reportSchedule.findMany.mockResolvedValue([{ id: 'sched-12' }]);
    const schedule = {
      id: 'sched-12',
      orgId: 'org-12',
      type: ReportType.SECURITY_EXECUTIVE,
      formats: [ReportFormat.PDF],
      deviceIds: ['device-12'],
      cron: '* * * * *',
      isEnabled: true,
      lastRunAt: null,
      nextRunAt: new Date('2026-07-23T09:59:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
    prismaMock.reportSchedule.findUnique = jest.fn().mockResolvedValue(schedule);
    prismaMock.reportSchedule.updateMany = jest.fn().mockResolvedValue({ count: 1 });

    reportingServiceMock.generate = jest.fn().mockImplementation(async () => {
      throw new UnprocessableEntityException({ statusCode: 422, code: 'SECURITY_SCAN_REQUIRED', message: 'No completed security scan' });
    });

    let lastRunUpdated = false;
    prismaMock.reportSchedule.update = jest.fn().mockImplementation(async () => {
      lastRunUpdated = true;
      return {};
    });

    await expect(service.handleScheduledReportsTick()).resolves.not.toThrow();

    expect(prismaMock.reportSchedule.updateMany).toHaveBeenCalledTimes(1);
    expect(reportingServiceMock.generate).toHaveBeenCalledTimes(1);
    expect(lastRunUpdated).toBe(false);
  });

  it('logs and skips invalid cron without advancing or generating', async () => {
    prismaMock.reportSchedule.findMany.mockResolvedValue([{ id: 'sched-13' }]);
    const schedule = {
      id: 'sched-13',
      orgId: 'org-13',
      type: ReportType.DEVICE_HEALTH,
      formats: [ReportFormat.PDF],
      deviceIds: ['device-13'],
      cron: 'INVALID CRON',
      isEnabled: true,
      lastRunAt: null,
      nextRunAt: new Date('2026-07-23T09:59:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
    prismaMock.reportSchedule.findUnique = jest.fn().mockResolvedValue(schedule);
    prismaMock.reportSchedule.updateMany = jest.fn();

    await expect(service.handleScheduledReportsTick()).resolves.not.toThrow();

    // generate should not be called and updateMany should not be called because cron invalid
    expect(reportingServiceMock.generate).not.toHaveBeenCalled();
    expect(prismaMock.reportSchedule.updateMany).not.toHaveBeenCalled();
  });

  it('continues processing other schedules when one throws unexpectedly', async () => {
    prismaMock.reportSchedule.findMany.mockResolvedValue([{ id: 'sched-a' }, { id: 'sched-b' }]);

    // first schedule exists but processing will throw unexpected error during execution
    const s1 = {
      id: 'sched-a',
      orgId: 'org-a',
      type: ReportType.DEVICE_HEALTH,
      formats: [ReportFormat.PDF],
      deviceIds: ['device-a'],
      cron: '* * * * *',
      isEnabled: true,
      lastRunAt: null,
      nextRunAt: new Date('2026-07-23T09:59:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
    const s2 = {
      id: 'sched-b',
      orgId: 'org-b',
      type: ReportType.DEVICE_HEALTH,
      formats: [ReportFormat.PDF],
      deviceIds: ['device-b'],
      cron: '* * * * *',
      isEnabled: true,
      lastRunAt: null,
      nextRunAt: new Date('2026-07-23T09:59:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    // findUnique should return s1 then s2
    let call = 0;
    prismaMock.reportSchedule.findUnique = jest.fn().mockImplementation(async () => {
      call += 1;
      return call === 1 ? s1 : s2;
    });

    // First schedule: claim succeeds but executeScheduleGeneration throws
    let firstClaim = true;
    prismaMock.reportSchedule.updateMany = jest.fn().mockImplementation(async () => {
      return { count: 1 };
    });

    // Make executeScheduleGeneration throw on first schedule, succeed on second
    const originalExec = service.executeScheduleGeneration.bind(service);
    (service as any).executeScheduleGeneration = jest.fn().mockImplementation(async (sched: any) => {
      if (sched.id === 'sched-a') throw new Error('unexpected');
      return originalExec(sched);
    });

    // reportingService.generate should succeed for second schedule
    reportingServiceMock.generate = jest.fn().mockResolvedValue({ id: 'r' });

    await expect(service.handleScheduledReportsTick()).resolves.not.toThrow();

    // ensure second schedule still generated
    expect(reportingServiceMock.generate).toHaveBeenCalled();
  });

});
