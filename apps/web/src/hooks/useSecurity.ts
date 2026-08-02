'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { apiFetch } from '@/lib/auth-client';

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
  const [triggering, setTriggering] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

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

  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(async () => {
      const scan = await fetchLatest();
      if (scan && (scan.status === 'completed' || scan.status === 'failed')) {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        setTriggering(false);
        fetchScans();
        fetchSummary();
      }
    }, 3000);
  }, [fetchLatest, fetchScans, fetchSummary]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const triggerScan = useCallback(async () => {
    if (!deviceId || triggering) return;
    setTriggering(true);
    try {
      const res = await apiFetch(`/security/scans/${deviceId}/trigger`, {
        method: 'POST',
      });
      if (res.ok) {
        startPolling();
        setTimeout(() => {
          fetchScans();
        }, 2000);
      } else {
        setTriggering(false);
      }
    } catch {
      setTriggering(false);
    }
  }, [deviceId, triggering, fetchLatest, fetchScans, startPolling]);

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
    if (deviceId) {
      fetchLatest();
      fetchScans();
      fetchSummary();
    }
    return () => stopPolling();
  }, [deviceId, fetchLatest, fetchScans, fetchSummary, stopPolling]);

  return {
    latestScan,
    scans,
    summary,
    loading,
    scansLoading,
    triggering,
    triggerScan,
    remediateFinding,
    refetch: fetchLatest,
    refetchScans: fetchScans,
    refetchSummary: fetchSummary,
  };
}
