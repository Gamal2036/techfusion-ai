'use client';

import { io, Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken(): string | null {
  try {
    return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  } catch {
    return null;
  }
}

interface NamespaceState {
  socket: Socket;
  subscriberCount: number;
  eventListeners: Map<string, Map<string, (...args: any[]) => void>>;
}

const namespaces = new Map<string, NamespaceState>();
const namespaceQueryParams = new Map<string, Record<string, string>>();
let idCounter = 0;

function createSocket(namespace: string): Socket {
  const queryParams = namespaceQueryParams.get(namespace);
  const socket = io(`${WS_URL}${namespace}`, {
    auth: (cb: (data: Record<string, unknown>) => void) => {
      const token = getToken();
      if (!token) {
        console.warn(`[Socket] ${namespace}: No auth token available`);
        cb({ token: null });
        return;
      }
      cb({ token });
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    autoConnect: false,
    ...(queryParams ? { query: queryParams } : {}),
  });

  socket.on('connect_error', (err) => {
    console.warn(`[Socket] ${namespace} connection error:`, err.message);
  });

  if (process.env.NODE_ENV !== 'production') {
    socket.on('connect', () => {
      console.log(`[Socket] ${namespace} connected`, { socketId: socket.id });
    });
    socket.on('disconnect', (reason) => {
      console.log(`[Socket] ${namespace} disconnected`, { reason });
    });
  }

  trackConnectionState(namespace, socket);

  return socket;
}

function getOrCreateState(namespace: string): NamespaceState {
  let state = namespaces.get(namespace);
  if (!state) {
    const socket = createSocket(namespace);
    state = {
      socket,
      subscriberCount: 0,
      eventListeners: new Map(),
    };
    namespaces.set(namespace, state);
  }
  return state;
}

export function subscribe(
  namespace: string,
  event: string,
  callback: (...args: any[]) => void,
): () => void {
  const subId = `sub_${++idCounter}`;
  const state = getOrCreateState(namespace);

  if (!state.eventListeners.has(event)) {
    state.eventListeners.set(event, new Map());
  }
  state.eventListeners.get(event)!.set(subId, callback);

  if (state.eventListeners.get(event)!.size === 1) {
    state.socket.on(event, (...args: any[]) => {
      const listeners = state.eventListeners.get(event);
      if (listeners) {
        for (const listener of listeners.values()) {
          listener(...args);
        }
      }
    });
  }

  state.subscriberCount++;

  if (state.subscriberCount === 1 && !state.socket.connected) {
    state.socket.connect();
  }

  return () => {
    state.eventListeners.get(event)?.delete(subId);

    if (state.eventListeners.get(event)?.size === 0) {
      state.socket.off(event);
      state.eventListeners.delete(event);
    }

    state.subscriberCount--;

    if (state.subscriberCount <= 0) {
      state.socket.removeAllListeners();
      state.socket.disconnect();
      namespaces.delete(namespace);
    }
  };
}

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

const connectionStateListeners = new Map<string, Set<(state: ConnectionState) => void>>();

function emitConnectionState(namespace: string, state: ConnectionState) {
  const listeners = connectionStateListeners.get(namespace);
  if (listeners) {
    for (const listener of listeners) listener(state);
  }
}

function trackConnectionState(namespace: string, socket: Socket) {
  socket.on('connect', () => {
    emitConnectionState(namespace, 'connected');
  });
  socket.on('disconnect', () => {
    emitConnectionState(namespace, 'disconnected');
  });
  socket.on('reconnect_attempt', () => {
    emitConnectionState(namespace, 'reconnecting');
  });
  socket.on('reconnect', () => {
    emitConnectionState(namespace, 'connected');
  });
  socket.on('connect_error', () => {
    if (!socket.connected) emitConnectionState(namespace, 'disconnected');
  });
}

export function getConnectionState(namespace: string): ConnectionState {
  const state = namespaces.get(namespace);
  if (!state) return 'disconnected';
  if (state.socket.connected) return 'connected';
  if (state.socket.disconnected === false) return 'connecting';
  return 'disconnected';
}

export function subscribeConnectionState(namespace: string, callback: (state: ConnectionState) => void): () => void {
  if (!connectionStateListeners.has(namespace)) {
    connectionStateListeners.set(namespace, new Set());
  }
  connectionStateListeners.get(namespace)!.add(callback);

  const state = namespaces.get(namespace);
  if (state) {
    callback(getConnectionState(namespace));
  } else {
    callback('disconnected');
  }

  return () => {
    connectionStateListeners.get(namespace)?.delete(callback);
    if (connectionStateListeners.get(namespace)?.size === 0) {
      connectionStateListeners.delete(namespace);
    }
  };
}

export function disconnectAll(): void {
  for (const [, state] of namespaces) {
    state.socket.removeAllListeners();
    state.socket.disconnect();
  }
  namespaces.clear();
  namespaceQueryParams.clear();
  for (const [, listeners] of connectionStateListeners) {
    listeners.clear();
  }
}

export function reconnectAll(): void {
  for (const [, state] of namespaces) {
    if (!state.socket.connected) {
      state.socket.connect();
    }
  }
}

export function subscribeWithQuery(
  namespace: string,
  event: string,
  callback: (...args: any[]) => void,
  query: Record<string, string>,
): () => void {
  if (!namespaceQueryParams.has(namespace)) {
    namespaceQueryParams.set(namespace, query);
  }
  return subscribe(namespace, event, callback);
}
