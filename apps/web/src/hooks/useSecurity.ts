'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { apiFetch } from '@/lib/auth-client';

export type SecurityScanState =
  | 'idle'
  | 'triggering'
  | 'running'
  | 'completed'
  | 'failed'
  | 'timeout';

export const SECURITY_POLL_INTERVAL_MS = 3000;
export const SECURITY_SCAN_TIMEOUT_MS = 120000;

export interface SecurityFinding {
  id: string;
  scanId: string;
  category: string;
  finding: string;
  severity: string;
  status: string;
  remediation: string;
  details: any;
  createdAt: string;
  remediatedAt: string | null;
}

export interface SecurityScore {
  securityScore: number;
  riskLevel: string;
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

export interface SecurityScan {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  error?: string | null;
  findings: SecurityFinding[];
  score: SecurityScore | null;
}

export interface ExecutiveSummary {
  deviceName: string;
  deviceHostname: string | null;
  score: number;
  riskLevel: string;
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  scanDate: string;
  topFindings: { finding: string; severity: string; remediation: string }[];
  recommendations: string[];
  summaryText: string;
}

export function useSecurity(deviceId: string | undefined) {
  const [latestScan, setLatestScan] = useState<SecurityScan | null>(null);
  const [scans, setScans] = useState<any[]>([]);
  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [scansLoading, setScansLoading] = useState(false);
  const [scanState, setScanState] = useState<SecurityScanState>('idle');
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const baselineScanIdRef = useRef<string | null>(null);
  const pollDeadlineRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    pollDeadlineRef.current = 0;
  }, []);

  const fetchLatest = useCallback(async () => {
    if (!deviceId) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/security/latest/${deviceId}`);
      if (res.ok) {
        const data = await res.json();
        setLatestScan(data);
        return data;
      } else {
        setLatestScan(null);
        return null;
      }
    } catch {
      setLatestScan(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  const fetchScans = useCallback(async () => {
    if (!deviceId) return;
    setScansLoading(true);
    try {
      const res = await apiFetch(`/security/scans/${deviceId}?limit=20`);
      if (res.ok) {
        setScans(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setScansLoading(false);
    }
  }, [deviceId]);

  const fetchSummary = useCallback(async () => {
    if (!deviceId) return;
    try {
      const res = await apiFetch(`/security/executive-summary/${deviceId}`);
      if (res.ok) {
        setSummary(await res.json());
      }
    } catch {
      // ignore
    }
  }, [deviceId]);

  const pollOnce = useCallback(async () => {
    if (!deviceId) return;
    try {
      const res = await apiFetch(`/security/latest/${deviceId}`);
      if (res.status === 401 || res.status === 403) {
        stopPolling();
        setScanState('idle');
        setError(
          'Security data access was denied (401/403). Please refresh your session and try again.',
        );
        return;
      }
      if (!res.ok) {
        if (res.status === 404) {
          // No terminal scan yet — the triggered scan is still pending.
          return;
        }
        stopPolling();
        setScanState('idle');
        setError(`Could not verify the security scan status (HTTP ${res.status}). Please try again.`);
        return;
      }
      const scan = await res.json();
      if (scan?.status === 'completed' || scan?.status === 'failed') {
        const isNewTerminal = baselineScanIdRef.current === null || scan.id !== baselineScanIdRef.current;
        if (isNewTerminal) {
          stopPolling();
          setLatestScan(scan);
          setScanState(scan.status === 'failed' ? 'failed' : 'completed');
          fetchScans();
          fetchSummary();
        }
        return;
      }
      setScanState('running');
    } catch {
      stopPolling();
      setScanState('idle');
      setError('Could not reach the security service. Please try again.');
    }
  }, [deviceId, stopPolling, fetchScans, fetchSummary]);

  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    pollDeadlineRef.current = Date.now() + SECURITY_SCAN_TIMEOUT_MS;
    pollingRef.current = setInterval(() => {
      if (Date.now() >= pollDeadlineRef.current) {
        stopPolling();
        setScanState('timeout');
        return;
      }
      pollOnce();
    }, SECURITY_POLL_INTERVAL_MS);
  }, [pollOnce, stopPolling]);

  const triggerScan = useCallback(async () => {
    if (!deviceId) return;
    if (scanState === 'triggering' || scanState === 'running') return;
    setError(null);
    setScanState('triggering');
    try {
      const res = await apiFetch(`/security/scans/${deviceId}/trigger`, {
        method: 'POST',
      });
      if (res.ok) {
        baselineScanIdRef.current = latestScan?.id ?? null;
        setScanState('running');
        startPolling();
        setTimeout(() => {
          fetchScans();
        }, 2000);
      } else if (res.status === 401 || res.status === 403) {
        setScanState('idle');
        setError(
          'Access to security scanning was denied (401/403). Please refresh your session and try again.',
        );
      } else {
        setScanState('idle');
        setError(`Could not start the security scan (HTTP ${res.status}). Please try again.`);
      }
    } catch {
      setScanState('idle');
      setError('Network error starting the security scan. Please try again.');
    }
  }, [deviceId, scanState, latestScan?.id, startPolling, fetchScans]);

  const remediateFinding = useCallback(async (findingId: string) => {
    try {
      const res = await apiFetch(`/security/findings/${findingId}/remediate`, {
        method: 'POST',
      });
      if (res.ok) {
        await fetchLatest();
        await fetchSummary();
      }
    } catch {
      // ignore
    }
  }, [fetchLatest, fetchSummary]);

  useEffect(() => {
    stopPolling();
    baselineScanIdRef.current = null;
    setError(null);
    setScanState('idle');
    if (deviceId) {
      fetchLatest();
      fetchScans();
      fetchSummary();
    } else {
      setLatestScan(null);
      setScans([]);
      setSummary(null);
    }
    return () => stopPolling();
  }, [deviceId, fetchLatest, fetchScans, fetchSummary, stopPolling]);

  return {
    latestScan,
    scans,
    summary,
    loading,
    scansLoading,
    scanState,
    triggering: scanState === 'triggering' || scanState === 'running',
    error,
    triggerScan,
    remediateFinding,
    refetch: fetchLatest,
    refetchScans: fetchScans,
    refetchSummary: fetchSummary,
  };
}
