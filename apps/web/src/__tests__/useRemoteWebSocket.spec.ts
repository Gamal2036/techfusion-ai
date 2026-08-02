'use client';

import { renderHook } from '@testing-library/react';
import { useRemoteWebSocket } from '@/hooks/useRemoteSupport';

const mockSubscribe = jest.fn(() => jest.fn());
jest.mock('@/lib/socket-client', () => ({
  subscribe: (...args: unknown[]) => (mockSubscribe as jest.Mock)(...args),
}));

describe('useRemoteWebSocket', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not subscribe when sessionId is null', () => {
    renderHook(() =>
      useRemoteWebSocket(null, {
        onSessionUpdate: jest.fn(),
        onSessionEnded: jest.fn(),
      }),
    );

    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  it('should subscribe to session-update events when sessionId provided', () => {
    renderHook(() =>
      useRemoteWebSocket('sess-001', {
        onSessionUpdate: jest.fn(),
      }),
    );

    expect(mockSubscribe).toHaveBeenCalledWith('/remote', 'session-update', expect.any(Function));
  });

  it('should subscribe to session-ended events', () => {
    renderHook(() =>
      useRemoteWebSocket('sess-001', {
        onSessionEnded: jest.fn(),
      }),
    );

    expect(mockSubscribe).toHaveBeenCalledWith('/remote', 'session-ended', expect.any(Function));
  });

  it('should subscribe to signal events', () => {
    renderHook(() =>
      useRemoteWebSocket('sess-001', {
        onSignal: jest.fn(),
      }),
    );

    expect(mockSubscribe).toHaveBeenCalledWith('/remote', 'signal', expect.any(Function));
  });

  it('should subscribe to screen-frame events', () => {
    renderHook(() =>
      useRemoteWebSocket('sess-001', {
        onScreenFrame: jest.fn(),
      }),
    );

    expect(mockSubscribe).toHaveBeenCalledWith('/remote', 'screen-frame', expect.any(Function));
  });

  it('should subscribe to all events when all callbacks provided', () => {
    renderHook(() =>
      useRemoteWebSocket('sess-001', {
        onSessionUpdate: jest.fn(),
        onSessionEnded: jest.fn(),
        onSignal: jest.fn(),
        onScreenFrame: jest.fn(),
      }),
    );

    expect(mockSubscribe).toHaveBeenCalledTimes(4);
  });

  it('should subscribe to events even without callbacks (refs are undefined)', () => {
    renderHook(() =>
      useRemoteWebSocket('sess-001', {}),
    );

    expect(mockSubscribe).toHaveBeenCalledTimes(4);
  });
});
