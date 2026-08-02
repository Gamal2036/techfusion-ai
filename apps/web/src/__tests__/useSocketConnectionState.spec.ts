'use client';

import { renderHook, act } from '@testing-library/react';
import { useSocketConnectionState } from '@/hooks/useSocketConnectionState';

jest.mock('@/lib/socket-client', () => ({
  subscribeConnectionState: jest.fn(),
  getConnectionState: jest.fn(() => 'disconnected'),
}));

import { subscribeConnectionState, getConnectionState } from '@/lib/socket-client';

describe('useSocketConnectionState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return initial state from getConnectionState', () => {
    (getConnectionState as jest.Mock).mockReturnValue('connected');
    (subscribeConnectionState as jest.Mock).mockImplementation((_ns: string, cb: (s: string) => void) => {
      cb('connected');
      return jest.fn();
    });

    const { result } = renderHook(() => useSocketConnectionState('/metrics'));

    expect(result.current).toBe('connected');
    expect(subscribeConnectionState).toHaveBeenCalledWith('/metrics', expect.any(Function));
  });

  it('should return disconnected when no namespace exists', () => {
    (getConnectionState as jest.Mock).mockReturnValue('disconnected');
    (subscribeConnectionState as jest.Mock).mockImplementation((_ns: string, cb: (s: string) => void) => {
      cb('disconnected');
      return jest.fn();
    });

    const { result } = renderHook(() => useSocketConnectionState('/metrics'));

    expect(result.current).toBe('disconnected');
  });

  it('should update state when connection state changes', () => {
    let stateCallback: (state: string) => void = jest.fn();
    (getConnectionState as jest.Mock).mockReturnValue('disconnected');
    (subscribeConnectionState as jest.Mock).mockImplementation((_ns, cb) => {
      stateCallback = cb;
      return jest.fn();
    });

    const { result } = renderHook(() => useSocketConnectionState('/metrics'));

    expect(result.current).toBe('disconnected');

    act(() => {
      stateCallback('connecting');
    });

    expect(result.current).toBe('connecting');

    act(() => {
      stateCallback('connected');
    });

    expect(result.current).toBe('connected');
  });

  it('should unsubscribe on unmount', () => {
    const unsubscribe = jest.fn();
    (getConnectionState as jest.Mock).mockReturnValue('disconnected');
    (subscribeConnectionState as jest.Mock).mockReturnValue(unsubscribe);

    const { unmount } = renderHook(() => useSocketConnectionState('/metrics'));

    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
});
