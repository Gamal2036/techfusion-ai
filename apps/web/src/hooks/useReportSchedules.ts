'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/auth-client';
import type { CreateScheduleInput, ReportSchedule, ReportScheduleFormat, ReportScheduleType } from '@techfusion/types';

export interface ReportScheduleError {
  message: string;
  status: number;
  code?: string;
}

interface ScheduleErrorBody {
  message?: string;
  code?: string;
}

export interface UpdateReportScheduleInput {
  type?: ReportScheduleType;
  formats?: ReportScheduleFormat[];
  cron?: string;
  deviceIds?: string[];
  isEnabled?: boolean;
}

/** @deprecated Use UpdateReportScheduleInput. */
export type UpdateScheduleInput = UpdateReportScheduleInput;

const safeErrorCodes = new Set([
  'INVALID_REPORT_SCHEDULE_CRON',
  'INVALID_REPORT_SCHEDULE_FORMAT',
  'REPORT_SCHEDULE_NOT_FOUND',
  'REPORT_SCHEDULE_DEVICE_NOT_FOUND',
  'REPORT_SCHEDULE_DEVICE_FORBIDDEN',
]);

async function readErrorBody(response: Response): Promise<ScheduleErrorBody> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === 'object') {
      const candidate = body as Record<string, unknown>;
      return {
        message: typeof candidate.message === 'string' ? candidate.message : undefined,
        code: typeof candidate.code === 'string' ? candidate.code : undefined,
      };
    }
  } catch {
    // The caller uses the safe fallback when the response is not JSON.
  }
  return {};
}

function scheduleError(response: Response, body: ScheduleErrorBody, fallback: string): ReportScheduleError {
  const messages: Record<string, string> = {
    INVALID_REPORT_SCHEDULE_CRON: 'The cron expression is invalid.',
    INVALID_REPORT_SCHEDULE_FORMAT: 'Select at least one supported report format.',
    REPORT_SCHEDULE_NOT_FOUND: 'This schedule no longer exists.',
    REPORT_SCHEDULE_DEVICE_NOT_FOUND: 'One or more selected devices no longer exist.',
    REPORT_SCHEDULE_DEVICE_FORBIDDEN: 'One or more selected devices are not available to this organization.',
  };
  return {
    message: body.code && safeErrorCodes.has(body.code) ? messages[body.code] : fallback,
    status: response.status,
    code: body.code,
  };
}

function parseSchedules(data: unknown): ReportSchedule[] {
  if (Array.isArray(data)) return data as ReportSchedule[];
  if (data && typeof data === 'object' && Array.isArray((data as { data?: unknown }).data)) {
    return (data as { data: ReportSchedule[] }).data;
  }
  return [];
}

function asScheduleError(cause: unknown, fallback: string): ReportScheduleError {
  if (cause && typeof cause === 'object' && 'status' in cause
    && typeof (cause as { status?: unknown }).status === 'number'
    && typeof (cause as { message?: unknown }).message === 'string') {
    return cause as ReportScheduleError;
  }
  return { message: fallback, status: 0 };
}

function duplicateMutationError(): ReportScheduleError {
  return { message: 'This schedule is already being changed.', status: 0 };
}

export function useReportSchedules() {
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ReportScheduleError | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<ReportScheduleError | null>(null);
  const [updatingScheduleId, setUpdatingScheduleId] = useState<string | null>(null);
  const [updatingScheduleIds, setUpdatingScheduleIds] = useState<Set<string>>(new Set());
  const [deletingScheduleId, setDeletingScheduleId] = useState<string | null>(null);
  const [deletingScheduleIds, setDeletingScheduleIds] = useState<Set<string>>(new Set());
  const [togglingScheduleId, setTogglingScheduleId] = useState<string | null>(null);
  const [togglingScheduleIds, setTogglingScheduleIds] = useState<Set<string>>(new Set());
  const [mutationError, setMutationError] = useState<ReportScheduleError | null>(null);
  const mountedRef = useRef(true);
  const activeMutationKeysRef = useRef(new Set<string>());

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const fetchSchedules = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiFetch('/reports/schedules');
      if (!response.ok) {
        const body = await readErrorBody(response);
        throw scheduleError(response, body, 'Unable to load scheduled reports.');
      }
      const data: unknown = await response.json();
      if (mountedRef.current) setSchedules(parseSchedules(data));
    } catch (cause) {
      if (!mountedRef.current) return;
      setError(cause && typeof cause === 'object' && 'status' in cause
        ? cause as ReportScheduleError
        : { message: 'Unable to load scheduled reports.', status: 0 });
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  const createSchedule = useCallback(async (input: CreateScheduleInput) => {
    setIsCreating(true);
    setCreateError(null);
    try {
      const response = await apiFetch('/reports/schedules', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const body = await readErrorBody(response);
        throw scheduleError(response, body, 'Unable to create scheduled report.');
      }
      const data: unknown = await response.json();
      await fetchSchedules();
      return data as ReportSchedule;
    } catch (cause) {
      const nextError = cause && typeof cause === 'object' && 'status' in cause
        ? cause as ReportScheduleError
        : { message: 'Unable to create scheduled report.', status: 0 };
      if (mountedRef.current) setCreateError(nextError);
      throw nextError;
    } finally {
      if (mountedRef.current) setIsCreating(false);
    }
  }, [fetchSchedules]);

  const updateSchedule = useCallback(async (id: string, input: UpdateReportScheduleInput) => {
    const mutationKey = `update:${id}`;
    if (activeMutationKeysRef.current.has(mutationKey)) {
      const duplicateError = duplicateMutationError();
      if (mountedRef.current) setMutationError(duplicateError);
      throw duplicateError;
    }
    activeMutationKeysRef.current.add(mutationKey);
    setUpdatingScheduleId(id);
    setUpdatingScheduleIds((current) => new Set(current).add(id));
    setMutationError(null);
    try {
      const { type, formats, cron, deviceIds, isEnabled } = input;
      const response = await apiFetch(`/reports/schedules/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ type, formats, cron, deviceIds, isEnabled }),
      });
      if (!response.ok) {
        const body = await readErrorBody(response);
        throw scheduleError(response, body, 'Unable to update the scheduled report.');
      }
      const data: unknown = await response.json();
      await fetchSchedules();
      return data as ReportSchedule;
    } catch (cause) {
      const nextError = asScheduleError(cause, 'Unable to update the scheduled report.');
      if (mountedRef.current) setMutationError(nextError);
      throw nextError;
    } finally {
      activeMutationKeysRef.current.delete(mutationKey);
      if (mountedRef.current) {
        setUpdatingScheduleId((current) => current === id ? null : current);
        setUpdatingScheduleIds((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
      }
    }
  }, [fetchSchedules]);

  const togglingSchedule = useCallback(async (id: string, isEnabled: boolean) => {
    const mutationKey = `toggle:${id}`;
    if (activeMutationKeysRef.current.has(mutationKey)) {
      const duplicateError = duplicateMutationError();
      if (mountedRef.current) setMutationError(duplicateError);
      throw duplicateError;
    }
    activeMutationKeysRef.current.add(mutationKey);
    setTogglingScheduleId(id);
    setTogglingScheduleIds((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
    setMutationError(null);
    try {
      const response = await apiFetch(`/reports/schedules/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isEnabled }),
      });
      if (!response.ok) {
        const body = await readErrorBody(response);
        throw scheduleError(response, body, 'Unable to update the scheduled report.');
      }
      const data: unknown = await response.json();
      await fetchSchedules();
      return data as ReportSchedule;
    } catch (cause) {
      const nextError = asScheduleError(cause, 'Unable to update the scheduled report.');
      if (mountedRef.current) setMutationError(nextError);
      throw nextError;
    } finally {
      activeMutationKeysRef.current.delete(mutationKey);
      if (mountedRef.current) {
        setTogglingScheduleId(null);
        setTogglingScheduleIds((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
      }
    }
  }, [fetchSchedules]);

  const toggleSchedule = togglingSchedule;

  const deleteSchedule = useCallback(async (id: string) => {
    const mutationKey = `delete:${id}`;
    if (activeMutationKeysRef.current.has(mutationKey)) {
      const duplicateError = duplicateMutationError();
      if (mountedRef.current) setMutationError(duplicateError);
      throw duplicateError;
    }
    activeMutationKeysRef.current.add(mutationKey);
    setDeletingScheduleId(id);
    setDeletingScheduleIds((current) => new Set(current).add(id));
    setMutationError(null);
    try {
      const response = await apiFetch(`/reports/schedules/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const body = await readErrorBody(response);
        throw scheduleError(response, body, 'Unable to delete the scheduled report.');
      }
      await response.json().catch(() => undefined);
      await fetchSchedules();
    } catch (cause) {
      const nextError = asScheduleError(cause, 'Unable to delete the scheduled report.');
      if (mountedRef.current) setMutationError(nextError);
      throw nextError;
    } finally {
      activeMutationKeysRef.current.delete(mutationKey);
      if (mountedRef.current) {
        setDeletingScheduleId((current) => current === id ? null : current);
        setDeletingScheduleIds((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
      }
    }
  }, [fetchSchedules]);

  useEffect(() => {
    void fetchSchedules();
  }, [fetchSchedules]);

  return {
    schedules,
    isLoading,
    error,
    refetch: fetchSchedules,
    createSchedule,
    isCreating,
    createError,
    updateSchedule,
    toggleSchedule,
    deleteSchedule,
    isUpdating: updatingScheduleIds.size > 0,
    updatingScheduleId,
    updatingScheduleIds,
    isDeleting: deletingScheduleIds.size > 0,
    deletingScheduleId,
    deletingScheduleIds,
    togglingScheduleId,
    togglingScheduleIds,
    mutationError,
  };
}
