import { renderHook, act } from '@testing-library/react';
import { useSecurity, SECURITY_SCAN_TIMEOUT_MS, SECURITY_POLL_INTERVAL_MS } from '@/hooks/useSecurity';
import { apiFetch } from '@/lib/auth-client';

jest.mock('@/lib/auth-client', () => ({
  apiFetch: jest.fn(),
  getApiUrl: jest.fn().mockReturnValue('http://localhost:3001'),
}));

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function completedScan(id: string) {
  return {
    id,
    status: 'completed',
    startedAt: '2026-08-11T00:00:00Z',
    completedAt: '2026-08-11T00:01:00Z',
    error: null,
    findings: [
      {
        id: 'f-1',
        scanId: id,
        category: 'firewall',
        finding: 'Firewall inactive',
        severity: 'high',
        status: 'open',
        remediation: 'Enable firewall',
        details: null,
        createdAt: '2026-08-11T00:01:00Z',
        remediatedAt: null,
      },
    ],
    score: {
      securityScore: 88,
      riskLevel: 'low',
      totalFindings: 1,
      criticalCount: 0,
      highCount: 1,
      mediumCount: 0,
      lowCount: 0,
    },
  };
}

function failedScan(id: string, error: string) {
  return {
    id,
    status: 'failed',
    startedAt: '2026-08-11T00:00:00Z',
    completedAt: '2026-08-11T00:00:30Z',
    error,
    findings: [],
    score: null,
  };
}

async function flush(times = 4) {
  await act(async () => {
    for (let i = 0; i < times; i++) {
      await Promise.resolve();
    }
  });
}

describe('useSecurity', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('loads a real completed scan unchanged (backward compatible)', async () => {
    mockApiFetch.mockImplementation((url: string) => {
      if (url.includes('/security/latest/dev-1')) {
        return Promise.resolve(jsonResponse(completedScan('scan-1')));
      }
      if (url.includes('/security/scans/dev-1')) {
        return Promise.resolve(jsonResponse([completedScan('scan-1')]));
      }
      return Promise.resolve(jsonResponse([], 200));
    });

    const { result } = renderHook(() => useSecurity('dev-1'));
    await flush();

    expect(result.current.scanState).toBe('idle');
    expect(result.current.latestScan?.status).toBe('completed');
    expect(result.current.latestScan?.findings).toHaveLength(1);
    expect(result.current.latestScan?.score?.securityScore).toBe(88);
  });

  it('stops polling when a triggered scan reaches completed', async () => {
    jest.useFakeTimers();
    let latestCalls = 0;
    mockApiFetch.mockImplementation((url: string) => {
      if (url.endsWith('/security/scans/dev-1/trigger')) {
        return Promise.resolve(jsonResponse({ scanId: 'scan-2', status: 'pending' }, 201));
      }
      if (url.includes('/security/latest/dev-1')) {
        latestCalls += 1;
        if (latestCalls === 1) {
          return Promise.resolve(jsonResponse({ message: 'No scan found' }, 404));
        }
        return Promise.resolve(jsonResponse(completedScan('scan-2')));
      }
      if (url.includes('/security/scans/dev-1')) {
        return Promise.resolve(jsonResponse([completedScan('scan-2')]));
      }
      return Promise.resolve(jsonResponse([], 200));
    });

    const { result } = renderHook(() => useSecurity('dev-1'));
    await flush();
    expect(result.current.scanState).toBe('idle');

    await act(async () => {
      await result.current.triggerScan();
    });
    expect(result.current.scanState).toBe('running');

    await act(async () => {
      jest.advanceTimersByTime(SECURITY_POLL_INTERVAL_MS);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.scanState).toBe('completed');
    expect(result.current.latestScan?.status).toBe('completed');

    const callsAfterComplete = mockApiFetch.mock.calls.length;
    await act(async () => {
      jest.advanceTimersByTime(30000);
      await Promise.resolve();
    });
    expect(mockApiFetch.mock.calls.length).toBe(callsAfterComplete);
    expect(result.current.scanState).toBe('completed');
  });

  it('stops polling and reports failed when the scan fails', async () => {
    jest.useFakeTimers();
    let latestCalls = 0;
    mockApiFetch.mockImplementation((url: string) => {
      if (url.endsWith('/security/scans/dev-1/trigger')) {
        return Promise.resolve(jsonResponse({ scanId: 'scan-2', status: 'pending' }, 201));
      }
      if (url.includes('/security/latest/dev-1')) {
        latestCalls += 1;
        if (latestCalls === 1) {
          return Promise.resolve(jsonResponse({ message: 'No scan found' }, 404));
        }
        return Promise.resolve(jsonResponse(failedScan('scan-2', 'Agent reported scan failure')));
      }
      if (url.includes('/security/scans/dev-1')) {
        return Promise.resolve(jsonResponse([failedScan('scan-2', 'Agent reported scan failure')]));
      }
      return Promise.resolve(jsonResponse([], 200));
    });

    const { result } = renderHook(() => useSecurity('dev-1'));
    await flush();

    await act(async () => {
      await result.current.triggerScan();
    });
    expect(result.current.scanState).toBe('running');

    await act(async () => {
      jest.advanceTimersByTime(SECURITY_POLL_INTERVAL_MS);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.scanState).toBe('failed');
    expect(result.current.latestScan?.status).toBe('failed');
    expect(result.current.latestScan?.error).toContain('scan failure');
    expect(result.current.triggering).toBe(false);

    const callsAfterFail = mockApiFetch.mock.calls.length;
    await act(async () => {
      jest.advanceTimersByTime(30000);
      await Promise.resolve();
    });
    expect(mockApiFetch.mock.calls.length).toBe(callsAfterFail);
    expect(result.current.scanState).toBe('failed');
  });

  it('times out and stops polling when a scan is stuck pending', async () => {
    jest.useFakeTimers();
    mockApiFetch.mockImplementation((url: string) => {
      if (url.endsWith('/security/scans/dev-1/trigger')) {
        return Promise.resolve(jsonResponse({ scanId: 'scan-2', status: 'pending' }, 201));
      }
      if (url.includes('/security/latest/dev-1')) {
        return Promise.resolve(jsonResponse({ message: 'No scan found' }, 404));
      }
      return Promise.resolve(jsonResponse([], 200));
    });

    const { result } = renderHook(() => useSecurity('dev-1'));
    await flush();

    await act(async () => {
      await result.current.triggerScan();
    });
    expect(result.current.scanState).toBe('running');

    await act(async () => {
      jest.advanceTimersByTime(SECURITY_SCAN_TIMEOUT_MS + SECURITY_POLL_INTERVAL_MS);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.scanState).toBe('timeout');
    expect(result.current.triggering).toBe(false);

    const callsAfterTimeout = mockApiFetch.mock.calls.length;
    await act(async () => {
      jest.advanceTimersByTime(30000);
      await Promise.resolve();
    });
    expect(mockApiFetch.mock.calls.length).toBe(callsAfterTimeout);
    expect(result.current.scanState).toBe('timeout');
  });

  it('does not produce permanent loading on 401 during polling', async () => {
    jest.useFakeTimers();
    mockApiFetch.mockImplementation((url: string) => {
      if (url.endsWith('/security/scans/dev-1/trigger')) {
        return Promise.resolve(jsonResponse({ scanId: 'scan-2', status: 'pending' }, 201));
      }
      if (url.includes('/security/latest/dev-1')) {
        return Promise.resolve(jsonResponse({ message: 'Unauthorized' }, 401));
      }
      return Promise.resolve(jsonResponse([], 200));
    });

    const { result } = renderHook(() => useSecurity('dev-1'));
    await flush();

    await act(async () => {
      await result.current.triggerScan();
    });
    expect(result.current.scanState).toBe('running');

    await act(async () => {
      jest.advanceTimersByTime(SECURITY_POLL_INTERVAL_MS);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.scanState).toBe('idle');
    expect(result.current.error).toContain('401/403');
    expect(result.current.loading).toBe(false);

    const callsAfterAuthFail = mockApiFetch.mock.calls.length;
    await act(async () => {
      jest.advanceTimersByTime(30000);
      await Promise.resolve();
    });
    expect(mockApiFetch.mock.calls.length).toBe(callsAfterAuthFail);
    expect(result.current.loading).toBe(false);
  });

  it('terminates safely on unexpected API failure during polling', async () => {
    jest.useFakeTimers();
    mockApiFetch.mockImplementation((url: string) => {
      if (url.endsWith('/security/scans/dev-1/trigger')) {
        return Promise.resolve(jsonResponse({ scanId: 'scan-2', status: 'pending' }, 201));
      }
      if (url.includes('/security/latest/dev-1')) {
        return Promise.resolve(jsonResponse({ message: 'Internal Server Error' }, 500));
      }
      return Promise.resolve(jsonResponse([], 200));
    });

    const { result } = renderHook(() => useSecurity('dev-1'));
    await flush();

    await act(async () => {
      await result.current.triggerScan();
    });
    expect(result.current.scanState).toBe('running');

    await act(async () => {
      jest.advanceTimersByTime(SECURITY_POLL_INTERVAL_MS);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.scanState).toBe('idle');
    expect(result.current.error).toContain('HTTP 500');
    expect(result.current.loading).toBe(false);

    const callsAfterServerError = mockApiFetch.mock.calls.length;
    await act(async () => {
      jest.advanceTimersByTime(30000);
      await Promise.resolve();
    });
    expect(mockApiFetch.mock.calls.length).toBe(callsAfterServerError);
  });
});
