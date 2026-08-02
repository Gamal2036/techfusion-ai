'use client';

import { useState, useCallback, useEffect } from 'react';
import { apiFetch } from '@/lib/auth-client';
import type { ReportRecord, GenerateReportRequest, ReportType, ReportFormat } from '@techfusion/types';

export type { ReportRecord };

export interface ReportError {
  message: string;
  status: number;
  code?: string;
}

export function useReports() {
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<ReportError | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/reports');
      if (res.ok) {
        const data = await res.json();
        setReports(Array.isArray(data) ? data : data.data || []);
      } else if (res.status === 401) {
        setError({ message: 'Authentication required.', status: 401 });
      } else if (res.status === 403) {
        setError({ message: 'You do not have permission to view reports.', status: 403 });
      } else {
        const body = await res.json().catch(() => null);
        setError({ message: body?.message || `Failed to load reports (${res.status}).`, status: res.status });
      }
    } catch {
      setError({ message: 'Network error. Could not load reports.', status: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  const generateReport = useCallback(async (
    type: ReportType,
    format: ReportFormat,
    options: { title?: string; description?: string; deviceIds?: string[]; scanId?: string; generateAiSummary?: boolean } = {},
  ) => {
    setGenerating(true);
    setError(null);
    try {
      const body: GenerateReportRequest = {
        type,
        format,
        ...options,
      };
      const res = await apiFetch('/reports/generate', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        await fetchReports();
        return data as ReportRecord;
      }
      let errorMessage = 'Failed to generate report.';
      let errorCode: string | undefined;
      if (res.status === 400) {
        const bodyData = await res.json().catch(() => null);
        errorMessage = bodyData?.message || 'Invalid report parameters.';
      } else if (res.status === 403) {
        const bodyData = await res.json().catch(() => null);
        errorMessage = bodyData?.message || 'Report generation not available on your current plan.';
      } else if (res.status === 422) {
        const bodyData = await res.json().catch(() => null);
        errorMessage = bodyData?.message || 'Request cannot be processed.';
        errorCode = bodyData?.code;
      } else if (res.status === 500) {
        errorMessage = 'Server error during report generation. Please try again.';
      }
      const err: ReportError = { message: errorMessage, status: res.status, code: errorCode };
      setError(err);
      throw err;
    } catch (e) {
      if (e && typeof e === 'object' && 'status' in e) throw e;
      const err: ReportError = { message: 'Network error. Could not generate report.', status: 0 };
      setError(err);
      throw err;
    } finally {
      setGenerating(false);
    }
  }, [fetchReports]);

  const deleteReport = useCallback(async (id: string) => {
    setError(null);
    try {
      const res = await apiFetch(`/reports/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setReports((prev) => prev.filter((r) => r.id !== id));
        return true;
      }
      const body = await res.json().catch(() => null);
      setError({ message: body?.message || 'Failed to delete report.', status: res.status });
      return false;
    } catch {
      setError({ message: 'Network error. Could not delete report.', status: 0 });
      return false;
    }
  }, []);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  return { reports, loading, generating, error, refetch: fetchReports, generateReport, deleteReport };
}
