'use client';

import { renderHook, act } from '@testing-library/react';
import { useNetworkWebSocket } from '@/hooks/useNetwork';

const mockSubscribe = jest.fn(() => jest.fn());
jest.mock('@/lib/socket-client', () => ({
  subscribe: (...args: unknown[]) => (mockSubscribe as jest.Mock)(...args),
}));

describe('useNetworkWebSocket', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should subscribe to topology events', () => {
    renderHook(() =>
      useNetworkWebSocket({
        onTopology: jest.fn(),
      }),
    );

    expect(mockSubscribe).toHaveBeenCalledWith('/network', 'topology', expect.any(Function));
  });

  it('should subscribe to diagnostics events', () => {
    renderHook(() =>
      useNetworkWebSocket({
        onDiagnostics: jest.fn(),
      }),
    );

    expect(mockSubscribe).toHaveBeenCalledWith('/network', 'diagnostics', expect.any(Function));
  });

  it('should subscribe to scan-status events', () => {
    renderHook(() =>
      useNetworkWebSocket({
        onScanStatus: jest.fn(),
      }),
    );

    expect(mockSubscribe).toHaveBeenCalledWith('/network', 'scan-status', expect.any(Function));
  });

  it('should subscribe to all events when all callbacks provided', () => {
    renderHook(() =>
      useNetworkWebSocket({
        onTopology: jest.fn(),
        onDiagnostics: jest.fn(),
        onScanStatus: jest.fn(),
      }),
    );

    expect(mockSubscribe).toHaveBeenCalledTimes(3);
  });

  it('should not subscribe to events without callbacks', () => {
    renderHook(() =>
      useNetworkWebSocket({}),
    );

    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  it('should clean up subscriptions on unmount', () => {
    const unsub = jest.fn();
    mockSubscribe.mockReturnValue(unsub);

    const { unmount } = renderHook(() =>
      useNetworkWebSocket({
        onTopology: jest.fn(),
        onDiagnostics: jest.fn(),
      }),
    );

    unmount();

    expect(unsub).toHaveBeenCalledTimes(2);
  });
});
