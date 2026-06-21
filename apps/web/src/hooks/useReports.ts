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

export interface Report {
  id: string;
  orgId: string;
  title: string;
  type: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  fileUrl: string | null;
  metadata: any;
}

export function useReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/reports`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setReports(Array.isArray(data) ? data : data.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch reports:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const generateReport = useCallback(async (title: string, type: string) => {
    setGenerating(true);
    try {
      const res = await fetch(`${API_URL}/reports`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ title, type }),
      });
      if (res.ok) {
        const data = await res.json();
        await fetchReports();
        return data;
      }
      throw new Error('Failed to generate report');
    } catch (e) {
      console.error('Failed to generate report:', e);
      throw e;
    } finally {
      setGenerating(false);
    }
  }, [fetchReports]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  return { reports, loading, generating, refetch: fetchReports, generateReport };
}
