import { renderHook, act } from '@testing-library/react';
import { useCommandCenterData } from '@/hooks/useCommandCenterData';
import type { DashboardSummary } from '@/hooks/useDashboardSummary';
import type { Alert } from '@/hooks/useAlerts';

const mockUseDashboardSummary = jest.fn();
const mockSubscribe = jest.fn();

jest.mock('@/hooks/useDashboardSummary', () => ({
  useDashboardSummary: (...args: any[]) => mockUseDashboardSummary(...args),
}));

jest.mock('@/lib/socket-client', () => ({
  subscribe: (...args: any[]) => {
    mockSubscribe(...args);
    return () => {};
  },
}));

jest.mock('@/lib/auth-client', () => ({
  apiFetch: jest.fn(),
}));

import { apiFetch } from '@/lib/auth-client';

const mockApiFetch = apiFetch as jest.Mock;

function latestAlertCallback(): (alert: Alert) => void {
  return mockSubscribe.mock.calls[0][2] as (alert: Alert) => void;
}

function baseSummary(): DashboardSummary {
  return {
    generatedAt: new Date().toISOString(),
    fleet: {
      total: 3,
      online: 3,
      degraded: 0,
      offline: 0,
      unknown: 0,
      freshness: { live: 3, recent: 0, stale: 0, unavailable: 0 },
      deviceHealth: 90,
      recentDevices: [],
    },
    alerts: {
      unacknowledged: 0,
      bySeverity: { critical: 0, high: 0, medium: 0, low: 0, warning: 0, unknown: 0 },
    },
    security: {
      openFindings: { critical: 0, high: 0, medium: 0, low: 0, total: 0 },
      worstRiskLevel: null,
      scanCoverage: { scannedDevices: 3, onlineDevices: 3, coveragePercent: 100, lastScanAt: null },
      unscannedOnlineDevices: 0,
      latestScanAgesDays: null,
    },
    operations: {
      backups: {
        running: 0,
        pending: 0,
        failedLast24h: 0,
        completedLast24h: 0,
        lastCompletedAt: null,
        lastCompletedJobName: null,
        nextScheduledAt: null,
      },
      scans: { running: 0, pending: 0, failedLast24h: 0, completedLast24h: 0 },
      reports: { generating: 0, failed: 0, completed: 0, generatedLast30d: 0 },
    },
    team: { total: 5 },
  };
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: state,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('useCommandCenterData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDashboardSummary.mockReturnValue({
      summary: baseSummary(),
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
  });

  it('subscribes to /metrics alerts and keeps live alerts deduped and capped', async () => {
    const { result, unmount } = renderHook(() => useCommandCenterData());

    expect(mockSubscribe).toHaveBeenCalledWith('/metrics', 'alerts', expect.any(Function));

    const emit = latestAlertCallback();

    act(() => {
      emit({ id: 'a1', severity: 'warning' } as Alert);
      emit({ id: 'a2', severity: 'critical' } as Alert);
    });
    expect(result.current.liveAlerts.map((a) => a.id)).toEqual(['a2', 'a1']);

    act(() => {
      emit({ id: 'a1', severity: 'high' } as Alert);
    });
    expect(result.current.liveAlerts.map((a) => a.id)).toEqual(['a1', 'a2']);

    for (let i = 0; i < 60; i++) {
      act(() => {
        emit({ id: `bulk-${i}` } as Alert);
      });
    }
    expect(result.current.liveAlerts).toHaveLength(50);

    unmount();
  });

  it('derives OPERATIONAL and non-stale from a healthy summary', async () => {
    const { result, unmount } = renderHook(() => useCommandCenterData());
    await flush();

    expect(result.current.status).toBe('OPERATIONAL');
    expect(result.current.reasons).toEqual(['All monitored systems are operating normally.']);
    expect(result.current.stale).toBe(false);
    expect(result.current.summaryLoading).toBe(false);
    expect(result.current.summaryError).toBeNull();

    unmount();
  });

  it('maps UNKNOWN when there is no summary and an error occurred', async () => {
    mockUseDashboardSummary.mockReturnValue({
      summary: null,
      loading: false,
      error: new Error('unavailable'),
      refetch: jest.fn(),
    });
    const { result, unmount } = renderHook(() => useCommandCenterData());
    await flush();

    expect(result.current.status).toBe('UNKNOWN');
    expect(result.current.summary).toBeNull();
    expect(result.current.summaryError).toBeTruthy();

    unmount();
  });

  it('derives CRITICAL with reasons from a summary that has a critical alert', async () => {
    const summary = baseSummary();
    summary.alerts.bySeverity.critical = 1;
    mockUseDashboardSummary.mockReturnValue({
      summary,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    const { result, unmount } = renderHook(() => useCommandCenterData());
    await flush();

    expect(result.current.status).toBe('CRITICAL');
    expect(result.current.reasons).toContain('1 critical alert');

    unmount();
  });

  it('flags the summary as stale when it was generated long ago', async () => {
    const summary = baseSummary();
    summary.generatedAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    mockUseDashboardSummary.mockReturnValue({
      summary,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    const { result, unmount } = renderHook(() => useCommandCenterData());
    await flush();

    expect(result.current.stale).toBe(true);

    unmount();
  });

  describe('conditional backup run poller', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      setVisibility('visible');
      jest.useRealTimers();
    });

    it('does not poll backup runs when no run is active', async () => {
      const { result, unmount } = renderHook(() => useCommandCenterData());
      await flush();

      expect(mockApiFetch).not.toHaveBeenCalledWith('/backups/runs?limit=20');
      expect(result.current.activeBackupRuns).toEqual([]);

      await act(async () => {
        jest.advanceTimersByTime(30000);
        await Promise.resolve();
      });
      expect(mockApiFetch).not.toHaveBeenCalledWith('/backups/runs?limit=20');

      unmount();
    });

    it('polls every 5s only while a run is active, pauses when hidden, and resumes on return', async () => {
      const summary = baseSummary();
      summary.operations.backups.running = 1;
      mockUseDashboardSummary.mockReturnValue({
        summary,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });
      mockApiFetch.mockResolvedValue({
        ok: true,
        json: async () => [{ id: 'r1', status: 'running' }],
      });

      const { result, unmount } = renderHook(() => useCommandCenterData());
      await flush();

      expect(mockApiFetch).toHaveBeenCalledWith('/backups/runs?limit=20');
      expect(mockApiFetch).toHaveBeenCalledTimes(1);
      expect(result.current.activeBackupRuns).toEqual([{ id: 'r1', status: 'running' }]);

      setVisibility('hidden');
      await act(async () => {
        jest.advanceTimersByTime(20000);
        await Promise.resolve();
      });
      expect(mockApiFetch).toHaveBeenCalledTimes(1);

      setVisibility('visible');
      await flush();
      expect(mockApiFetch).toHaveBeenCalledTimes(2);

      await act(async () => {
        jest.advanceTimersByTime(5000);
        await Promise.resolve();
      });
      expect(mockApiFetch).toHaveBeenCalledTimes(3);

      unmount();
    });
  });
});
