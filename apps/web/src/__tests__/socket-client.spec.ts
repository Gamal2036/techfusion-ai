jest.mock('socket.io-client', () => {
  const mockSocket = {
    on: jest.fn(),
    off: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    removeAllListeners: jest.fn(),
    connected: false,
    disconnected: true,
  };
  return {
    io: jest.fn(() => mockSocket),
  };
});

import { subscribe, disconnectAll, getConnectionState, subscribeConnectionState } from '@/lib/socket-client';
import { io } from 'socket.io-client';

const mockIo = io as jest.MockedFunction<typeof io>;
let mockSocket: any;

function getMockSocket(): any {
  return mockIo.mock.results[0]?.value;
}

describe('Socket Client Lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    disconnectAll();
    mockSocket = undefined;
  });

  describe('connection management', () => {
    it('creates one socket instance per namespace', () => {
      const cb1 = jest.fn();
      const cb2 = jest.fn();

      subscribe('/metrics', 'metrics', cb1);
      subscribe('/metrics', 'alerts', cb2);

      expect(mockIo).toHaveBeenCalledTimes(1);
    });

    it('connects socket on first subscriber', () => {
      subscribe('/metrics', 'metrics', jest.fn());
      const socket = getMockSocket();
      expect(socket.connect).toHaveBeenCalled();
    });

    it('disconnects socket when subscriber count reaches zero', () => {
      const unsubscribe = subscribe('/metrics', 'metrics', jest.fn());
      const socket = getMockSocket();
      unsubscribe();
      expect(socket.disconnect).toHaveBeenCalled();
      expect(socket.removeAllListeners).toHaveBeenCalled();
    });

    it('does not call close() after disconnect', () => {
      const unsubscribe = subscribe('/metrics', 'metrics', jest.fn());
      const socket = getMockSocket();
      unsubscribe();
      expect(socket.disconnect).toHaveBeenCalled();
      expect(socket.close).toBeUndefined();
    });
  });

  describe('listener management', () => {
    it('registers listener once for multiple subscribers on same event', () => {
      const cb1 = jest.fn();
      const cb2 = jest.fn();

      subscribe('/metrics', 'metrics', cb1);
      subscribe('/metrics', 'metrics', cb2);

      const socket = getMockSocket();
      const metricsOnCalls = socket.on.mock.calls.filter(
        (call: any[]) => call[0] === 'metrics'
      );
      expect(metricsOnCalls).toHaveLength(1);
    });

    it('removes listener when all subscribers for event unsubscribe', () => {
      const cb1 = jest.fn();
      const cb2 = jest.fn();

      const unsub1 = subscribe('/metrics', 'metrics', cb1);
      const unsub2 = subscribe('/metrics', 'metrics', cb2);

      unsub1();
      unsub2();

      const socket = getMockSocket();
      expect(socket.off).toHaveBeenCalledWith('metrics');
    });

    it('cleans up listeners correctly on disconnect', () => {
      const unsub1 = subscribe('/metrics', 'metrics', jest.fn());
      const unsub2 = subscribe('/metrics', 'alerts', jest.fn());

      unsub1();
      unsub2();

      const socket = getMockSocket();
      expect(socket.removeAllListeners).toHaveBeenCalled();
    });
  });

  describe('connection state', () => {
    it('returns disconnected when no socket exists', () => {
      const state = getConnectionState('/nonexistent');
      expect(state).toBe('disconnected');
    });

    it('tracks connection state changes', () => {
      subscribe('/metrics', 'metrics', jest.fn());
      const socket = getMockSocket();
      const connectHandler = socket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      );
      expect(connectHandler).toBeDefined();
    });

    it('provides initial state to new subscribers', () => {
      const callback = jest.fn();
      subscribeConnectionState('/metrics', callback);
      expect(callback).toHaveBeenCalledWith('disconnected');
    });
  });

  describe('cleanup', () => {
    it('disconnectAll cleans up all namespaces', () => {
      subscribe('/metrics', 'metrics', jest.fn());
      subscribe('/network', 'topology', jest.fn());

      disconnectAll();

      const socket = getMockSocket();
      expect(socket.disconnect).toHaveBeenCalled();
      expect(socket.removeAllListeners).toHaveBeenCalled();
    });
  });
});
