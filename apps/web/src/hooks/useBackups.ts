'use client';

import { useState, useCallback, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getAuthHeaders() {
  const token = localStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

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
  errorMessage: string | null;
  job?: { name: string; type: string };
}

export function useBackupJobs(deviceId?: string) {
  const [jobs, setJobs] = useState<BackupJob[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    try {
      const params = deviceId ? `?deviceId=${deviceId}` : '';
      const res = await fetch(`${API_URL}/backups/jobs${params}`, { headers: getAuthHeaders() });
      if (res.ok) setJobs(await res.json());
    } catch (e) {
      console.error('Failed to fetch backup jobs:', e);
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  return { jobs, loading, refetch: fetchJobs };
}

export function useBackupRuns(jobId?: string) {
  const [runs, setRuns] = useState<BackupRun[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRuns = useCallback(async () => {
    try {
      const params = jobId ? `?jobId=${jobId}` : '';
      const res = await fetch(`${API_URL}/backups/runs${params}`, { headers: getAuthHeaders() });
      if (res.ok) setRuns(await res.json());
    } catch (e) {
      console.error('Failed to fetch backup runs:', e);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => { fetchRuns(); }, [fetchRuns]);

  return { runs, loading, refetch: fetchRuns };
}

export function useRestorePoints(deviceId: string | undefined) {
  const [points, setPoints] = useState<BackupRun[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPoints = useCallback(async () => {
    if (!deviceId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/backups/restore-points/${deviceId}`, { headers: getAuthHeaders() });
      if (res.ok) setPoints(await res.json());
    } catch (e) {
      console.error('Failed to fetch restore points:', e);
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  return { points, loading, refetch: fetchPoints };
}
