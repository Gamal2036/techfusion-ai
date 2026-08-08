import { renderHook, waitFor, act } from '@testing-library/react';
import { useAlerts, type Alert, type AlertStatus } from '@/hooks/useAlerts';

jest.mock('@/lib/auth-client', () => ({
  apiFetch: jest.fn(),
}));

jest.mock('@/lib/socket-client', () => ({
  subscribe: jest.fn(() => () => {}),
}));

import { apiFetch } from '@/lib/auth-client';

const mockApiFetch = apiFetch as jest.Mock;

function okResponse(body: unknown) {
  return { ok: true, json: async () => body };
}

function makeAlert(id: string, status: AlertStatus): Alert {
  return {
    id,
    orgId: 'org-1',
    alertRuleId: 'rule-1',
    deviceId: 'dev-1',
    metricValue: 1,
    threshold: 1,
    severity: 'warning',
    message: `msg ${id}`,
    status,
    source: 'presence',
    lastDetectedAt: '2026-08-06T00:00:00.000Z',
    acknowledgedAt: null,
    resolvedAt: null,
    createdAt: '2026-08-06T00:00:00.000Z',
  };
}

describe('useAlerts status-scoped feed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches the status-filtered API when a status is provided', async () => {
    const open = makeAlert('a1', 'OPEN');
    mockApiFetch.mockResolvedValue(okResponse({ data: [open], total: 7 }));

    const { result, unmount } = renderHook(() => useAlerts({ status: 'OPEN' }));

    expect(mockApiFetch).toHaveBeenCalledWith('/alerts?status=OPEN&limit=100');
    await waitFor(() => expect(result.current.alerts).toEqual([open]));
    expect(result.current.total).toBe(7);
    expect(result.current.loading).toBe(false);
    unmount();
  });

  it('falls back to /alerts/latest when no status is provided', async () => {
    mockApiFetch.mockResolvedValue(okResponse([makeAlert('a1', 'OPEN')]));

    const { result, unmount } = renderHook(() => useAlerts());

    expect(mockApiFetch).toHaveBeenCalledWith('/alerts/latest');
    await waitFor(() => expect(result.current.alerts).toHaveLength(1));
    unmount();
  });

  it('refetches when the status option changes', async () => {
    mockApiFetch.mockResolvedValue(okResponse({ data: [], total: 0 }));

    const { result, rerender, unmount } = renderHook(
      ({ status }: { status: AlertStatus }) => useAlerts({ status }),
      { initialProps: { status: 'OPEN' } },
    );

    await waitFor(() => expect(mockApiFetch).toHaveBeenLastCalledWith('/alerts?status=OPEN&limit=100'));

    rerender({ status: 'RESOLVED' });
    await waitFor(() => expect(mockApiFetch).toHaveBeenLastCalledWith('/alerts?status=RESOLVED&limit=100'));
    unmount();
  });

  it('prunes an acknowledged alert from the OPEN scope so counts stay current', async () => {
    const open = makeAlert('a1', 'OPEN');
    mockApiFetch.mockResolvedValueOnce(okResponse({ data: [open], total: 1 }));

    const { result, unmount } = renderHook(() => useAlerts({ status: 'OPEN' }));
    await waitFor(() => expect(result.current.alerts).toHaveLength(1));

    const acknowledged = { ...open, status: 'ACKNOWLEDGED' as const, acknowledgedAt: '2026-08-06T01:00:00.000Z' };
    mockApiFetch.mockResolvedValueOnce(okResponse(acknowledged));

    act(() => {
      result.current.acknowledgeAlert('a1');
    });

    await waitFor(() => expect(result.current.alerts).toHaveLength(0));
    expect(mockApiFetch).toHaveBeenCalledWith('/alerts/a1/acknowledge', { method: 'PATCH' });
    unmount();
  });

  it('removes an alert from the ACKNOWLEDGED scope after it is resolved', async () => {
    const ack = makeAlert('a1', 'ACKNOWLEDGED');
    mockApiFetch.mockResolvedValueOnce(okResponse({ data: [ack], total: 1 }));

    const { result, unmount } = renderHook(() => useAlerts({ status: 'ACKNOWLEDGED' }));
    await waitFor(() => expect(result.current.alerts).toHaveLength(1));

    const resolved = { ...ack, status: 'RESOLVED' as const, resolvedAt: '2026-08-06T02:00:00.000Z' };
    mockApiFetch.mockResolvedValueOnce(okResponse(resolved));

    act(() => {
      result.current.resolveAlert('a1');
    });

    await waitFor(() => expect(result.current.alerts).toHaveLength(0));
    expect(mockApiFetch).toHaveBeenCalledWith('/alerts/a1/resolve', { method: 'PATCH' });
    unmount();
  });

  it('exposes an error when the status-filtered request fails', async () => {
    mockApiFetch.mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' });

    const { result, unmount } = renderHook(() => useAlerts({ status: 'OPEN' }));

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.alerts).toEqual([]);
    unmount();
  });
});
