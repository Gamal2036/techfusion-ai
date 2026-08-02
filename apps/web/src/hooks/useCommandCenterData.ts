'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { apiFetch } from '@/lib/auth-client';
import { subscribe } from '@/lib/socket-client';
import {
  useDashboardSummary,
  type DashboardSummary,
} from '@/hooks/useDashboardSummary';
import type { Alert } from '@/hooks/useAlerts';
import type { BackupRun } from '@/hooks/useBackups';
import {
  deriveOperationalStateDetailedFromSummary,
  isSummaryStale,
  type OperationalStatus,
} from '@/lib/command-state';

const BACKUP_RUNS_POLL_INTERVAL = 5000;
const MAX_LIVE_ALERTS = 50;

/**
 * Composed Command Center data source (DASH-02 §22 orchestration contract):
 * - exactly one surface poller: /dashboard/summary (visible-only, backoff)
 * - one WebSocket subscription: /metrics "alerts" for live alert events
 * - one conditional poller: /backups/runs?limit=20 only while a backup run is
 *   active (running/pending); dormant otherwise, paused when hidden
 * Device polling (useDeviceList) is intentionally NOT mounted here; the
 * summary carries fleet counts + recentDevices.
 */
export function useCommandCenterData() {
  const { summary, loading, error, refetch } = useDashboardSummary();

  const { state, reasons } = useMemo(
    () => deriveOperationalStateDetailedFromSummary(summary),
    [summary],
  );

  const status: OperationalStatus = summary ? state : 'UNKNOWN';
  const stale = summary ? isSummaryStale(summary.generatedAt) : false;

  const [liveAlerts, setLiveAlerts] = useState<Alert[]>([]);
  useEffect(() => {
    return subscribe('/metrics', 'alerts', (alert: Alert) => {
      setLiveAlerts((prev) => {
        const next = [alert, ...prev.filter((a) => a.id !== alert.id)];
        return next.length > MAX_LIVE_ALERTS ? next.slice(0, MAX_LIVE_ALERTS) : next;
      });
    });
  }, []);

  const backupsActive =
    (summary?.operations.backups.running ?? 0) > 0 ||
    (summary?.operations.backups.pending ?? 0) > 0;

  const [activeBackupRuns, setActiveBackupRuns] = useState<BackupRun[]>([]);
  const backupTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const backupInFlightRef = useRef(false);

  const fetchActiveBackupRuns = useCallback(async () => {
    if (backupInFlightRef.current) return;
    backupInFlightRef.current = true;
    try {
      const res = await apiFetch('/backups/runs?limit=20');
      if (res.ok) {
        const data = await res.json();
        setActiveBackupRuns(
          Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [],
        );
      }
    } catch (e) {
      console.error('Failed to fetch active backup runs:', e);
    } finally {
      backupInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    const clearBackupTimer = () => {
      if (backupTimerRef.current) {
        clearInterval(backupTimerRef.current);
        backupTimerRef.current = null;
      }
    };

    if (!backupsActive) {
      setActiveBackupRuns([]);
      clearBackupTimer();
      return;
    }

    const start = () => {
      clearBackupTimer();
      backupTimerRef.current = setInterval(
        fetchActiveBackupRuns,
        BACKUP_RUNS_POLL_INTERVAL,
      );
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearBackupTimer();
      } else {
        fetchActiveBackupRuns();
        start();
      }
    };

    fetchActiveBackupRuns();
    start();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearBackupTimer();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [backupsActive, fetchActiveBackupRuns]);

  return {
    summary,
    summaryLoading: loading,
    summaryError: error,
    refetchSummary: refetch,
    status,
    reasons,
    stale,
    liveAlerts,
    activeBackupRuns,
  };
}

export type CommandCenterData = ReturnType<typeof useCommandCenterData>;
export type { DashboardSummary };
