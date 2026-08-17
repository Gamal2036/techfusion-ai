import { act, renderHook, waitFor } from '@testing-library/react';
import { useReportSchedules } from '@/hooks/useReportSchedules';
import { apiFetch } from '@/lib/auth-client';

jest.mock('@/lib/auth-client', () => ({ ...jest.requireActual('@/lib/auth-client'), apiFetch: jest.fn(), isLoggingOut: jest.fn().mockReturnValue(false) }));

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const schedule = {
  id: 'schedule-1',
  type: 'device_health',
  formats: ['pdf'],
  cron: '0 8 * * *',
  deviceIds: [],
  isEnabled: true,
  lastRunAt: null,
  nextRunAt: '2026-07-24T08:00:00.000Z',
  createdAt: '2026-07-23T08:00:00.000Z',
  updatedAt: '2026-07-23T08:00:00.000Z',
};

describe('useReportSchedules', () => {
  beforeEach(() => mockApiFetch.mockReset());

  it('fetches schedules on mount and exposes list data', async () => {
    mockApiFetch.mockResolvedValueOnce(jsonResponse([schedule]));

    const { result } = renderHook(() => useReportSchedules());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockApiFetch).toHaveBeenCalledWith('/reports/schedules');
    expect(result.current.schedules).toEqual([schedule]);
  });

  it('uses a safe list error and supports retry', async () => {
    mockApiFetch
      .mockResolvedValueOnce(jsonResponse({ message: 'internal details' }, 500))
      .mockResolvedValueOnce(jsonResponse([]));

    const { result } = renderHook(() => useReportSchedules());
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toBe('Unable to load scheduled reports.');

    await act(async () => { await result.current.refetch(); });
    expect(result.current.error).toBeNull();
    expect(result.current.schedules).toEqual([]);
  });

  it('posts only editable fields, then refetches', async () => {
    mockApiFetch
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(schedule))
      .mockResolvedValueOnce(jsonResponse([schedule]));

    const { result } = renderHook(() => useReportSchedules());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.createSchedule({
        type: 'device_health',
        formats: ['pdf', 'html'],
        cron: '0 8 * * *',
        deviceIds: [],
        isEnabled: true,
      });
    });

    const createCall = mockApiFetch.mock.calls[1];
    expect(createCall[0]).toBe('/reports/schedules');
    expect(JSON.parse(String(createCall[1]?.body))).toEqual({
      type: 'device_health',
      formats: ['pdf', 'html'],
      cron: '0 8 * * *',
      deviceIds: [],
      isEnabled: true,
    });
    expect(JSON.parse(String(createCall[1]?.body))).not.toHaveProperty('orgId');
    expect(JSON.parse(String(createCall[1]?.body))).not.toHaveProperty('nextRunAt');
    expect(mockApiFetch).toHaveBeenCalledTimes(3);
  });

  it('maps invalid cron to a safe field-level error and preserves create failure', async () => {
    mockApiFetch
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({ code: 'INVALID_REPORT_SCHEDULE_CRON' }, 400));

    const { result } = renderHook(() => useReportSchedules());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await expect(result.current.createSchedule({
        type: 'device_health',
        formats: ['pdf'],
        cron: 'not-cron',
      })).rejects.toMatchObject({ code: 'INVALID_REPORT_SCHEDULE_CRON' });
    });

    expect(result.current.createError?.message).toBe('The cron expression is invalid.');
  });

  it('updates only editable fields and refetches the list', async () => {
    mockApiFetch
      .mockResolvedValueOnce(jsonResponse([schedule]))
      .mockResolvedValueOnce(jsonResponse(schedule))
      .mockResolvedValueOnce(jsonResponse([schedule]));
    const { result } = renderHook(() => useReportSchedules());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateSchedule('schedule-1', {
        type: 'security_executive',
        formats: ['pdf'],
        cron: '0 9 * * 1',
        deviceIds: ['device-1'],
        isEnabled: false,
      });
    });

    expect(mockApiFetch.mock.calls[1]).toEqual([
      '/reports/schedules/schedule-1',
      expect.objectContaining({ method: 'PATCH' }),
    ]);
    expect(JSON.parse(String(mockApiFetch.mock.calls[1][1]?.body))).toEqual({
      type: 'security_executive',
      formats: ['pdf'],
      cron: '0 9 * * 1',
      deviceIds: ['device-1'],
      isEnabled: false,
    });
    expect(JSON.parse(String(mockApiFetch.mock.calls[1][1]?.body))).not.toEqual(
      expect.objectContaining({ id: 'schedule-1', orgId: 'org-1', lastRunAt: null, nextRunAt: null }),
    );
    expect(mockApiFetch).toHaveBeenCalledTimes(3);
  });

  it('preserves a safe structured update error', async () => {
    mockApiFetch
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({ code: 'INVALID_REPORT_SCHEDULE_CRON', message: 'stack trace' }, 400));
    const { result } = renderHook(() => useReportSchedules());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await expect(result.current.updateSchedule('schedule-1', { cron: 'bad' }))
        .rejects.toMatchObject({ code: 'INVALID_REPORT_SCHEDULE_CRON' });
    });
    expect(result.current.mutationError).toEqual({
      code: 'INVALID_REPORT_SCHEDULE_CRON',
      message: 'The cron expression is invalid.',
      status: 400,
    });
  });

  it('deletes only after backend success and refetches', async () => {
    mockApiFetch
      .mockResolvedValueOnce(jsonResponse([schedule]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse([]));
    const { result } = renderHook(() => useReportSchedules());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.deleteSchedule('schedule-1'); });
    expect(mockApiFetch.mock.calls[1]).toEqual([
      '/reports/schedules/schedule-1',
      { method: 'DELETE' },
    ]);
    expect(mockApiFetch).toHaveBeenCalledTimes(3);
  });

  it('does not refetch after a failed delete', async () => {
    mockApiFetch
      .mockResolvedValueOnce(jsonResponse([schedule]))
      .mockResolvedValueOnce(jsonResponse({ code: 'REPORT_SCHEDULE_NOT_FOUND' }, 404));
    const { result } = renderHook(() => useReportSchedules());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await expect(result.current.deleteSchedule('schedule-1')).rejects.toMatchObject({
        code: 'REPORT_SCHEDULE_NOT_FOUND',
      });
    });
    expect(mockApiFetch).toHaveBeenCalledTimes(2);
    expect(result.current.schedules).toEqual([schedule]);
  });

  it('toggles with only isEnabled and refetches', async () => {
    mockApiFetch
      .mockResolvedValueOnce(jsonResponse([schedule]))
      .mockResolvedValueOnce(jsonResponse({ ...schedule, isEnabled: false }))
      .mockResolvedValueOnce(jsonResponse([{ ...schedule, isEnabled: false }]));
    const { result } = renderHook(() => useReportSchedules());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.toggleSchedule('schedule-1', false); });
    expect(JSON.parse(String(mockApiFetch.mock.calls[1][1]?.body))).toEqual({ isEnabled: false });
    expect(result.current.togglingScheduleId).toBeNull();
    expect(mockApiFetch).toHaveBeenCalledTimes(3);
  });

  it('prevents duplicate same-action requests and scopes loading to each row', async () => {
    let resolveUpdate!: (response: Response) => void;
    mockApiFetch
      .mockResolvedValueOnce(jsonResponse([]))
      .mockReturnValueOnce(new Promise<Response>((resolve) => { resolveUpdate = resolve; }));
    const { result } = renderHook(() => useReportSchedules());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let firstUpdate!: Promise<unknown>;
    act(() => { firstUpdate = result.current.updateSchedule('schedule-1', { isEnabled: true }); });
    await waitFor(() => {
      expect(result.current.updatingScheduleId).toBe('schedule-1');
      expect(result.current.updatingScheduleIds).toEqual(new Set(['schedule-1']));
    });
    await act(async () => {
      await expect(result.current.updateSchedule('schedule-1', { isEnabled: false }))
        .rejects.toMatchObject({ message: 'This schedule is already being changed.' });
    });
    expect(mockApiFetch).toHaveBeenCalledTimes(2);

    resolveUpdate(jsonResponse(schedule));
    mockApiFetch.mockResolvedValueOnce(jsonResponse([schedule]));
    await act(async () => { await firstUpdate; });
    expect(result.current.updatingScheduleIds).toEqual(new Set());
    expect(result.current.isUpdating).toBe(false);
  });
});
