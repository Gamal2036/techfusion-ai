'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '@/lib/auth-client';

export interface DashboardSummary {
  generatedAt: string;
  fleet: {
    total: number;
    online: number;
    degraded: number;
    offline: number;
    unknown: number;
    freshness: { live: number; recent: number; stale: number; unavailable: number };
    deviceHealth: number | null;
    recentDevices: Array<{
      id: string;
      name: string;
      hostname: string | null;
      os: string | null;
      lastSeenAt: string | null;
    }>;
  };
  alerts: {
    unacknowledged: number;
    bySeverity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
      warning: number;
      unknown: number;
    };
  };
  security: {
    openFindings: { critical: number; high: number; medium: number; low: number; total: number };
    worstRiskLevel: 'critical' | 'high' | 'medium' | 'low' | null;
    scanCoverage: {
      scannedDevices: number;
      onlineDevices: number;
      coveragePercent: number | null;
      lastScanAt: string | null;
    };
    unscannedOnlineDevices: number;
    latestScanAgesDays: number | null;
  };
  operations: {
    backups: {
      running: number;
      pending: number;
      failedLast24h: number;
      completedLast24h: number;
      lastCompletedAt: string | null;
      lastCompletedJobName: string | null;
      nextScheduledAt: string | null;
    };
    scans: { running: number; pending: number; failedLast24h: number; completedLast24h: number };
    reports: { generating: number; failed: number; completed: number; generatedLast30d: number };
  };
  team: { total: number };
}

export const SUMMARY_POLL_INTERVAL = 15000;
export const SUMMARY_BACKOFF_BASE_MS = 15000;
export const SUMMARY_BACKOFF_MAX_MS = 120000;

/**
 * Poll /dashboard/summary with polling hygiene:
 * - pauses while the document is hidden and refreshes immediately on return
 * - backs off exponentially on failure and resets on success
 * - never issues overlapping requests and keeps at most one timer alive
 */
export function useDashboardSummary() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);
  const failureCountRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const delayFor = useCallback(() => {
    const backoff = SUMMARY_BACKOFF_BASE_MS * 2 ** Math.min(failureCountRef.current, 3);
    return Math.min(backoff, SUMMARY_BACKOFF_MAX_MS);
  }, []);

  const fetchLatest = useRef<() => void>(() => {});
  const scheduleNext = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      fetchLatest.current();
    }, delayFor());
  }, [clearTimer, delayFor]);

  const fetchSummary = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const res = await apiFetch('/dashboard/summary');
      if (res.ok) {
        const data = await res.json();
        setSummary(data as DashboardSummary);
        setError(null);
        failureCountRef.current = 0;
      } else {
        const errorBody = await res.text().catch(() => '');
        setError(`Failed to fetch dashboard summary: ${res.status} ${errorBody}`.trim());
        failureCountRef.current += 1;
      }
    } catch (e) {
      setError('Network error while fetching dashboard summary');
      console.error('Failed to fetch dashboard summary:', e);
      failureCountRef.current += 1;
    } finally {
      inFlightRef.current = false;
      setLoading(false);
      if (document.visibilityState !== 'hidden') {
        scheduleNext();
      }
    }
  }, [scheduleNext]);

  useEffect(() => {
    fetchLatest.current = fetchSummary;
  });

  useEffect(() => {
    fetchLatest.current();
    return () => clearTimer();
  }, [clearTimer]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearTimer();
      } else {
        fetchLatest.current();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [clearTimer]);

  return { summary, loading, error, refetch: fetchSummary };
}
