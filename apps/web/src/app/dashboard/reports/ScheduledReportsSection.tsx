'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassPanel, Badge, Button } from '@techfusion/ui';
import {
  Plus,
  Loader2,
  AlertTriangle,
  Calendar,
  Clock,
  Edit3,
  Power,
  Trash2,
  X,
} from 'lucide-react';
import { useReportSchedules } from '@/hooks/useReportSchedules';
import {
  deriveReportScheduleStatus,
  STATUS_METADATA,
} from '@/lib/report-schedule-status';
import type {
  ReportSchedule,
  ReportScheduleType,
  ReportScheduleFormat,
} from '@techfusion/types';
import type { StatusTone } from '@/lib/report-schedule-status';

const REPORT_TYPES: { value: ReportScheduleType; label: string }[] = [
  { value: 'device_health', label: 'Device Health' },
  { value: 'security_executive', label: 'Security Executive' },
  { value: 'fleet_summary', label: 'Fleet Summary' },
];

const REPORT_FORMATS: { value: ReportScheduleFormat; label: string }[] = [
  { value: 'pdf', label: 'PDF' },
  { value: 'docx', label: 'DOCX' },
  { value: 'html', label: 'HTML' },
];

const STATUS_TONE_VARIANT: Record<StatusTone, 'secondary' | 'success' | 'primary' | 'warning' | 'destructive'> = {
  muted: 'secondary',
  success: 'success',
  neutral: 'primary',
  warning: 'warning',
  danger: 'destructive',
};

interface ScheduleFormData {
  type: ReportScheduleType;
  formats: ReportScheduleFormat[];
  cron: string;
  deviceIds: string[];
}

const DEFAULT_FORM_DATA: ScheduleFormData = {
  type: 'device_health',
  formats: ['pdf'],
  cron: '0 9 * * 1',
  deviceIds: [],
};

const SAFE_ERROR_MESSAGES: Record<string, string> = {
  INVALID_REPORT_SCHEDULE_CRON: 'The cron expression is invalid.',
  INVALID_REPORT_SCHEDULE_FORMAT: 'Select at least one supported format.',
  REPORT_SCHEDULE_NOT_FOUND: 'This scheduled report no longer exists.',
  REPORT_SCHEDULE_DEVICE_NOT_FOUND:
    'One or more selected devices no longer exist.',
  REPORT_SCHEDULE_DEVICE_FORBIDDEN:
    'One or more selected devices are not available to this organization.',
};

function formatCronExpression(cron: string): string {
  const parts = cron.split(' ');
  if (parts.length !== 5) return cron;
  const [min, hour, , , dow] = parts;
  const dayNames = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  const dowNum = parseInt(dow, 10);
  if (!isNaN(dowNum) && dowNum >= 0 && dowNum <= 6) {
    return `${hour}:${min.padStart(2, '0')} every ${dayNames[dowNum]}`;
  }
  return cron;
}

function formatScheduleDate(
  value: string | null | undefined,
  fallback: string,
): { display: string; full: string | null } {
  if (!value) return { display: fallback, full: null };
  const trimmed = value.trim();
  if (trimmed === '') return { display: fallback, full: null };
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return { display: fallback, full: null };
  return {
    display: date.toLocaleDateString(),
    full: date.toISOString(),
  };
}

function getDeviceScopeLabel(deviceIds: string[]): string {
  if (deviceIds.length === 0) return 'All organization devices';
  if (deviceIds.length === 1) return '1 device';
  return `${deviceIds.length} devices`;
}

function safeErrorMessage(
  error: { message?: string; code?: string } | null,
): string | null {
  if (!error) return null;
  if (error.code && SAFE_ERROR_MESSAGES[error.code])
    return SAFE_ERROR_MESSAGES[error.code];
  return 'Unable to load scheduled reports.';
}

export function ScheduledReportsSection() {
  const {
    schedules,
    isLoading,
    error,
    refetch,
    createSchedule,
    isCreating,
    createError,
    updateSchedule,
    toggleSchedule,
    deleteSchedule,
    updatingScheduleIds,
    togglingScheduleIds,
    deletingScheduleIds,
    mutationError,
  } = useReportSchedules();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] =
    useState<ReportSchedule | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingSchedule, setDeletingSchedule] =
    useState<ReportSchedule | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [formData, setFormData] = useState<ScheduleFormData>(DEFAULT_FORM_DATA);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setFormData(DEFAULT_FORM_DATA);
    setFormError(null);
    setSuccessMessage(null);
  }, []);

  const openCreateDialog = useCallback(() => {
    resetForm();
    setEditingSchedule(null);
    setIsCreateDialogOpen(true);
  }, [resetForm]);

  const closeCreateDialog = useCallback(() => {
    setIsCreateDialogOpen(false);
    resetForm();
  }, [resetForm]);

  const openEditDialog = useCallback((schedule: ReportSchedule) => {
    setEditingSchedule(schedule);
    setFormData({
      type: schedule.type,
      formats: [...schedule.formats],
      cron: schedule.cron,
      deviceIds: [...schedule.deviceIds],
    });
    setFormError(null);
    setSuccessMessage(null);
    setIsEditDialogOpen(true);
  }, []);

  const closeEditDialog = useCallback(() => {
    setIsEditDialogOpen(false);
    setEditingSchedule(null);
    resetForm();
  }, [resetForm]);

  const openDeleteDialog = useCallback((schedule: ReportSchedule) => {
    setDeletingSchedule(schedule);
    setDeleteError(null);
    setIsDeleteDialogOpen(true);
  }, []);

  const closeDeleteDialog = useCallback(() => {
    setIsDeleteDialogOpen(false);
    setDeletingSchedule(null);
    setDeleteError(null);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deletingSchedule) return;
    setDeleteError(null);
    try {
      await deleteSchedule(deletingSchedule.id);
      setSuccessMessage('Schedule deleted.');
      closeDeleteDialog();
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code && SAFE_ERROR_MESSAGES[code]) {
        setDeleteError(SAFE_ERROR_MESSAGES[code]);
      } else {
        setDeleteError(
          (err as { message?: string }).message || 'Unable to delete schedule.',
        );
      }
    }
  }, [deletingSchedule, deleteSchedule, closeDeleteDialog]);

  const handleCreate = useCallback(async () => {
    setFormError(null);
    try {
      await createSchedule({
        type: formData.type,
        formats: formData.formats,
        cron: formData.cron,
        deviceIds: formData.deviceIds,
      });
      setSuccessMessage('Schedule created.');
      closeCreateDialog();
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code && SAFE_ERROR_MESSAGES[code]) {
        setFormError(SAFE_ERROR_MESSAGES[code]);
      } else {
        setFormError(
          (err as { message?: string }).message || 'Failed to create schedule.',
        );
      }
    }
  }, [createSchedule, formData, closeCreateDialog]);

  const handleUpdate = useCallback(async () => {
    if (!editingSchedule) return;
    setFormError(null);
    try {
      await updateSchedule(editingSchedule.id, {
        type: formData.type,
        formats: formData.formats,
        cron: formData.cron,
        deviceIds: formData.deviceIds,
      });
      setSuccessMessage('Schedule updated.');
      closeEditDialog();
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code && SAFE_ERROR_MESSAGES[code]) {
        setFormError(SAFE_ERROR_MESSAGES[code]);
      } else {
        setFormError(
          (err as { message?: string }).message || 'Failed to update schedule.',
        );
      }
    }
  }, [editingSchedule, updateSchedule, formData, closeEditDialog]);

  const handleToggle = useCallback(
    async (schedule: ReportSchedule) => {
      try {
        await toggleSchedule(schedule.id, !schedule.isEnabled);
      } catch {
        // Error handled by hook
      }
    },
    [toggleSchedule],
  );

  const toggleFormat = useCallback((format: ReportScheduleFormat) => {
    setFormData((prev) => ({
      ...prev,
      formats: prev.formats.includes(format)
        ? prev.formats.filter((f) => f !== format)
        : [...prev.formats, format],
    }));
  }, []);

  if (isLoading) {
    return (
      <GlassPanel className="p-4" aria-label="Loading scheduled reports">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="h-4 w-32 rounded bg-surface-muted" />
              <div className="h-5 w-16 rounded-full bg-surface-muted" />
              <div className="flex-1" />
              <div className="h-4 w-20 rounded bg-surface-muted" />
              <div className="h-4 w-20 rounded bg-surface-muted" />
            </div>
          ))}
        </div>
      </GlassPanel>
    );
  }

  const displayedError =
    safeErrorMessage(error) ||
    (mutationError?.code && SAFE_ERROR_MESSAGES[mutationError.code]) ||
    mutationError?.message ||
    null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">
            Scheduled Reports
          </h2>
          <p className="text-sm text-text-muted">
            Automated report generation on a schedule.
          </p>
        </div>
        <Button onClick={openCreateDialog} disabled={isCreating}>
          <Plus className="h-4 w-4 mr-2" />
          Create Schedule
        </Button>
      </div>

      {displayedError && (
        <GlassPanel className="p-4 border-red-500/20">
          <div className="flex items-center gap-2 text-sm text-danger">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{displayedError}</span>
            {error && (
              <Button variant="ghost" size="sm" onClick={refetch}>
                Retry
              </Button>
            )}
          </div>
        </GlassPanel>
      )}

      {successMessage && (
        <GlassPanel className="p-4 border-green-500/20">
          <div className="flex items-center gap-2 text-sm text-success">
            <span>{successMessage}</span>
          </div>
        </GlassPanel>
      )}

      {schedules.length === 0 ? (
        <GlassPanel className="p-8 text-center">
          <Calendar className="h-10 w-10 text-text-disabled mx-auto mb-3" />
          <p className="text-sm text-text-muted mb-1">
            No scheduled reports yet.
          </p>
          <p className="text-xs text-text-disabled mb-4">
            Create a schedule to automate report generation.
          </p>
          <Button onClick={openCreateDialog} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Create Schedule
          </Button>
        </GlassPanel>
      ) : (
        <div className="space-y-3">
          {schedules.map((schedule) => {
            const status = deriveReportScheduleStatus(schedule);
            const statusMeta = STATUS_METADATA[status];
            const badgeVariant = STATUS_TONE_VARIANT[statusMeta.tone];
            const isRowBusy =
              togglingScheduleIds.has(schedule.id) ||
              updatingScheduleIds.has(schedule.id) ||
              deletingScheduleIds.has(schedule.id);

            const lastRunInfo = formatScheduleDate(
              schedule.lastRunAt,
              'Never',
            );
            const nextRunInfo = formatScheduleDate(
              schedule.nextRunAt,
              'Not scheduled',
            );

            return (
              <GlassPanel key={schedule.id} className="p-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-text-primary capitalize">
                        {REPORT_TYPES.find((t) => t.value === schedule.type)
                          ?.label || schedule.type}
                      </span>
                      <Badge
                        variant={badgeVariant}
                        aria-label={statusMeta.description}
                      >
                        <span title={statusMeta.description}>
                          {statusMeta.label}
                        </span>
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-text-muted">
                      <span
                        className="inline-flex items-center gap-1"
                        title={schedule.cron}
                      >
                        <Clock className="h-3 w-3 shrink-0" />
                        <span className="font-mono truncate max-w-[140px]">
                          {formatCronExpression(schedule.cron)}
                        </span>
                      </span>

                      <span className="inline-flex items-center gap-1.5">
                        {schedule.formats.map((f) => (
                          <span
                            key={f}
                            className="px-1.5 py-0.5 rounded bg-surface-subtle text-text-secondary"
                          >
                            {f.toUpperCase()}
                          </span>
                        ))}
                      </span>

                      <span
                        title={lastRunInfo.full ?? undefined}
                      >
                        Last run: <span>{lastRunInfo.display}</span>
                      </span>

                      <span
                        title={nextRunInfo.full ?? undefined}
                      >
                        Next run: <span>{nextRunInfo.display}</span>
                      </span>

                      <span>{getDeviceScopeLabel(schedule.deviceIds)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggle(schedule)}
                      disabled={isRowBusy}
                      aria-label={
                        schedule.isEnabled ? 'Disable schedule' : 'Enable schedule'
                      }
                    >
                      {togglingScheduleIds.has(schedule.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Power
                          className={`h-4 w-4 ${schedule.isEnabled ? 'text-success' : 'text-text-muted'}`}
                        />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(schedule)}
                      disabled={isRowBusy}
                      aria-label="Edit schedule"
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDeleteDialog(schedule)}
                      disabled={isRowBusy}
                      aria-label="Delete schedule"
                    >
                      {deletingScheduleIds.has(schedule.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-danger" />
                      )}
                    </Button>
                  </div>
                </div>

                <p className="mt-2 text-[10px] text-text-disabled leading-tight">
                  Schedule times are calculated in UTC and displayed in your
                  local time.
                </p>
              </GlassPanel>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {(isCreateDialogOpen || isEditDialogOpen) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                isCreateDialogOpen ? closeCreateDialog() : closeEditDialog();
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md"
            >
              <GlassPanel className="p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-text-primary">
                    {isEditDialogOpen
                      ? 'Edit scheduled report'
                      : 'Create scheduled report'}
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={isEditDialogOpen ? closeEditDialog : closeCreateDialog}
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {formError && (
                  <div
                    role="alert"
                    className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-danger"
                  >
                    {formError}
                  </div>
                )}

                {createError && (
                  <div
                    role="alert"
                    className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-danger"
                  >
                    {createError.message}
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-text-secondary mb-2">
                      Report Type
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          type: e.target.value as ReportScheduleType,
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-surface-subtle border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                    >
                      {REPORT_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-text-secondary mb-2">
                      Formats
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {REPORT_FORMATS.map((format) => (
                        <button
                          key={format.value}
                          type="button"
                          onClick={() => toggleFormat(format.value)}
                          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                            formData.formats.includes(format.value)
                              ? 'bg-primary-500/20 text-primary border border-primary-500/30'
                              : 'bg-surface-subtle text-text-secondary border border-border hover:bg-surface-muted'
                          }`}
                        >
                          {format.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-text-secondary mb-2">
                      Cron Expression
                    </label>
                    <input
                      type="text"
                      value={formData.cron}
                      onChange={(e) =>
                        setFormData({ ...formData, cron: e.target.value })
                      }
                      placeholder="0 9 * * 1"
                      className="w-full px-3 py-2 rounded-lg bg-surface-subtle border border-border text-text-primary placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary-500/50 font-mono text-sm"
                    />
                    <p className="mt-1 text-xs text-text-muted">
                      Example: &quot;0 9 * * 1&quot; for every Monday at 9:00
                      AM
                    </p>
                  </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-6">
                  <Button
                    variant="ghost"
                    onClick={isEditDialogOpen ? closeEditDialog : closeCreateDialog}
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={isEditDialogOpen ? handleUpdate : handleCreate}
                    disabled={isCreating || updatingScheduleIds.size > 0}
                    className="w-full sm:w-auto"
                  >
                    {(isCreating || updatingScheduleIds.size > 0) && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    {isEditDialogOpen ? 'Save changes' : 'Create'}
                  </Button>
                </div>
              </GlassPanel>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDeleteDialogOpen && deletingSchedule && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            data-testid="delete-dialog"
            onClick={(e) => {
              if (
                e.target === e.currentTarget &&
                !deletingScheduleIds.has(deletingSchedule.id)
              ) {
                closeDeleteDialog();
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md"
            >
              <GlassPanel className="p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-text-primary">
                    Delete scheduled report?
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={closeDeleteDialog}
                    disabled={deletingScheduleIds.has(deletingSchedule.id)}
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <p className="text-sm text-text-secondary mb-6">
                  This action cannot be undone. Generated reports and downloaded
                  files will not be deleted.
                </p>

                {deleteError && (
                  <div
                    role="alert"
                    className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-danger"
                  >
                    {deleteError}
                  </div>
                )}

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                  <Button
                    variant="ghost"
                    onClick={closeDeleteDialog}
                    disabled={deletingScheduleIds.has(deletingSchedule.id)}
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={deletingScheduleIds.has(deletingSchedule.id)}
                    className="w-full sm:w-auto"
                  >
                    {deletingScheduleIds.has(deletingSchedule.id) && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    Delete
                  </Button>
                </div>
              </GlassPanel>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
