import { renderHook, waitFor, act } from '@testing-library/react';
import { useDashboardSummary } from '@/hooks/useDashboardSummary';

jest.mock('@/lib/auth-client', () => ({
  ...jest.requireActual('@/lib/auth-client'),
  apiFetch: jest.fn(),
  isLoggingOut: jest.fn().mockReturnValue(false),
}));

import { apiFetch } from '@/lib/auth-client';

const mockApiFetch = apiFetch as jest.Mock;

const summary = {
  generatedAt: '2026-01-01T00:00:00.000Z',
  fleet: {
    total: 3,
    online: 2,
    degraded: 0,
    offline: 1,
    unknown: 0,
    freshness: { live: 1, recent: 1, stale: 1, unavailable: 0 },
    deviceHealth: 85,
    recentDevices: [],
  },
  alerts: { unacknowledged: 14, bySeverity: { critical: 0, high: 0, medium: 0, low: 0, warning: 14, unknown: 0 } },
  security: {
    openFindings: { critical: 0, high: 2, medium: 0, low: 0, total: 2 },
    worstRiskLevel: 'high',
    scanCoverage: { scannedDevices: 1, onlineDevices: 2, coveragePercent: 50, lastScanAt: '2026-01-01T00:00:00.000Z' },
    unscannedOnlineDevices: 1,
    latestScanAgesDays: 1,
  },
  operations: {
    backups: { running: 1, pending: 0, failedLast24h: 0, completedLast24h: 0, lastCompletedAt: null, lastCompletedJobName: null, nextScheduledAt: null },
    scans: { running: 0, pending: 0, failedLast24h: 0, completedLast24h: 0 },
    reports: { generating: 0, failed: 0, completed: 0, generatedLast30d: 0 },
  },
  team: { total: 5 },
};

function okResponse(body: unknown) {
  return { ok: true, json: async () => body };
}

describe('useDashboardSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches /dashboard/summary and exposes the parsed summary', async () => {
    mockApiFetch.mockResolvedValue(okResponse(summary));
    const { result, unmount } = renderHook(() => useDashboardSummary());

    expect(mockApiFetch).toHaveBeenCalledWith('/dashboard/summary');

    await waitFor(() => expect(result.current.summary).toEqual(summary));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    unmount();
  });

  it('exposes null summary and an error when the request fails', async () => {
    mockApiFetch.mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' });
    const { result, unmount } = renderHook(() => useDashboardSummary());

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.summary).toBeNull();
    expect(result.current.loading).toBe(false);
    unmount();
  });

  it('exposes null summary on a network failure', async () => {
    mockApiFetch.mockRejectedValue(new Error('network'));
    const { result, unmount } = renderHook(() => useDashboardSummary());

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.summary).toBeNull();
    unmount();
  });
});

describe('useDashboardSummary polling hygiene', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    jest.useFakeTimers();
  });

  afterEach(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    jest.useRealTimers();
  });

  async function flush() {
    await act(async () => {
      await Promise.resolve();
    });
  }

  function setVisibility(state: DocumentVisibilityState) {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: state,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  }

  it('pauses polling while the document is hidden and refreshes immediately on return', async () => {
    mockApiFetch.mockResolvedValue(okResponse(summary));
    const { unmount } = renderHook(() => useDashboardSummary());

    await flush();
    expect(mockApiFetch).toHaveBeenCalledTimes(1);

    setVisibility('hidden');
    jest.advanceTimersByTime(120000);
    expect(mockApiFetch).toHaveBeenCalledTimes(1);

    setVisibility('visible');
    await flush();
    expect(mockApiFetch).toHaveBeenCalledTimes(2);

    unmount();
  });

  it('backs off exponentially on failure, caps the delay, and resets after success', async () => {
    mockApiFetch.mockRejectedValue(new Error('network'));
    const { unmount } = renderHook(() => useDashboardSummary());
    await flush();
    expect(mockApiFetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(30000);
      await Promise.resolve();
    });
    expect(mockApiFetch).toHaveBeenCalledTimes(2);

    await act(async () => {
      jest.advanceTimersByTime(60000);
      await Promise.resolve();
    });
    expect(mockApiFetch).toHaveBeenCalledTimes(3);

    await act(async () => {
      jest.advanceTimersByTime(120000);
      await Promise.resolve();
    });
    expect(mockApiFetch).toHaveBeenCalledTimes(4);

    await act(async () => {
      jest.advanceTimersByTime(120000);
      await Promise.resolve();
    });
    expect(mockApiFetch).toHaveBeenCalledTimes(5);

    mockApiFetch.mockResolvedValue(okResponse(summary));
    await act(async () => {
      jest.advanceTimersByTime(120000);
      await Promise.resolve();
    });
    expect(mockApiFetch).toHaveBeenCalledTimes(6);

    await act(async () => {
      jest.advanceTimersByTime(15000);
      await Promise.resolve();
    });
    expect(mockApiFetch).toHaveBeenCalledTimes(7);

    unmount();
  });

  it('never issues overlapping requests even when refetch is called mid-flight', async () => {
    let resolveRequest!: (value: unknown) => void;
    mockApiFetch.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );
    const { result, unmount } = renderHook(() => useDashboardSummary());
    await flush();
    expect(mockApiFetch).toHaveBeenCalledTimes(1);

    act(() => {
      void result.current.refetch();
    });
    await flush();
    expect(mockApiFetch).toHaveBeenCalledTimes(1);

    resolveRequest(okResponse(summary));
    await flush();
    expect(result.current.summary).toEqual(summary);
    expect(result.current.loading).toBe(false);

    unmount();
  });
});
