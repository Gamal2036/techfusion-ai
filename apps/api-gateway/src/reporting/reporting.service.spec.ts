import { ReportingService } from './reporting.service';
import { ReportType, ReportFormat } from './dto/generate-report.dto';
import { ForbiddenException, UnprocessableEntityException, BadRequestException, NotFoundException } from '@nestjs/common';
import { MockQueueService } from '../queue/queue.service.mock';

function createMockServices() {
  return {
    prisma: {
      organization: { findUnique: jest.fn() },
      report: { count: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
      reportSchedule: {
        findMany: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
      device: { findFirst: jest.fn(), findMany: jest.fn() },
      securityScan: { findFirst: jest.fn() },
    },
    branding: {
      getBranding: jest.fn().mockResolvedValue({ accentColor: '#3b82f6' }),
      setBranding: jest.fn(),
    },
    storage: {
      store: jest.fn().mockResolvedValue({ storagePath: '/path/to/file.pdf', fileSize: 1024 }),
      generateSignedUrl: jest.fn().mockReturnValue('/reports/download/abc/pdf?expires=123&sig=abc'),
      read: jest.fn(),
    },
    htmlGen: { generate: jest.fn().mockResolvedValue(Buffer.from('<html>')), format: 'html' },
    pdfGen: { generate: jest.fn().mockResolvedValue(Buffer.from('pdf')), format: 'pdf' },
    docxGen: { generate: jest.fn().mockResolvedValue(Buffer.from('docx')), format: 'docx' },
    csvGen: { generate: jest.fn().mockResolvedValue(Buffer.from('csv')), format: 'csv' },
    jsonGen: { generate: jest.fn().mockResolvedValue(Buffer.from('json')), format: 'json' },
    ai: undefined,
  };
}

describe('ReportingService', () => {
  let service: ReportingService;
  let mocks: ReturnType<typeof createMockServices>;

  beforeEach(() => {
    mocks = createMockServices();
    mocks.prisma.device.findMany.mockResolvedValue([]);
    const queueService = new MockQueueService();
    service = new ReportingService(
      mocks.prisma as any,
      mocks.branding as any,
      mocks.storage as any,
      mocks.htmlGen as any,
      mocks.pdfGen as any,
      mocks.docxGen as any,
      mocks.csvGen as any,
      mocks.jsonGen as any,
      queueService as any,
      mocks.ai as any,
    );
  });

  describe('generate', () => {
    const baseDto = {
      type: ReportType.DEVICE_HEALTH,
      format: ReportFormat.PDF,
      title: 'Test Report',
    };

    beforeEach(() => {
      mocks.prisma.organization.findUnique.mockResolvedValue({ id: 'org-1', plan: 'Pro' });
      mocks.prisma.report.count.mockResolvedValue(0);
      mocks.prisma.device.findFirst.mockResolvedValue({
        id: 'd1', name: 'Server', lastSeenAt: new Date(), orgId: 'org-1',
        metrics: [{ cpuUsage: 50, ramPercent: 60, diskReadBytes: 100, diskTotal: 200, tempCpu: 45, uptime: 86400 }],
        scores: [{ healthScore: 90, performanceScore: 85 }],
        alerts: [],
      });
      mocks.prisma.report.create.mockResolvedValue({ id: 'r1', title: 'Test Report', status: 'completed' });
      mocks.prisma.report.update.mockResolvedValue({ id: 'r1', title: 'Test Report', status: 'completed', signedUrl: '/reports/download/r1/pdf?expires=123&sig=abc' });
    });

    it('generates a report with correct DTO', async () => {
      const result = await service.generate('org-1', 'user-1', baseDto);
      expect(result.id).toBe('r1');
      expect(mocks.prisma.report.create).toHaveBeenCalled();
      expect(mocks.pdfGen.generate).toHaveBeenCalled();
      expect(mocks.storage.store).toHaveBeenCalledWith('org-1', expect.any(String), 'pdf', expect.any(Buffer));
    });

    it('uses default title when title is omitted', async () => {
      const dto = { type: ReportType.DEVICE_HEALTH, format: ReportFormat.HTML };
      await service.generate('org-1', 'user-1', dto);
      const createCall = mocks.prisma.report.create.mock.calls[0][0];
      expect(createCall.data.title).toBe('Device Health Report');
    });

    it('rejects unknown report type', async () => {
      const dto = { type: 'unknown_type' as any, format: ReportFormat.PDF };
      await expect(service.generate('org-1', 'user-1', dto)).rejects.toThrow('Unknown report type');
    });

    it('rejects unsupported format', async () => {
      const dto = { type: ReportType.DEVICE_HEALTH, format: 'tiff' as any };
      await expect(service.generate('org-1', 'user-1', dto)).rejects.toThrow('Unsupported format');
    });

    it('enforces monthly report limit', async () => {
      mocks.prisma.organization.findUnique.mockResolvedValue({ id: 'org-1', plan: 'Free' });
      mocks.prisma.report.count.mockResolvedValue(5);
      await expect(service.generate('org-1', 'user-1', baseDto)).rejects.toThrow(ForbiddenException);
    });

    it('allows generation within plan limit', async () => {
      mocks.prisma.report.count.mockResolvedValue(3);
      const result = await service.generate('org-1', 'user-1', baseDto);
      expect(result).toBeDefined();
    });

    it('returns 422 with SECURITY_SCAN_REQUIRED when no security scan exists', async () => {
      mocks.prisma.securityScan.findFirst.mockResolvedValue(null);
      const dto = { type: ReportType.SECURITY_EXECUTIVE, format: ReportFormat.PDF, title: 'Security Report' };
      await expect(service.generate('org-1', 'user-1', dto)).rejects.toThrow(UnprocessableEntityException);
      try {
        await service.generate('org-1', 'user-1', dto);
      } catch (e) {
        expect(e).toBeInstanceOf(UnprocessableEntityException);
        const response = (e as UnprocessableEntityException).getResponse();
        expect(response).toEqual(expect.objectContaining({
          code: 'SECURITY_SCAN_REQUIRED',
          message: expect.stringContaining('No completed security scan'),
        }));
      }
    });

    it('does not create a report record when security scan is missing', async () => {
      mocks.prisma.securityScan.findFirst.mockResolvedValue(null);
      const dto = { type: ReportType.SECURITY_EXECUTIVE, format: ReportFormat.PDF, title: 'Security Report' };
      await expect(service.generate('org-1', 'user-1', dto)).rejects.toThrow();
      expect(mocks.prisma.report.create).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('returns reports for the org', async () => {
      const reports = [{ id: 'r1', title: 'Report 1' }, { id: 'r2', title: 'Report 2' }];
      mocks.prisma.report.findMany.mockResolvedValue(reports);
      const result = await service.list('org-1');
      expect(result).toEqual(reports);
      expect(mocks.prisma.report.findMany).toHaveBeenCalledWith({
        where: { orgId: 'org-1' },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });

    it('filters by type when provided', async () => {
      mocks.prisma.report.findMany.mockResolvedValue([]);
      await service.list('org-1', 'device_health');
      expect(mocks.prisma.report.findMany).toHaveBeenCalledWith({
        where: { orgId: 'org-1', type: 'device_health' },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });
  });

  describe('schedule management', () => {
    it('lists schedules for the organization', async () => {
      const schedules = [
        {
          id: 'sched-1',
          orgId: 'org-1',
          type: 'device_health',
          formats: 'pdf,html',
          cron: '0 * * * *',
          deviceIds: JSON.stringify(['d1']),
          isEnabled: true,
          lastRunAt: new Date('2026-01-01T00:00:00Z'),
          nextRunAt: new Date('2026-01-01T01:00:00Z'),
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-01T00:00:00Z'),
        },
      ];
      mocks.prisma.reportSchedule.findMany.mockResolvedValue(schedules);

      const result = await service.listSchedules('org-1');

      expect(result).toEqual([
        {
          id: 'sched-1',
          type: 'device_health',
          formats: ['pdf', 'html'],
          cron: '0 * * * *',
          deviceIds: ['d1'],
          isEnabled: true,
          lastRunAt: new Date('2026-01-01T00:00:00Z'),
          nextRunAt: new Date('2026-01-01T01:00:00Z'),
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-01T00:00:00Z'),
        },
      ]);
      expect(mocks.prisma.reportSchedule.findMany).toHaveBeenCalledWith({
        where: { orgId: 'org-1' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('creates a valid schedule and calculates nextRunAt', async () => {
      mocks.prisma.reportSchedule.create.mockResolvedValue({
        id: 'sched-1',
        orgId: 'org-1',
        type: 'device_health',
        formats: 'pdf,docx',
        cron: '*/10 * * * *',
        deviceIds: JSON.stringify(['d1', 'd2']),
        isEnabled: true,
        lastRunAt: null,
        nextRunAt: new Date('2100-01-01T00:00:00.000Z'),
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      });

      mocks.prisma.device.findMany.mockResolvedValueOnce([{ id: 'd1' }, { id: 'd2' }]);
      const result = await service.createSchedule('org-1', {
        type: ReportType.DEVICE_HEALTH,
        formats: [ReportFormat.PDF, ReportFormat.DOCX],
        cron: '*/10 * * * *',
        deviceIds: ['d1', 'd2'],
      });

      expect(result.type).toBe('device_health');
      expect(result.formats).toEqual(['pdf', 'docx']);
      expect(result.deviceIds).toEqual(['d1', 'd2']);
      expect(result.nextRunAt).toBeInstanceOf(Date);
      expect(mocks.prisma.reportSchedule.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orgId: 'org-1',
          type: 'device_health',
          formats: 'pdf,docx',
          cron: '*/10 * * * *',
          deviceIds: JSON.stringify(['d1', 'd2']),
        }),
      });
    });

    it('ignores orgId from the client payload and uses auth orgId', async () => {
      mocks.prisma.reportSchedule.create.mockResolvedValue({
        id: 'sched-1',
        orgId: 'org-1',
        type: 'fleet_summary',
        formats: 'pdf',
        cron: '0 0 * * *',
        deviceIds: undefined,
        isEnabled: true,
        lastRunAt: null,
        nextRunAt: new Date('2100-01-01T00:00:00.000Z'),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createSchedule('org-1', {
        type: ReportType.FLEET_SUMMARY,
        formats: [ReportFormat.PDF],
        cron: '0 0 * * *',
        deviceIds: [],
        // @ts-expect-error: simulate extra client field
        orgId: 'org-2',
      });

      expect(result).toBeDefined();
      expect(mocks.prisma.reportSchedule.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ orgId: 'org-1' }),
      });
    });

    it('rejects invalid cron expressions with a stable error code', async () => {
      await expect(
        service.createSchedule('org-1', {
          type: ReportType.DEVICE_HEALTH,
          formats: [ReportFormat.PDF],
          cron: 'invalid-cron',
          deviceIds: [],
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          error: 'INVALID_REPORT_SCHEDULE_CRON',
          message: 'The report schedule cron expression is invalid.',
        }),
      });
    });

    it('normalizes duplicate formats deterministically', async () => {
      mocks.prisma.reportSchedule.create.mockResolvedValue({
        id: 'sched-1',
        orgId: 'org-1',
        type: 'device_health',
        formats: 'pdf,docx',
        cron: '*/10 * * * *',
        deviceIds: undefined,
        isEnabled: true,
        lastRunAt: null,
        nextRunAt: new Date('2100-01-01T00:00:00.000Z'),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.createSchedule('org-1', {
        type: ReportType.DEVICE_HEALTH,
        formats: [ReportFormat.PDF, ReportFormat.DOCX, ReportFormat.PDF],
        cron: '*/10 * * * *',
      });

      expect(mocks.prisma.reportSchedule.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ formats: 'pdf,docx' }),
      });
    });

    it('allows empty deviceIds for organization-wide schedules', async () => {
      mocks.prisma.reportSchedule.create.mockResolvedValue({
        id: 'sched-1',
        orgId: 'org-1',
        type: 'fleet_summary',
        formats: 'pdf',
        cron: '0 0 * * *',
        deviceIds: JSON.stringify([]),
        isEnabled: true,
        lastRunAt: null,
        nextRunAt: new Date('2100-01-01T00:00:00.000Z'),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createSchedule('org-1', {
        type: ReportType.FLEET_SUMMARY,
        formats: [ReportFormat.PDF],
        cron: '0 0 * * *',
        deviceIds: [],
      });

      expect(result.deviceIds).toEqual([]);
      expect(mocks.prisma.reportSchedule.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ deviceIds: JSON.stringify([]) }),
      });
    });

    it('rejects foreign organization device IDs', async () => {
      mocks.prisma.device.findMany.mockResolvedValueOnce([]);
      mocks.prisma.device.findMany.mockResolvedValueOnce([{ id: 'd1', orgId: 'org-2' }]);

      await expect(
        service.createSchedule('org-1', {
          type: ReportType.DEVICE_HEALTH,
          formats: [ReportFormat.PDF],
          cron: '0 0 * * *',
          deviceIds: ['d1'],
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects nonexistent device IDs', async () => {
      mocks.prisma.device.findMany.mockResolvedValueOnce([]);
      mocks.prisma.device.findMany.mockResolvedValueOnce([]);

      await expect(
        service.createSchedule('org-1', {
          type: ReportType.DEVICE_HEALTH,
          formats: [ReportFormat.PDF],
          cron: '0 0 * * *',
          deviceIds: ['d1'],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('recalculates nextRunAt when cron is updated', async () => {
      mocks.prisma.reportSchedule.findFirst.mockResolvedValue({
        id: 'sched-1',
        orgId: 'org-1',
        type: 'device_health',
        formats: 'pdf',
        cron: '0 0 * * *',
        deviceIds: undefined,
        isEnabled: true,
        lastRunAt: null,
        nextRunAt: new Date('2025-01-01T00:00:00Z'),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mocks.prisma.reportSchedule.update.mockResolvedValue({
        id: 'sched-1',
        orgId: 'org-1',
        type: 'device_health',
        formats: 'pdf',
        cron: '*/5 * * * *',
        deviceIds: undefined,
        isEnabled: true,
        lastRunAt: null,
        nextRunAt: new Date('2100-01-01T00:00:00Z'),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const updated = await service.updateSchedule('sched-1', 'org-1', {
        cron: '*/5 * * * *',
      });

      expect(updated?.cron).toBe('*/5 * * * *');
      expect(updated?.nextRunAt).toBeInstanceOf(Date);
      expect(mocks.prisma.reportSchedule.update).toHaveBeenCalledWith({
        where: { id: 'sched-1' },
        data: expect.objectContaining({ cron: '*/5 * * * *' }),
      });
    });

    it('enabling a stale schedule recalculates nextRunAt', async () => {
      mocks.prisma.reportSchedule.findFirst.mockResolvedValue({
        id: 'sched-1',
        orgId: 'org-1',
        type: 'device_health',
        formats: 'pdf',
        cron: '0 0 * * *',
        deviceIds: undefined,
        isEnabled: false,
        lastRunAt: null,
        nextRunAt: new Date('2020-01-01T00:00:00Z'),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mocks.prisma.reportSchedule.update.mockResolvedValue({
        id: 'sched-1',
        orgId: 'org-1',
        type: 'device_health',
        formats: 'pdf',
        cron: '0 0 * * *',
        deviceIds: undefined,
        isEnabled: true,
        lastRunAt: null,
        nextRunAt: new Date('2100-01-01T00:00:00Z'),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const updated = await service.updateSchedule('sched-1', 'org-1', {
        isEnabled: true,
      });

      expect(updated?.isEnabled).toBe(true);
      expect(updated?.nextRunAt).toBeInstanceOf(Date);
      expect(mocks.prisma.reportSchedule.update).toHaveBeenCalledWith({
        where: { id: 'sched-1' },
        data: expect.objectContaining({ isEnabled: true }),
      });
    });

    it('does not modify lastRunAt during update', async () => {
      mocks.prisma.reportSchedule.findFirst.mockResolvedValue({
        id: 'sched-1',
        orgId: 'org-1',
        type: 'device_health',
        formats: 'pdf',
        cron: '0 0 * * *',
        deviceIds: undefined,
        isEnabled: true,
        lastRunAt: new Date('2025-01-01T00:00:00Z'),
        nextRunAt: new Date('2100-01-01T00:00:00Z'),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mocks.prisma.reportSchedule.update.mockResolvedValue({
        id: 'sched-1',
        orgId: 'org-1',
        type: 'security_executive',
        formats: 'pdf',
        cron: '0 0 * * *',
        deviceIds: undefined,
        isEnabled: true,
        lastRunAt: new Date('2025-01-01T00:00:00Z'),
        nextRunAt: new Date('2100-01-01T00:00:00Z'),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const updated = await service.updateSchedule('sched-1', 'org-1', {
        type: ReportType.SECURITY_EXECUTIVE,
      });

      expect(updated?.lastRunAt).toEqual(new Date('2025-01-01T00:00:00Z'));
      expect(mocks.prisma.reportSchedule.update).toHaveBeenCalledWith({
        where: { id: 'sched-1' },
        data: expect.objectContaining({ type: 'security_executive' }),
      });
    });

    it('returns null for cross-organization update', async () => {
      mocks.prisma.reportSchedule.findFirst.mockResolvedValue(null);
      const result = await service.updateSchedule('sched-1', 'org-1', { cron: '0 0 * * *' });
      expect(result).toBeNull();
    });

    it('rejects injection of internal fields on update', async () => {
      mocks.prisma.reportSchedule.findFirst.mockResolvedValue({
        id: 'sched-1',
        orgId: 'org-1',
        type: 'device_health',
        formats: 'pdf',
        cron: '0 0 * * *',
        deviceIds: undefined,
        isEnabled: true,
        lastRunAt: null,
        nextRunAt: new Date('2100-01-01T00:00:00Z'),
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      });
      mocks.prisma.reportSchedule.update.mockResolvedValue({
        id: 'sched-1',
        orgId: 'org-1',
        type: 'device_health',
        formats: 'pdf',
        cron: '0 0 * * *',
        deviceIds: undefined,
        isEnabled: true,
        lastRunAt: null,
        nextRunAt: new Date('2100-01-01T00:00:00Z'),
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      });

      // @ts-expect-error: extra internal fields should be ignored
      const updated = await service.updateSchedule('sched-1', 'org-1', { nextRunAt: new Date('2000-01-01T00:00:00Z') });

      expect(updated).toEqual(expect.objectContaining({
        id: 'sched-1',
        type: 'device_health',
      }));
      expect(mocks.prisma.reportSchedule.update).not.toHaveBeenCalled();
    });

    it('deletes schedule belonging to same org', async () => {
      mocks.prisma.reportSchedule.deleteMany.mockResolvedValue({ count: 1 });
      const result = await service.deleteSchedule('sched-1', 'org-1');
      expect(result).toBe(true);
      expect(mocks.prisma.reportSchedule.deleteMany).toHaveBeenCalledWith({ where: { id: 'sched-1', orgId: 'org-1' } });
    });

    it('returns false for delete when schedule is missing or wrong org', async () => {
      mocks.prisma.reportSchedule.deleteMany.mockResolvedValue({ count: 0 });
      expect(await service.deleteSchedule('sched-1', 'org-1')).toBe(false);
    });
  });
});
