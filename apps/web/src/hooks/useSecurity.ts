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

  const fetchLatest = useCallback(async () => {
    if (!deviceId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/security/latest/${deviceId}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setLatestScan(data);
      } else {
        setLatestScan(null);
      }
    } catch {
      setLatestScan(null);
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  const fetchScans = useCallback(async () => {
    if (!deviceId) return;
    setScansLoading(true);
    try {
      const res = await fetch(`${API_URL}/security/scans/${deviceId}?limit=20`, {
        headers: getAuthHeaders(),
      });
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
      const res = await fetch(`${API_URL}/security/executive-summary/${deviceId}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setSummary(await res.json());
      }
    } catch {
      // ignore
    }
  }, [deviceId]);

  const triggerScan = useCallback(async () => {
    if (!deviceId || triggering) return;
    setTriggering(true);
    try {
      const res = await fetch(`${API_URL}/security/scans/${deviceId}/trigger`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        // Refresh after triggering
        setTimeout(() => {
          fetchLatest();
          fetchScans();
        }, 2000);
      }
    } catch {
      // ignore
    } finally {
      setTriggering(false);
    }
  }, [deviceId, triggering, fetchLatest, fetchScans]);

  const remediateFinding = useCallback(async (findingId: string) => {
    try {
      const res = await fetch(`${API_URL}/security/findings/${findingId}/remediate`, {
        method: 'POST',
        headers: getAuthHeaders(),
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
  }, [deviceId, fetchLatest, fetchScans, fetchSummary]);

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
