import { ReportingController } from './reporting.controller';

describe('ReportingController', () => {
  let controller: ReportingController;
  const mockReportingService = {
    listSchedules: jest.fn(),
    createSchedule: jest.fn(),
    updateSchedule: jest.fn(),
    deleteSchedule: jest.fn(),
  };
  const mockReportStorageService = {};

  beforeEach(() => {
    controller = new ReportingController(mockReportingService as any, mockReportStorageService as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('lists schedules for the authenticated organization', async () => {
    const schedules = [{ id: 'sched-1' }];
    mockReportingService.listSchedules.mockResolvedValue(schedules);
    const result = await controller.listSchedules({ user: { orgId: 'org-1' } } as any);

    expect(result).toBe(schedules);
    expect(mockReportingService.listSchedules).toHaveBeenCalledWith('org-1');
  });

  it('creates a schedule with the authenticated orgId', async () => {
    const dto = { type: 'device_health', formats: ['pdf'], cron: '0 0 * * *' };
    const schedule = { id: 'sched-1' };
    mockReportingService.createSchedule.mockResolvedValue(schedule);

    const result = await controller.createSchedule(dto as any, { user: { orgId: 'org-1' } } as any);

    expect(result).toBe(schedule);
    expect(mockReportingService.createSchedule).toHaveBeenCalledWith('org-1', dto);
  });

  it('updates a schedule by id and org', async () => {
    const updated = { id: 'sched-1', isEnabled: false };
    mockReportingService.updateSchedule.mockResolvedValue(updated);

    const result = await controller.updateSchedule('sched-1', { type: 'fleet_summary' } as any, { user: { orgId: 'org-1' } } as any);

    expect(result).toBe(updated);
    expect(mockReportingService.updateSchedule).toHaveBeenCalledWith('sched-1', 'org-1', { type: 'fleet_summary' });
  });

  it('deletes a schedule when owned by the organization', async () => {
    mockReportingService.deleteSchedule.mockResolvedValue(true);
    const result = await controller.deleteSchedule('sched-1', { user: { orgId: 'org-1' } } as any);

    expect(result).toEqual({ deleted: true });
    expect(mockReportingService.deleteSchedule).toHaveBeenCalledWith('sched-1', 'org-1');
  });
});
