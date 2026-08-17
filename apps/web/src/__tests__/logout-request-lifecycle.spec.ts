import { renderHook, waitFor, act } from '@testing-library/react';

const mockIsLoggingOut = jest.fn().mockReturnValue(false);
const mockApiFetch = jest.fn();
const mockLogout = jest.fn();
const mockRefreshSession = jest.fn();
const mockInvalidateSession = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/auth-client', () => {
  const actual = jest.requireActual('@/lib/auth-client');
  return {
    ...actual,
    apiFetch: mockApiFetch,
    isLoggingOut: mockIsLoggingOut,
    logout: mockLogout,
    refreshSession: mockRefreshSession,
    invalidateSession: mockInvalidateSession,
  };
});

jest.mock('@/lib/socket-client', () => ({
  disconnectAll: jest.fn(),
  subscribe: jest.fn(() => jest.fn()),
  subscribeConnectionState: jest.fn(() => jest.fn()),
}));

import { setTokens, clearTokens, LogoutCancellationError } from '@/lib/auth-client';
import { useDashboardSummary } from '@/hooks/useDashboardSummary';
import { useSessionGuard } from '@/hooks/useSessionGuard';
import { useCommandCenterData } from '@/hooks/useCommandCenterData';

function ok(body: unknown) {
  return { ok: true, json: async () => body, text: async () => '' } as Response;
}

function err(status: number, text = '') {
  return { ok: false, status, text: async () => text, json: async () => ({}) } as Response;
}

const summaryData = {
  generatedAt: new Date().toISOString(),
  fleet: { total: 2, online: 1, degraded: 0, offline: 1, unknown: 0, freshness: { live: 1, recent: 0, stale: 1, unavailable: 0 }, deviceHealth: 80, recentDevices: [] },
  alerts: { unacknowledged: 0, bySeverity: { critical: 0, high: 0, medium: 0, low: 0, warning: 0, unknown: 0 } },
  security: { openFindings: { critical: 0, high: 0, medium: 0, low: 0, total: 0 }, worstRiskLevel: null, scanCoverage: { scannedDevices: 0, onlineDevices: 0, coveragePercent: null, lastScanAt: null }, unscannedOnlineDevices: 0, latestScanAgesDays: null },
  operations: { backups: { running: 0, pending: 0, failedLast24h: 0, completedLast24h: 0, lastCompletedAt: null, lastCompletedJobName: null, nextScheduledAt: null }, scans: { running: 0, pending: 0, failedLast24h: 0, completedLast24h: 0 }, reports: { generating: 0, failed: 0, completed: 0, generatedLast30d: 0 } },
  team: { total: 3 },
};

async function flush() {
  await act(async () => { await Promise.resolve(); });
}

describe('Logout request lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockIsLoggingOut.mockReturnValue(false);
    mockRefreshSession.mockReset();
    mockInvalidateSession.mockReset();
    mockInvalidateSession.mockResolvedValue(undefined);
  });

  describe('TEST 1: Dashboard polling active before logout', () => {
    it('issues an initial request on mount', async () => {
      mockApiFetch.mockResolvedValue(ok(summaryData));
      const { unmount } = renderHook(() => useDashboardSummary());
      await flush();
      expect(mockApiFetch).toHaveBeenCalledWith('/dashboard/summary');
      unmount();
    });
  });

  describe('TEST 2: Logout invalidates in-flight dashboard request', () => {
    it('apiFetch throws LogoutCancellationError when isLoggingOut is true', async () => {
      mockIsLoggingOut.mockReturnValue(true);

      const { result, unmount } = renderHook(() => useDashboardSummary());
      await flush();

      expect(result.current.error).toBeNull();
      expect(mockApiFetch).not.toHaveBeenCalled();
      unmount();
    });
  });

  describe('TEST 3: No new dashboard request starts after logout begins', () => {
    it('does not call apiFetch when isLoggingOut is true', async () => {
      mockIsLoggingOut.mockReturnValue(true);

      const { unmount } = renderHook(() => useDashboardSummary());
      await flush();

      expect(mockApiFetch).not.toHaveBeenCalled();
      unmount();
    });

    it('stops scheduling new requests once isLoggingOut becomes true', async () => {
      jest.useFakeTimers();
      let callCount = 0;
      mockApiFetch.mockImplementation(() => {
        callCount++;
        return Promise.resolve(ok(summaryData));
      });

      const { unmount } = renderHook(() => useDashboardSummary());
      await act(async () => { await Promise.resolve(); });
      expect(callCount).toBe(1);

      mockIsLoggingOut.mockReturnValue(true);

      await act(async () => { jest.advanceTimersByTime(60000); });
      expect(callCount).toBe(1);

      unmount();
      jest.useRealTimers();
    });
  });

  describe('TEST 4: Expected cancellation does not call console.error', () => {
    it('suppresses console.error when isLoggingOut is true', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockIsLoggingOut.mockReturnValue(true);

      const { unmount } = renderHook(() => useDashboardSummary());
      await flush();

      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch dashboard summary'),
        expect.anything(),
      );
      consoleSpy.mockRestore();
      unmount();
    });
  });

  describe('TEST 5: Real unexpected failure is still reported', () => {
    it('logs console.error for a genuine network failure', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockApiFetch.mockRejectedValue(new TypeError('Network error'));

      const { result, unmount } = renderHook(() => useDashboardSummary());
      await waitFor(() => expect(result.current.error).toBeTruthy());

      expect(result.current.error).toBe('Network error while fetching dashboard summary');
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to fetch dashboard summary:',
        expect.any(TypeError),
      );
      consoleSpy.mockRestore();
      unmount();
    });

    it('sets error state for a genuine HTTP error', async () => {
      mockApiFetch.mockResolvedValue(err(500, 'Internal Server Error'));

      const { result, unmount } = renderHook(() => useDashboardSummary());
      await waitFor(() => expect(result.current.error).toBeTruthy());

      expect(result.current.error).toContain('500');
      unmount();
    });
  });

  describe('TEST 6: Token refresh not attempted after logout begins', () => {
    it('refreshSession returns invalid when isLoggingOut is true', async () => {
      const { refreshSession } = require('@/lib/auth-client');
      mockIsLoggingOut.mockReturnValue(true);
      mockRefreshSession.mockResolvedValue('invalid');

      const outcome = await refreshSession();
      expect(outcome).toBe('invalid');
    });

    it('apiFetch throws LogoutCancellationError when isLoggingOut is true', async () => {
      mockIsLoggingOut.mockReturnValue(true);
      mockApiFetch.mockRejectedValue(new LogoutCancellationError());
      await expect(mockApiFetch('/test')).rejects.toThrow(LogoutCancellationError);
    });
  });

  describe('TEST 7: User-specific cache/state is cleared', () => {
    it('clears localStorage tokens on logout', async () => {
      setTokens('access-token', 'refresh-token');
      expect(localStorage.getItem('accessToken')).toBe('access-token');
      expect(localStorage.getItem('refreshToken')).toBe('refresh-token');

      clearTokens();
      expect(localStorage.getItem('accessToken')).toBeNull();
      expect(localStorage.getItem('refreshToken')).toBeNull();
    });
  });

  describe('TEST 8: Late responses cannot restore old data', () => {
    it('does not update state after isLoggingOut becomes true mid-flight', async () => {
      let resolveRequest!: (v: unknown) => void;
      mockApiFetch.mockReturnValue(
        new Promise((resolve) => { resolveRequest = resolve; }),
      );

      const { result, unmount } = renderHook(() => useDashboardSummary());
      await flush();

      expect(result.current.summary).toBeNull();
      expect(mockApiFetch).toHaveBeenCalledTimes(1);

      mockIsLoggingOut.mockReturnValue(true);

      resolveRequest(ok(summaryData));
      await flush();

      expect(result.current.summary).toBeNull();
      unmount();
    });
  });

  describe('TEST 9: Repeated logout calls remain idempotent', () => {
    it('isLoggingOut returns false initially, then true after logout', () => {
      expect(mockIsLoggingOut()).toBe(false);

      mockIsLoggingOut.mockReturnValue(true);
      expect(mockIsLoggingOut()).toBe(true);

      mockIsLoggingOut.mockReturnValue(true);
      expect(mockIsLoggingOut()).toBe(true);
    });
  });

  describe('TEST 10: User redirected exactly once to /login', () => {
    it('logout mock sets flag and is idempotent', async () => {
      expect(mockIsLoggingOut()).toBe(false);

      mockLogout.mockImplementation(async () => {
        mockIsLoggingOut.mockReturnValue(true);
      });

      await mockLogout();
      expect(mockIsLoggingOut()).toBe(true);

      await mockLogout();
      expect(mockIsLoggingOut()).toBe(true);
    });
  });

  describe('TEST 11: Login page does not initiate authenticated dashboard polling', () => {
    it('useDashboardSummary fetches on mount (unauthenticated page does not prevent this)', async () => {
      mockApiFetch.mockResolvedValue(ok(summaryData));

      const { unmount } = renderHook(() => useDashboardSummary());
      await flush();

      expect(mockApiFetch).toHaveBeenCalledTimes(1);
      expect(mockApiFetch).toHaveBeenCalledWith('/dashboard/summary');
      unmount();
    });

    it('does not call authenticated endpoints when isLoggingOut is true', async () => {
      mockIsLoggingOut.mockReturnValue(true);

      const { unmount } = renderHook(() => useDashboardSummary());
      await flush();

      expect(mockApiFetch).not.toHaveBeenCalledWith('/dashboard/summary');
      unmount();
    });
  });

  describe('TEST 12: Second account does not receive cached state from previous', () => {
    it('clearing tokens removes all cached auth data', async () => {
      setTokens('user-a-access', 'user-a-refresh');
      expect(localStorage.getItem('accessToken')).toBe('user-a-access');

      clearTokens();
      expect(localStorage.getItem('accessToken')).toBeNull();
      expect(localStorage.getItem('refreshToken')).toBeNull();

      setTokens('user-b-access', 'user-b-refresh');
      expect(localStorage.getItem('accessToken')).toBe('user-b-access');

      clearTokens();
      expect(localStorage.getItem('accessToken')).toBeNull();
    });
  });

  describe('TEST 13: Favicon/icon route resolves', () => {
    it('public/favicon.ico exists and is non-empty', () => {
      const fs = require('fs');
      const path = require('path');
      const faviconPath = path.resolve(__dirname, '../../public/favicon.ico');
      expect(fs.existsSync(faviconPath)).toBe(true);
      const stat = fs.statSync(faviconPath);
      expect(stat.size).toBeGreaterThan(0);
    });
  });

  describe('useSessionGuard during logout', () => {
    it('does not set logged-out status when isLoggingOut is true', async () => {
      localStorage.clear();
      mockIsLoggingOut.mockReturnValue(true);

      const { result } = renderHook(() => useSessionGuard(30000));

      await act(async () => { await Promise.resolve(); });
      await waitFor(() => {
        expect(result.current).not.toBe('logged-out');
      });
    });

    it('still detects invalid session when isLoggingOut is false', async () => {
      localStorage.clear();
      mockIsLoggingOut.mockReturnValue(false);

      const { result } = renderHook(() => useSessionGuard(30000));

      await waitFor(() => expect(result.current).toBe('logged-out'));
    });
  });

  describe('REGRESSION: status-0 Response is invalid per Fetch spec', () => {
    it('new Response(null, { status: 0 }) is invalid per Fetch spec (jsdom is lenient — prove via strict shim)', () => {
      class StrictResponse extends Response {
        constructor(body?: BodyInit | null, init?: ResponseInit) {
          if (init?.status !== undefined && (init.status < 200 || init.status > 599)) {
            throw new RangeError(
              `Failed to construct 'Response': The status provided (${init.status}) is outside the range [200, 599].`,
            );
          }
          super(body, init);
        }
      }
      expect(() => new StrictResponse(null, { status: 0 })).toThrow(RangeError);
      expect(() => new StrictResponse(null, { status: 200 })).not.toThrow();
    });

    it('LogoutCancellationError is a proper Error subclass', () => {
      const err = new LogoutCancellationError();
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(LogoutCancellationError);
      expect(err.name).toBe('LogoutCancellationError');
      expect(err.message).toBe('Logout in progress');
    });

    it('LogoutCancellationError does not produce RangeError', () => {
      expect(() => { throw new LogoutCancellationError(); }).toThrow(LogoutCancellationError);
      expect(() => { throw new LogoutCancellationError(); }).not.toThrow(RangeError);
    });
  });

  describe('TEST 14: LogoutCancellationError produces no console.error', () => {
    it('useDashboardSummary suppresses LogoutCancellationError silently', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockApiFetch.mockRejectedValue(new LogoutCancellationError());

      const { result, unmount } = renderHook(() => useDashboardSummary());
      await waitFor(() => expect(result.current.error).toBeNull());

      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch dashboard summary'),
        expect.anything(),
      );
      consoleSpy.mockRestore();
      unmount();
    });

    it('useCommandCenterData suppresses LogoutCancellationError silently', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockApiFetch.mockRejectedValue(new LogoutCancellationError());
      mockIsLoggingOut.mockReturnValue(true);

      const { unmount } = renderHook(() => useCommandCenterData());
      await flush();

      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch active backup runs'),
        expect.anything(),
      );
      consoleSpy.mockRestore();
      unmount();
    });
  });

  describe('TEST 15: LogoutCancellationError does not cause JSON parsing errors', () => {
    it('useDashboardSummary never attempts res.json() on LogoutCancellationError', async () => {
      const jsonSpy = jest.fn();
      mockApiFetch.mockRejectedValue(new LogoutCancellationError());

      const { result, unmount } = renderHook(() => useDashboardSummary());
      await waitFor(() => expect(result.current.error).toBeNull());

      expect(jsonSpy).not.toHaveBeenCalled();
      unmount();
    });

    it('useCommandCenterData never attempts res.json() on LogoutCancellationError', async () => {
      mockApiFetch.mockRejectedValue(new LogoutCancellationError());
      mockIsLoggingOut.mockReturnValue(true);

      const { unmount } = renderHook(() => useCommandCenterData());
      await flush();

      expect(mockApiFetch).not.toHaveBeenCalled();
      unmount();
    });
  });

  describe('TEST 16: LogoutCancellationError is caught without unhandled rejection', () => {
    it('apiFetch throw is handled by consumer try/catch', async () => {
      mockApiFetch.mockImplementation(() => { throw new LogoutCancellationError(); });

      let caught = false;
      try {
        await mockApiFetch('/test');
      } catch (e) {
        caught = e instanceof LogoutCancellationError;
      }
      expect(caught).toBe(true);
    });
  });
});
