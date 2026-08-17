import { renderHook, act } from '@testing-library/react';
import {
  useStartDiscovery,
  NETWORK_POLL_INTERVAL_MS,
  NETWORK_SCAN_TIMEOUT_MS,
} from '@/hooks/useNetwork';
import { apiFetch } from '@/lib/auth-client';

jest.mock('@/lib/auth-client', () => ({
  ...jest.requireActual('@/lib/auth-client'),
  apiFetch: jest.fn(),
  getApiUrl: jest.fn().mockReturnValue('http://localhost:3001'),
  isLoggingOut: jest.fn().mockReturnValue(false),
}));

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function scanRow(id: string, status: string, error?: string) {
  return {
    id,
    orgId: 'org-1',
    status,
    startedAt: '2026-08-12T00:00:00Z',
    completedAt: status === 'pending' || status === 'running' ? null : '2026-08-12T00:01:00Z',
    error: error ?? null,
    gatewayIp: null,
    localIp: null,
    subnet: null,
    deviceCount: 0,
  };
}

async function flush(times = 4) {
  await act(async () => {
    for (let i = 0; i < times; i++) {
      await Promise.resolve();
    }
  });
}

describe('useStartDiscovery — Web vs Agent auth boundary (NET-01A)', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('polls the JWT read path (/network/scans) and completes — never the agent device-token route', async () => {
    jest.useFakeTimers();
    mockApiFetch.mockImplementation((url: string) => {
      if (url.endsWith('/network/discovery/trigger')) {
        return Promise.resolve(jsonResponse({ scanId: 'scan-2', status: 'pending' }, 201));
      }
      if (url.includes('/network/scans')) {
        return Promise.resolve(jsonResponse([scanRow('scan-2', 'completed')]));
      }
      return Promise.resolve(jsonResponse([], 200));
    });

    const { result } = renderHook(() => useStartDiscovery());
    await flush();

    await act(async () => {
      await result.current.startDiscovery();
    });
    expect(result.current.state).toBe('running');
    expect(result.current.discoveryPolling).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(NETWORK_POLL_INTERVAL_MS);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.state).toBe('completed');
    expect(result.current.scanStatus).toBe('completed');
    expect(result.current.discoveryPolling).toBe(false);

    const callsAfterComplete = mockApiFetch.mock.calls.length;
    await act(async () => {
      jest.advanceTimersByTime(30000);
      await Promise.resolve();
    });
    expect(mockApiFetch.mock.calls.length).toBe(callsAfterComplete);

    const requested = mockApiFetch.mock.calls.map((c) => String(c[0]));
    expect(requested).not.toContain('/network/discovery/pending');
    expect(requested.some((u) => u.includes('/network/scans'))).toBe(true);
  });

  it('reaches a failed terminal state when the agent marks the scan failed', async () => {
    jest.useFakeTimers();
    mockApiFetch.mockImplementation((url: string) => {
      if (url.endsWith('/network/discovery/trigger')) {
        return Promise.resolve(jsonResponse({ scanId: 'scan-2', status: 'pending' }, 201));
      }
      if (url.includes('/network/scans')) {
        return Promise.resolve(
          jsonResponse([scanRow('scan-2', 'failed', 'Discovery timed out on the agent')]),
        );
      }
      return Promise.resolve(jsonResponse([], 200));
    });

    const { result } = renderHook(() => useStartDiscovery());
    await flush();

    await act(async () => {
      await result.current.startDiscovery();
    });
    expect(result.current.state).toBe('running');

    await act(async () => {
      jest.advanceTimersByTime(NETWORK_POLL_INTERVAL_MS);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.state).toBe('failed');
    expect(result.current.error).toContain('Discovery timed out on the agent');
    expect(result.current.discoveryPolling).toBe(false);

    const requested = mockApiFetch.mock.calls.map((c) => String(c[0]));
    expect(requested).not.toContain('/network/discovery/pending');
  });

  it('times out to a terminal state when the scan stays pending (never infinite loading)', async () => {
    jest.useFakeTimers();
    mockApiFetch.mockImplementation((url: string) => {
      if (url.endsWith('/network/discovery/trigger')) {
        return Promise.resolve(jsonResponse({ scanId: 'scan-2', status: 'pending' }, 201));
      }
      if (url.includes('/network/scans')) {
        return Promise.resolve(jsonResponse([scanRow('scan-2', 'pending')]));
      }
      return Promise.resolve(jsonResponse([], 200));
    });

    const { result } = renderHook(() => useStartDiscovery());
    await flush();

    await act(async () => {
      await result.current.startDiscovery();
    });
    expect(result.current.state).toBe('running');

    await act(async () => {
      jest.advanceTimersByTime(NETWORK_SCAN_TIMEOUT_MS + NETWORK_POLL_INTERVAL_MS);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.state).toBe('timeout');
    expect(result.current.discoveryPolling).toBe(false);
    expect(result.current.error).toContain('timed out');

    const callsAfterTimeout = mockApiFetch.mock.calls.length;
    await act(async () => {
      jest.advanceTimersByTime(30000);
      await Promise.resolve();
    });
    expect(mockApiFetch.mock.calls.length).toBe(callsAfterTimeout);

    const requested = mockApiFetch.mock.calls.map((c) => String(c[0]));
    expect(requested).not.toContain('/network/discovery/pending');
  });

  it('stops polling with an honest failed state on 401 from the JWT read path', async () => {
    jest.useFakeTimers();
    mockApiFetch.mockImplementation((url: string) => {
      if (url.endsWith('/network/discovery/trigger')) {
        return Promise.resolve(jsonResponse({ scanId: 'scan-2', status: 'pending' }, 201));
      }
      if (url.includes('/network/scans')) {
        return Promise.resolve(jsonResponse({ message: 'Unauthorized' }, 401));
      }
      return Promise.resolve(jsonResponse([], 200));
    });

    const { result } = renderHook(() => useStartDiscovery());
    await flush();

    await act(async () => {
      await result.current.startDiscovery();
    });
    expect(result.current.state).toBe('running');

    await act(async () => {
      jest.advanceTimersByTime(NETWORK_POLL_INTERVAL_MS);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.state).toBe('failed');
    expect(result.current.error).toContain('401/403');
    expect(result.current.discoveryPolling).toBe(false);

    const callsAfterAuthFail = mockApiFetch.mock.calls.length;
    await act(async () => {
      jest.advanceTimersByTime(30000);
      await Promise.resolve();
    });
    expect(mockApiFetch.mock.calls.length).toBe(callsAfterAuthFail);

    const requested = mockApiFetch.mock.calls.map((c) => String(c[0]));
    expect(requested).not.toContain('/network/discovery/pending');
  });

  it('reports a failed terminal state when the JWT trigger is denied (401)', async () => {
    mockApiFetch.mockImplementation((url: string) => {
      if (url.endsWith('/network/discovery/trigger')) {
        return Promise.resolve(jsonResponse({ message: 'Unauthorized' }, 401));
      }
      return Promise.resolve(jsonResponse([], 200));
    });

    const { result } = renderHook(() => useStartDiscovery());
    await flush();

    await act(async () => {
      await result.current.startDiscovery();
    });
    expect(result.current.state).toBe('failed');
    expect(result.current.error).toContain('401/403');
    expect(result.current.discoveryPolling).toBe(false);
    expect(result.current.starting).toBe(false);

    const requested = mockApiFetch.mock.calls.map((c) => String(c[0]));
    expect(requested).not.toContain('/network/discovery/pending');
  });
});
