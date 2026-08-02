'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { apiFetch } from '@/lib/auth-client';

export interface BackupJob {
  id: string;
  orgId: string;
  deviceId: string;
  name: string;
  type: string;
  schedule: string | null;
  sourcePaths: string | null;
  destination: string | null;
  retention: number;
  compression: boolean;
  isEnabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  _count?: { runs: number };
}

export interface BackupRun {
  id: string;
  jobId: string;
  orgId: string;
  deviceId: string | null;
  status: string;
  type: string;
  startedAt: string;
  completedAt: string | null;
  sizeBytes: number | null;
  fileCount: number | null;
  sourcePaths: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
  job?: { name: string; type: string };
}

const POLL_INTERVAL = 5000;

export function useBackupJobs(deviceId?: string) {
  const [jobs, setJobs] = useState<BackupJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const params = deviceId ? `?deviceId=${deviceId}` : '';
      const res = await apiFetch(`/backups/jobs${params}`);
      if (res.ok) {
        setJobs(await res.json());
        setError(null);
      } else {
        setError(`Failed to fetch jobs: ${res.status}`);
      }
    } catch (e) {
      setError('Network error while fetching backup jobs');
      console.error('Failed to fetch backup jobs:', e);
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  return { jobs, loading, error, refetch: fetchJobs };
}

export function useBackupRuns(jobId?: string) {
  const [runs, setRuns] = useState<BackupRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasActiveRun, setHasActiveRun] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRuns = useCallback(async () => {
    try {
      const params = jobId ? `?jobId=${jobId}` : '';
      const res = await apiFetch(`/backups/runs${params}`);
      if (res.ok) {
        const data = await res.json();
        setRuns(data);
        setError(null);
        const active = data.some((r: BackupRun) => r.status === 'running' || r.status === 'pending');
        setHasActiveRun(active);
      } else {
        setError(`Failed to fetch runs: ${res.status}`);
      }
    } catch (e) {
      setError('Network error while fetching backup runs');
      console.error('Failed to fetch backup runs:', e);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => { fetchRuns(); }, [fetchRuns]);

  useEffect(() => {
    if (hasActiveRun) {
      intervalRef.current = setInterval(fetchRuns, POLL_INTERVAL);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [hasActiveRun, fetchRuns]);

  return { runs, loading, error, hasActiveRun, refetch: fetchRuns };
}

export function useRestorePoints(deviceId: string | undefined) {
  const [points, setPoints] = useState<BackupRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPoints = useCallback(async () => {
    if (!deviceId) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/backups/restore-points/${deviceId}`);
      if (res.ok) {
        setPoints(await res.json());
        setError(null);
      } else {
        setError(`Failed to fetch restore points: ${res.status}`);
      }
    } catch (e) {
      setError('Network error while fetching restore points');
      console.error('Failed to fetch restore points:', e);
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  return { points, loading, error, refetch: fetchPoints };
}
