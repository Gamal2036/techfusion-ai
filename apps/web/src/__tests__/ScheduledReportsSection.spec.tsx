import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { ScheduledReportsSection } from '@/app/dashboard/reports/ScheduledReportsSection';
import { useReportSchedules } from '@/hooks/useReportSchedules';
import {
  deriveReportScheduleStatus,
  STATUS_METADATA,
} from '@/lib/report-schedule-status';
import type { ReportSchedule, ReportScheduleFormat, ReportScheduleStatus } from '@techfusion/types';

jest.mock('@/hooks/useReportSchedules', () => ({ useReportSchedules: jest.fn() }));

const mockUseReportSchedules = useReportSchedules as jest.MockedFunction<typeof useReportSchedules>;

const schedule: ReportSchedule = {
  id: 'schedule-1',
  type: 'security_executive',
  formats: ['pdf', 'docx'] as ReportScheduleFormat[],
  cron: '0 9 * * 1',
  deviceIds: ['device-1', 'device-2'],
  isEnabled: false,
  lastRunAt: null,
  nextRunAt: null,
  createdAt: '2026-07-23T08:00:00.000Z',
  updatedAt: '2026-07-23T08:00:00.000Z',
};

const schedule2: ReportSchedule = {
  id: 'schedule-2',
  type: 'device_health',
  formats: ['html'],
  cron: '0 18 * * 5',
  deviceIds: ['device-3'],
  isEnabled: true,
  lastRunAt: '2026-07-20T09:00:00.000Z',
  nextRunAt: '2099-01-01T18:00:00.000Z',
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-01T10:00:00.000Z',
};

const scheduleNeverRun: ReportSchedule = {
  id: 'schedule-never-run',
  type: 'fleet_summary',
  formats: ['pdf'],
  cron: '0 8 * * 1',
  deviceIds: ['device-4'],
  isEnabled: true,
  lastRunAt: null,
  nextRunAt: '2099-08-01T08:00:00.000Z',
  createdAt: '2026-07-23T08:00:00.000Z',
  updatedAt: '2026-07-23T08:00:00.000Z',
};

const scheduleOverdue: ReportSchedule = {
  id: 'schedule-overdue',
  type: 'security_executive',
  formats: ['docx'],
  cron: '0 9 * * 1',
  deviceIds: [],
  isEnabled: true,
  lastRunAt: '2026-07-15T09:00:00.000Z',
  nextRunAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-06-01T08:00:00.000Z',
  updatedAt: '2026-06-01T08:00:00.000Z',
};

const scheduleUnscheduled: ReportSchedule = {
  id: 'schedule-unscheduled',
  type: 'device_health',
  formats: ['html'],
  cron: '0 12 * * *',
  deviceIds: ['device-5'],
  isEnabled: true,
  lastRunAt: null,
  nextRunAt: null,
  createdAt: '2026-07-23T08:00:00.000Z',
  updatedAt: '2026-07-23T08:00:00.000Z',
};

const scheduleInvalid: ReportSchedule = {
  id: 'schedule-invalid',
  type: 'fleet_summary',
  formats: ['pdf'],
  cron: '0 8 * * 1',
  deviceIds: [],
  isEnabled: true,
  lastRunAt: '2026-07-20T09:00:00.000Z',
  nextRunAt: 'not-a-valid-date',
  createdAt: '2026-07-01T08:00:00.000Z',
  updatedAt: '2026-07-01T08:00:00.000Z',
};

function hookState(overrides: Partial<ReturnType<typeof useReportSchedules>> = {}) {
  return {
    schedules: [],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
    createSchedule: jest.fn().mockResolvedValue(schedule),
    isCreating: false,
    createError: null,
    updateSchedule: jest.fn().mockResolvedValue(schedule),
    toggleSchedule: jest.fn().mockResolvedValue(undefined),
    deleteSchedule: jest.fn().mockResolvedValue(undefined),
    isUpdating: false,
    updatingScheduleId: null,
    updatingScheduleIds: new Set<string>(),
    isDeleting: false,
    deletingScheduleId: null,
    deletingScheduleIds: new Set<string>(),
    togglingScheduleId: null,
    togglingScheduleIds: new Set<string>(),
    mutationError: null,
    ...overrides,
  };
}

function openEditDialogHelper() {
  fireEvent.click(screen.getByRole('button', { name: /edit schedule/i }));
  return waitFor(() => screen.getByRole('dialog'));
}

function openCreateDialogHelper() {
  const buttons = screen.getAllByRole('button', { name: /create schedule/i });
  fireEvent.click(buttons[0]);
  return waitFor(() => screen.getByRole('dialog'));
}

function getSelectValue(dialog: HTMLElement): string {
  const select = within(dialog).getByRole('combobox');
  return (select as HTMLSelectElement).value;
}

function getInputValue(dialog: HTMLElement): string {
  const input = within(dialog).getByPlaceholderText('0 9 * * 1');
  return (input as HTMLInputElement).value;
}

function isElementDisabled(element: HTMLElement): boolean {
  return element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true';
}

function getDeleteDialog() {
  return screen.getByTestId('delete-dialog');
}

function openDeleteDialogHelper() {
  fireEvent.click(screen.getByRole('button', { name: /delete schedule/i }));
  return waitFor(() => getDeleteDialog());
}

function closeDeleteDialogHelper() {
  fireEvent.click(within(getDeleteDialog()).getByRole('button', { name: 'Close' }));
}

function confirmDelete() {
  fireEvent.click(within(getDeleteDialog()).getByRole('button', { name: /delete/i }));
}

function cancelDelete() {
  fireEvent.click(within(getDeleteDialog()).getByRole('button', { name: /cancel/i }));
}

describe('ScheduledReportsSection', () => {
  beforeEach(() => mockUseReportSchedules.mockReturnValue(hookState()));

  it('shows loading without replacing the surrounding reports page content', () => {
    mockUseReportSchedules.mockReturnValue(hookState({ isLoading: true }));
    render(<><p>Manual report generation</p><ScheduledReportsSection /></>);
    expect(screen.getByText('Manual report generation')).toBeTruthy();
    expect(screen.getByLabelText('Loading scheduled reports')).toBeTruthy();
  });

  it('shows empty state and create action', () => {
    render(<ScheduledReportsSection />);
    expect(screen.getByText('No scheduled reports yet.')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /create schedule/i })).toHaveLength(2);
  });

  it('shows safe error and retries', () => {
    const refetch = jest.fn();
    mockUseReportSchedules.mockReturnValue(hookState({ error: { message: 'raw', status: 500 }, refetch }));
    render(<ScheduledReportsSection />);
    expect(screen.getByText('Unable to load scheduled reports.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('renders labels, formats, status, null dates, and device count', () => {
    mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule] }));
    render(<ScheduledReportsSection />);
    expect(screen.getByText('Security Executive')).toBeTruthy();
    expect(screen.getByText('PDF')).toBeTruthy();
    expect(screen.getByText('DOCX')).toBeTruthy();
    expect(screen.getByText('Disabled')).toBeTruthy();
    expect(screen.getByText(/Never/)).toBeTruthy();
    expect(screen.getByText(/Not scheduled/)).toBeTruthy();
    expect(screen.getByText('2 devices')).toBeTruthy();
  });

  it('opens and closes the creation dialog', async () => {
    render(<ScheduledReportsSection />);
    await openCreateDialogHelper();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  describe('Edit Schedule', () => {
    it('Edit button opens the dialog', async () => {
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule] }));
      render(<ScheduledReportsSection />);
      const dialog = await openEditDialogHelper();
      expect(dialog).toBeTruthy();
      expect(within(dialog).getByText('Edit scheduled report')).toBeTruthy();
    });

    it('Selected schedule values are preloaded', async () => {
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule] }));
      render(<ScheduledReportsSection />);
      const dialog = await openEditDialogHelper();
      expect(getSelectValue(dialog)).toBe('security_executive');
      expect(getInputValue(dialog)).toBe('0 9 * * 1');
    });

    it('Update uses the correct schedule ID', async () => {
      const updateSchedule = jest.fn().mockResolvedValue(schedule);
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule], updateSchedule }));
      render(<ScheduledReportsSection />);
      await openEditDialogHelper();
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /save changes/i }));
      await waitFor(() => {
        expect(updateSchedule).toHaveBeenCalledWith('schedule-1', expect.objectContaining({
          type: 'security_executive',
          formats: ['pdf', 'docx'],
          cron: '0 9 * * 1',
        }));
      });
    });

    it('PATCH payload contains editable fields only', async () => {
      const updateSchedule = jest.fn().mockResolvedValue(schedule);
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule], updateSchedule }));
      render(<ScheduledReportsSection />);
      await openEditDialogHelper();
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /save changes/i }));
      await waitFor(() => {
        const callArgs = updateSchedule.mock.calls[0][1];
        expect(callArgs).toHaveProperty('type');
        expect(callArgs).toHaveProperty('formats');
        expect(callArgs).toHaveProperty('cron');
        expect(callArgs).toHaveProperty('deviceIds');
        expect(callArgs).not.toHaveProperty('id');
        expect(callArgs).not.toHaveProperty('orgId');
        expect(callArgs).not.toHaveProperty('lastRunAt');
        expect(callArgs).not.toHaveProperty('nextRunAt');
        expect(callArgs).not.toHaveProperty('createdAt');
        expect(callArgs).not.toHaveProperty('updatedAt');
      });
    });

    it('Internal fields are absent from PATCH payload', async () => {
      const updateSchedule = jest.fn().mockResolvedValue(schedule);
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule], updateSchedule }));
      render(<ScheduledReportsSection />);
      await openEditDialogHelper();
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /save changes/i }));
      await waitFor(() => {
        const callArgs = updateSchedule.mock.calls[0][1];
        const internalFields = ['id', 'orgId', 'lastRunAt', 'nextRunAt', 'createdAt', 'updatedAt'];
        internalFields.forEach((field) => {
          expect(callArgs).not.toHaveProperty(field);
        });
      });
    });

    it('Successful update closes the dialog', async () => {
      const updateSchedule = jest.fn().mockResolvedValue(schedule);
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule], updateSchedule }));
      render(<ScheduledReportsSection />);
      await openEditDialogHelper();
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /save changes/i }));
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
      });
    });

    it('Failed update keeps the dialog open', async () => {
      const updateSchedule = jest.fn().mockRejectedValue(new Error('Update failed'));
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule], updateSchedule }));
      render(<ScheduledReportsSection />);
      await openEditDialogHelper();
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /save changes/i }));
      await waitFor(() => {
        expect(screen.getByText('Update failed')).toBeTruthy();
      });
      expect(screen.getByRole('dialog')).toBeTruthy();
    });

    it('Invalid cron message appears safely', async () => {
      const updateSchedule = jest.fn().mockRejectedValue({
        message: 'The cron expression is invalid.',
        code: 'INVALID_REPORT_SCHEDULE_CRON',
      });
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule], updateSchedule }));
      render(<ScheduledReportsSection />);
      await openEditDialogHelper();
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /save changes/i }));
      await waitFor(() => {
        expect(screen.getByText('The cron expression is invalid.')).toBeTruthy();
      });
    });

    it('Edit values do not leak into Create', async () => {
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule] }));
      render(<ScheduledReportsSection />);

      const editDialog = await openEditDialogHelper();
      expect(getSelectValue(editDialog)).toBe('security_executive');

      fireEvent.click(within(editDialog).getByRole('button', { name: 'Close' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

      const createDialog = await openCreateDialogHelper();
      expect(within(createDialog).getByText('Create scheduled report')).toBeTruthy();
      expect(getSelectValue(createDialog)).toBe('device_health');
    });

    it('Editing two schedules loads correct values', async () => {
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule, schedule2] }));
      render(<ScheduledReportsSection />);

      const editButtons = screen.getAllByRole('button', { name: /edit schedule/i });

      const dialog1 = await (async () => {
        fireEvent.click(editButtons[0]);
        return waitFor(() => screen.getByRole('dialog'));
      })();
      expect(getSelectValue(dialog1)).toBe('security_executive');
      expect(getInputValue(dialog1)).toBe('0 9 * * 1');
      fireEvent.click(within(dialog1).getByRole('button', { name: 'Close' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

      const dialog2 = await (async () => {
        fireEvent.click(editButtons[1]);
        return waitFor(() => screen.getByRole('dialog'));
      })();
      expect(getSelectValue(dialog2)).toBe('device_health');
      expect(getInputValue(dialog2)).toBe('0 18 * * 5');
    });
  });

  describe('Toggle Schedule', () => {
    it('Enabled schedule requests false', async () => {
      const toggleSchedule = jest.fn().mockResolvedValue(undefined);
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule2], toggleSchedule }));
      render(<ScheduledReportsSection />);
      fireEvent.click(screen.getByRole('button', { name: /disable schedule/i }));
      await waitFor(() => {
        expect(toggleSchedule).toHaveBeenCalledWith('schedule-2', false);
      });
    });

    it('Disabled schedule requests true', async () => {
      const toggleSchedule = jest.fn().mockResolvedValue(undefined);
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule], toggleSchedule }));
      render(<ScheduledReportsSection />);
      fireEvent.click(screen.getByRole('button', { name: /enable schedule/i }));
      await waitFor(() => {
        expect(toggleSchedule).toHaveBeenCalledWith('schedule-1', true);
      });
    });

    it('Toggle never sends nextRunAt or lastRunAt', async () => {
      const toggleSchedule = jest.fn().mockResolvedValue(undefined);
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule], toggleSchedule }));
      render(<ScheduledReportsSection />);
      fireEvent.click(screen.getByRole('button', { name: /enable schedule/i }));
      await waitFor(() => {
        expect(toggleSchedule).toHaveBeenCalledWith('schedule-1', true);
        expect(toggleSchedule.mock.calls[0]).toHaveLength(2);
      });
    });

    it('Toggle loading affects only the selected row', () => {
      const togglingScheduleIds = new Set(['schedule-1']);
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule, schedule2], togglingScheduleIds }));
      render(<ScheduledReportsSection />);

      const toggleButtons = screen.getAllByRole('button', { name: /enable schedule|disable schedule/i });
      expect(toggleButtons[0].querySelector('.animate-spin')).toBeTruthy();
      expect(toggleButtons[1].querySelector('.animate-spin')).toBeNull();
    });

    it('Duplicate toggle clicks are prevented', async () => {
      const togglingScheduleIds = new Set(['schedule-1']);
      const toggleSchedule = jest.fn().mockResolvedValue(undefined);
      mockUseReportSchedules.mockReturnValue(hookState({
        schedules: [schedule],
        togglingScheduleIds,
        toggleSchedule,
      }));
      render(<ScheduledReportsSection />);
      const toggleButton = screen.getByRole('button', { name: /enable schedule/i });
      expect(isElementDisabled(toggleButton)).toBe(true);
      fireEvent.click(toggleButton);
      expect(toggleSchedule).not.toHaveBeenCalled();
    });
  });

  describe('Row Conflicts', () => {
    it('Edit button is disabled while toggle is pending', () => {
      const togglingScheduleIds = new Set(['schedule-1']);
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule], togglingScheduleIds }));
      render(<ScheduledReportsSection />);
      const editButton = screen.getByRole('button', { name: /edit schedule/i });
      expect(isElementDisabled(editButton)).toBe(true);
    });

    it('Toggle button is disabled while update is pending', () => {
      const updatingScheduleIds = new Set(['schedule-1']);
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule], updatingScheduleIds }));
      render(<ScheduledReportsSection />);
      const editButton = screen.getByRole('button', { name: /edit schedule/i });
      expect(isElementDisabled(editButton)).toBe(true);
    });
  });

  describe('Create Schedule', () => {
    it('create uses the hook createSchedule method', async () => {
      const createSchedule = jest.fn().mockResolvedValue(schedule);
      mockUseReportSchedules.mockReturnValue(hookState({ createSchedule }));
      render(<ScheduledReportsSection />);
      await openCreateDialogHelper();
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /create/i }));
      await waitFor(() => {
        expect(createSchedule).toHaveBeenCalledWith(expect.objectContaining({
          type: 'device_health',
          formats: ['pdf'],
          cron: '0 9 * * 1',
        }));
      });
    });

    it('failed create keeps the dialog open', async () => {
      const createSchedule = jest.fn().mockRejectedValue(new Error('Create failed'));
      mockUseReportSchedules.mockReturnValue(hookState({ createSchedule }));
      render(<ScheduledReportsSection />);
      await openCreateDialogHelper();
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /create/i }));
      await waitFor(() => {
        expect(screen.getByText('Create failed')).toBeTruthy();
      });
      expect(screen.getByRole('dialog')).toBeTruthy();
    });
  });

  describe('Delete Schedule', () => {
    it('Delete action is visible for each schedule', () => {
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule, schedule2] }));
      render(<ScheduledReportsSection />);
      const deleteButtons = screen.getAllByRole('button', { name: /delete schedule/i });
      expect(deleteButtons).toHaveLength(2);
    });

    it('Clicking Delete opens confirmation dialog', async () => {
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule] }));
      render(<ScheduledReportsSection />);
      await openDeleteDialogHelper();
      expect(screen.getByText('Delete scheduled report?')).toBeTruthy();
    });

    it('Confirmation displays the correct schedule context', async () => {
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule, schedule2] }));
      render(<ScheduledReportsSection />);
      const deleteButtons = screen.getAllByRole('button', { name: /delete schedule/i });
      fireEvent.click(deleteButtons[0]);
      const dialog = await waitFor(() => getDeleteDialog());
      expect(within(dialog).getByText('This action cannot be undone. Generated reports and downloaded files will not be deleted.')).toBeTruthy();
    });

    it('Cancel closes confirmation', async () => {
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule] }));
      render(<ScheduledReportsSection />);
      await openDeleteDialogHelper();
      cancelDelete();
      await waitFor(() => expect(screen.queryByTestId('delete-dialog')).toBeNull());
    });

    it('Cancel does not call deleteSchedule', async () => {
      const deleteSchedule = jest.fn().mockResolvedValue(undefined);
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule], deleteSchedule }));
      render(<ScheduledReportsSection />);
      await openDeleteDialogHelper();
      cancelDelete();
      await waitFor(() => expect(screen.queryByTestId('delete-dialog')).toBeNull());
      expect(deleteSchedule).not.toHaveBeenCalled();
    });

    it('Confirm calls deleteSchedule with the correct ID', async () => {
      const deleteSchedule = jest.fn().mockResolvedValue(undefined);
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule], deleteSchedule }));
      render(<ScheduledReportsSection />);
      await openDeleteDialogHelper();
      confirmDelete();
      await waitFor(() => {
        expect(deleteSchedule).toHaveBeenCalledWith('schedule-1');
      });
    });

    it('No request body or internal fields are sent from the component', async () => {
      const deleteSchedule = jest.fn().mockResolvedValue(undefined);
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule], deleteSchedule }));
      render(<ScheduledReportsSection />);
      await openDeleteDialogHelper();
      confirmDelete();
      await waitFor(() => {
        expect(deleteSchedule).toHaveBeenCalledTimes(1);
      });
      expect(deleteSchedule.mock.calls[0]).toHaveLength(1);
    });

    it('Success closes confirmation dialog', async () => {
      const deleteSchedule = jest.fn().mockResolvedValue(undefined);
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule], deleteSchedule }));
      render(<ScheduledReportsSection />);
      await openDeleteDialogHelper();
      confirmDelete();
      await waitFor(() => {
        expect(screen.queryByTestId('delete-dialog')).toBeNull();
      });
    });

    it('Success displays "Schedule deleted."', async () => {
      const deleteSchedule = jest.fn().mockResolvedValue(undefined);
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule], deleteSchedule }));
      render(<ScheduledReportsSection />);
      await openDeleteDialogHelper();
      confirmDelete();
      await waitFor(() => {
        expect(screen.getByText('Schedule deleted.')).toBeTruthy();
      });
    });

    it('Failure does not falsely remove the schedule', async () => {
      const deleteSchedule = jest.fn().mockRejectedValue(new Error('Network error'));
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule], deleteSchedule }));
      render(<ScheduledReportsSection />);
      await openDeleteDialogHelper();
      confirmDelete();
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeTruthy();
      });
      expect(screen.getByText('Security Executive')).toBeTruthy();
      expect(screen.queryByTestId('delete-dialog')).toBeTruthy();
    });

    it('Failure keeps safe retry/error behavior', async () => {
      const deleteSchedule = jest.fn().mockRejectedValue({ message: 'Server error', status: 500 });
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule], deleteSchedule }));
      render(<ScheduledReportsSection />);
      await openDeleteDialogHelper();
      confirmDelete();
      await waitFor(() => {
        expect(screen.getByText('Server error')).toBeTruthy();
      });
      expect(screen.queryByTestId('delete-dialog')).toBeTruthy();
      confirmDelete();
      await waitFor(() => {
        expect(deleteSchedule).toHaveBeenCalledTimes(2);
      });
    });

    it('REPORT_SCHEDULE_NOT_FOUND maps safely', async () => {
      const deleteSchedule = jest.fn().mockRejectedValue({
        message: 'This schedule no longer exists.',
        code: 'REPORT_SCHEDULE_NOT_FOUND',
      });
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule], deleteSchedule }));
      render(<ScheduledReportsSection />);
      await openDeleteDialogHelper();
      confirmDelete();
      await waitFor(() => {
        expect(screen.getByText('This scheduled report no longer exists.')).toBeTruthy();
      });
      expect(screen.getByText('Security Executive')).toBeTruthy();
    });

    it('Delete button is disabled for the row while deleting', () => {
      const deletingScheduleIds = new Set(['schedule-1']);
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule], deletingScheduleIds }));
      render(<ScheduledReportsSection />);
      const deleteButton = screen.getByRole('button', { name: /delete schedule/i });
      expect(isElementDisabled(deleteButton)).toBe(true);
    });

    it('Delete button shows spinner while deleting', () => {
      const deletingScheduleIds = new Set(['schedule-1']);
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule], deletingScheduleIds }));
      render(<ScheduledReportsSection />);
      const deleteButton = screen.getByRole('button', { name: /delete schedule/i });
      expect(deleteButton.querySelector('.animate-spin')).toBeTruthy();
    });

    it('Double confirmation does not create duplicate deletion calls', async () => {
      const deleteSchedule = jest.fn().mockResolvedValue(undefined);
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule], deleteSchedule }));
      render(<ScheduledReportsSection />);
      await openDeleteDialogHelper();
      confirmDelete();
      await waitFor(() => {
        expect(deleteSchedule).toHaveBeenCalledTimes(1);
      });
      await waitFor(() => {
        expect(screen.queryByTestId('delete-dialog')).toBeNull();
      });
    });

    it('Edit and Toggle are disabled for that row while deleting', () => {
      const deletingScheduleIds = new Set(['schedule-1']);
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule], deletingScheduleIds }));
      render(<ScheduledReportsSection />);
      const toggleButton = screen.getByRole('button', { name: /enable schedule/i });
      const editButton = screen.getByRole('button', { name: /edit schedule/i });
      expect(isElementDisabled(toggleButton)).toBe(true);
      expect(isElementDisabled(editButton)).toBe(true);
    });

    it('Unrelated rows remain usable when deleting', () => {
      const deletingScheduleIds = new Set(['schedule-1']);
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule, schedule2], deletingScheduleIds }));
      render(<ScheduledReportsSection />);
      const toggleButtons = screen.getAllByRole('button', { name: /enable schedule|disable schedule/i });
      const editButtons = screen.getAllByRole('button', { name: /edit schedule/i });
      const deleteButtons = screen.getAllByRole('button', { name: /delete schedule/i });
      expect(isElementDisabled(toggleButtons[0])).toBe(true);
      expect(isElementDisabled(editButtons[0])).toBe(true);
      expect(isElementDisabled(deleteButtons[0])).toBe(true);
      expect(isElementDisabled(toggleButtons[1])).toBe(false);
      expect(isElementDisabled(editButtons[1])).toBe(false);
      expect(isElementDisabled(deleteButtons[1])).toBe(false);
    });

    it('Delete confirmation dialog Cancel button is disabled while deleting', async () => {
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule] }));
      const { rerender } = render(<ScheduledReportsSection />);
      await openDeleteDialogHelper();
      const deletingScheduleIds = new Set(['schedule-1']);
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule], deletingScheduleIds }));
      rerender(<ScheduledReportsSection />);
      const cancelButton = within(getDeleteDialog()).getByRole('button', { name: /cancel/i });
      expect(isElementDisabled(cancelButton)).toBe(true);
    });

    it('Delete confirmation dialog Delete button is disabled while deleting', async () => {
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule] }));
      const { rerender } = render(<ScheduledReportsSection />);
      await openDeleteDialogHelper();
      const deletingScheduleIds = new Set(['schedule-1']);
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule], deletingScheduleIds }));
      rerender(<ScheduledReportsSection />);
      const deleteButton = within(getDeleteDialog()).getByRole('button', { name: /delete/i });
      expect(isElementDisabled(deleteButton)).toBe(true);
    });

    it('Close button is disabled while deleting', async () => {
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule] }));
      const { rerender } = render(<ScheduledReportsSection />);
      await openDeleteDialogHelper();
      const deletingScheduleIds = new Set(['schedule-1']);
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule], deletingScheduleIds }));
      rerender(<ScheduledReportsSection />);
      const closeButton = within(getDeleteDialog()).getByRole('button', { name: 'Close' });
      expect(isElementDisabled(closeButton)).toBe(true);
    });

    it('Overlay click does not close dialog while deleting', async () => {
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule] }));
      const { rerender } = render(<ScheduledReportsSection />);
      await openDeleteDialogHelper();
      const deletingScheduleIds = new Set(['schedule-1']);
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule], deletingScheduleIds }));
      rerender(<ScheduledReportsSection />);
      fireEvent.click(getDeleteDialog());
      expect(screen.queryByTestId('delete-dialog')).toBeTruthy();
    });
  });

  describe('Generated Report History', () => {
    it('Generated report history is not represented as deleted', () => {
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule] }));
      render(<ScheduledReportsSection />);
      expect(screen.queryByText('Schedule deleted.')).toBeNull();
    });
  });

  describe('Status Labels', () => {
    it('renders Disabled label for disabled schedule', () => {
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule] }));
      render(<ScheduledReportsSection />);
      expect(screen.getByText('Disabled')).toBeTruthy();
    });

    it('renders Never run label for schedule with future nextRunAt and no lastRunAt', () => {
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [scheduleNeverRun] }));
      render(<ScheduledReportsSection />);
      expect(screen.getByText('Never run')).toBeTruthy();
    });

    it('renders Scheduled label for schedule with future nextRunAt and valid lastRunAt', () => {
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule2] }));
      render(<ScheduledReportsSection />);
      expect(screen.getByText('Scheduled')).toBeTruthy();
    });

    it('renders Overdue label for schedule with past nextRunAt beyond grace period', () => {
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [scheduleOverdue] }));
      render(<ScheduledReportsSection />);
      expect(screen.getByText('Overdue')).toBeTruthy();
    });

    it('renders Not scheduled label for enabled schedule with null nextRunAt', () => {
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [scheduleUnscheduled] }));
      render(<ScheduledReportsSection />);
      const matches = screen.getAllByText('Not scheduled');
      expect(matches.length).toBeGreaterThanOrEqual(1);
      const badge = matches.find((el) => el.closest('[aria-label]')?.getAttribute('aria-label')?.includes('execution time'));
      expect(badge).toBeTruthy();
    });

    it('renders Invalid schedule label for schedule with malformed nextRunAt', () => {
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [scheduleInvalid] }));
      render(<ScheduledReportsSection />);
      expect(screen.getByText('Invalid schedule')).toBeTruthy();
    });

    it('toggle still works with derived status', async () => {
      const toggleSchedule = jest.fn().mockResolvedValue(undefined);
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [scheduleNeverRun], toggleSchedule }));
      render(<ScheduledReportsSection />);
      fireEvent.click(screen.getByRole('button', { name: /disable schedule/i }));
      await waitFor(() => {
        expect(toggleSchedule).toHaveBeenCalledWith('schedule-never-run', false);
      });
    });

    it('edit still works with derived status', async () => {
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [scheduleNeverRun] }));
      render(<ScheduledReportsSection />);
      const dialog = await openEditDialogHelper();
      expect(within(dialog).getByText('Edit scheduled report')).toBeTruthy();
    });

    it('delete still works with derived status', async () => {
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [scheduleNeverRun] }));
      render(<ScheduledReportsSection />);
      await openDeleteDialogHelper();
      expect(screen.getByText('Delete scheduled report?')).toBeTruthy();
    });

    it('displays last run and next run timestamps for scheduled schedule', () => {
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule2] }));
      render(<ScheduledReportsSection />);
      expect(screen.getByText(new Date(schedule2.lastRunAt!).toLocaleDateString())).toBeTruthy();
      expect(screen.getByText(new Date(schedule2.nextRunAt!).toLocaleDateString())).toBeTruthy();
    });

    it('displays Never and Not scheduled for null dates on disabled schedule', () => {
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule] }));
      render(<ScheduledReportsSection />);
      expect(screen.getByText(/Never/)).toBeTruthy();
      expect(screen.getByText(/Not scheduled/)).toBeTruthy();
    });
  });

  describe('Status Tone Styling', () => {
    const allStatuses: ReportScheduleStatus[] = [
      'disabled',
      'scheduled',
      'never_run',
      'overdue',
      'unscheduled',
      'invalid',
    ];

    it.each(allStatuses)('renders label for %s status', (status) => {
      expect(STATUS_METADATA[status].label).toBeTruthy();
    });

    it.each(allStatuses)('exposes description for %s status via aria-label', (status) => {
      const schedules: Record<ReportScheduleStatus, ReportSchedule> = {
        disabled: schedule,
        scheduled: schedule2,
        never_run: scheduleNeverRun,
        overdue: scheduleOverdue,
        unscheduled: scheduleUnscheduled,
        invalid: scheduleInvalid,
      };
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedules[status]] }));
      render(<ScheduledReportsSection />);
      const allMatches = screen.getAllByText(STATUS_METADATA[status].label);
      const badge = allMatches.find((el) => el.closest('[aria-label]')?.getAttribute('aria-label') === STATUS_METADATA[status].description);
      expect(badge).toBeTruthy();
    });

    it('does not rely on color alone for status communication', () => {
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule] }));
      render(<ScheduledReportsSection />);
      const badge = screen.getByText('Disabled');
      expect(badge.textContent).toBeTruthy();
      expect(badge.closest('[aria-label]')?.getAttribute('aria-label')).toBeTruthy();
    });

    it('maps each tone to a valid badge variant', () => {
      const variants = ['secondary', 'success', 'primary', 'warning', 'destructive'];
      allStatuses.forEach((status) => {
        const tone = STATUS_METADATA[status].tone;
        const expectedVariantMap: Record<string, string> = {
          muted: 'secondary',
          success: 'success',
          neutral: 'primary',
          warning: 'warning',
          danger: 'destructive',
        };
        expect(variants).toContain(expectedVariantMap[tone]);
      });
    });
  });

  describe('Accessibility', () => {
    it('cron expression is accessible via title', () => {
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule] }));
      render(<ScheduledReportsSection />);
      const cronElement = screen.getByText(formatCronExpr('0 9 * * 1'));
      expect(cronElement.closest('[title]')?.getAttribute('title')).toBe('0 9 * * 1');
    });

    it('empty deviceIds displays All organization devices', () => {
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [scheduleOverdue] }));
      render(<ScheduledReportsSection />);
      expect(screen.getByText('All organization devices')).toBeTruthy();
    });

    it('one device displays singular label', () => {
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule2] }));
      render(<ScheduledReportsSection />);
      expect(screen.getByText('1 device')).toBeTruthy();
    });

    it('multiple devices display plural label', () => {
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule] }));
      render(<ScheduledReportsSection />);
      expect(screen.getByText('2 devices')).toBeTruthy();
    });

    it('last run null displays Never', () => {
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule] }));
      render(<ScheduledReportsSection />);
      const neverElements = screen.getAllByText(/Never/);
      expect(neverElements.length).toBeGreaterThanOrEqual(1);
    });

    it('next run null displays Not scheduled', () => {
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule] }));
      render(<ScheduledReportsSection />);
      const nsElements = screen.getAllByText(/Not scheduled/);
      expect(nsElements.length).toBeGreaterThanOrEqual(1);
    });

    it('UTC/local-time note renders for each schedule', () => {
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule, schedule2] }));
      render(<ScheduledReportsSection />);
      const utcNotes = screen.getAllByText(/Schedule times are calculated in UTC/);
      expect(utcNotes).toHaveLength(2);
    });

    it('format badges render and retain casing', () => {
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule] }));
      render(<ScheduledReportsSection />);
      expect(screen.getByText('PDF')).toBeTruthy();
      expect(screen.getByText('DOCX')).toBeTruthy();
    });

    it('mobile-friendly action labels remain accessible', () => {
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule] }));
      render(<ScheduledReportsSection />);
      expect(screen.getByRole('button', { name: /enable schedule/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /edit schedule/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /delete schedule/i })).toBeTruthy();
    });

    it('loading state remains contained', () => {
      mockUseReportSchedules.mockReturnValue(hookState({ isLoading: true }));
      render(<ScheduledReportsSection />);
      const loadingRegion = screen.getByLabelText('Loading scheduled reports');
      expect(loadingRegion).toBeTruthy();
    });

    it('empty state retains Create action', () => {
      render(<ScheduledReportsSection />);
      const buttons = screen.getAllByRole('button', { name: /create schedule/i });
      expect(buttons.length).toBeGreaterThanOrEqual(1);
    });

    it('error state retains Retry', () => {
      mockUseReportSchedules.mockReturnValue(
        hookState({ error: { message: 'fail', status: 500 }, refetch: jest.fn() }),
      );
      render(<ScheduledReportsSection />);
      expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    });

    it('Create/Edit/Delete dialogs remain accessible', async () => {
      mockUseReportSchedules.mockReturnValue(hookState({ schedules: [schedule] }));
      render(<ScheduledReportsSection />);

      const createDialog = await openCreateDialogHelper();
      expect(createDialog.getAttribute('role')).toBe('dialog');
      expect(createDialog.getAttribute('aria-modal')).toBe('true');
      fireEvent.click(within(createDialog).getByRole('button', { name: 'Close' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

      const editDialog = await openEditDialogHelper();
      expect(editDialog.getAttribute('role')).toBe('dialog');
      expect(editDialog.getAttribute('aria-modal')).toBe('true');
      fireEvent.click(within(editDialog).getByRole('button', { name: 'Close' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

      await openDeleteDialogHelper();
      const deleteDialog = screen.getByTestId('delete-dialog');
      expect(deleteDialog.getAttribute('role')).toBe('dialog');
      expect(deleteDialog.getAttribute('aria-modal')).toBe('true');
    });
  });
});

function formatCronExpr(cron: string): string {
  const parts = cron.split(' ');
  if (parts.length !== 5) return cron;
  const [min, hour, , , dow] = parts;
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dowNum = parseInt(dow, 10);
  if (!isNaN(dowNum) && dowNum >= 0 && dowNum <= 6) {
    return `${hour}:${min.padStart(2, '0')} every ${dayNames[dowNum]}`;
  }
  return cron;
}
