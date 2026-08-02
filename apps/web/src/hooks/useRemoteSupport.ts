'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { apiFetch } from '@/lib/auth-client';
import { subscribe } from '@/lib/socket-client';

export interface RemoteSession {
  id: string;
  orgId: string;
  deviceId: string;
  technicianId: string;
  status: string;
  protocol: string;
  recordingPath: string | null;
  recordingSize: number | null;
  recordingDuration: number | null;
  startedAt: string | null;
  endedAt: string | null;
  consentGranted: boolean;
  consentMethod: string | null;
  errorMessage: string | null;
  metadata: any;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  orgId: string;
  sessionId: string | null;
  action: string;
  actorId: string | null;
  targetId: string | null;
  details: any;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface SessionRecording {
  id: string;
  deviceId: string;
  recordingPath: string | null;
  recordingSize: number | null;
  recordingDuration: number | null;
  startedAt: string | null;
  endedAt: string | null;
}

export interface DeviceInfo {
  id: string;
  hostname: string;
  os: string | null;
  osVersion: string | null;
  lastSeenAt: string;
  inactive: boolean;
}

export function useDevices() {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDevices = useCallback(async () => {
    try {
      const res = await apiFetch('/remote-support/devices');
      if (res.ok) setDevices(await res.json());
    } catch (e) {
      console.error('Failed to fetch devices:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  return { devices, loading, refetch: fetchDevices };
}

export function useRemoteSessions(status?: string) {
  const [sessions, setSessions] = useState<RemoteSession[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    try {
      const params = status ? `?status=${status}` : '';
      const res = await apiFetch(`/remote-support/sessions${params}`);
      if (res.ok) setSessions(await res.json());
    } catch (e) {
      console.error('Failed to fetch remote sessions:', e);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  return { sessions, loading, refetch: fetchSessions };
}

export function useCreateSession() {
  const [creating, setCreating] = useState(false);

  const createSession = useCallback(async (deviceId: string) => {
    setCreating(true);
    try {
      const res = await apiFetch('/remote-support/sessions', {
        method: 'POST',
        body: JSON.stringify({ deviceId }),
      });
      if (res.ok) return await res.json();
      const error = await res.json().catch(() => ({ message: 'Failed to create session' }));
      throw new Error(error.message || 'Failed to create session');
    } catch (e) {
      console.error('Failed to create session:', e);
      throw e;
    } finally {
      setCreating(false);
    }
  }, []);

  return { createSession, creating };
}

export function useEndSession() {
  const endSession = useCallback(async (sessionId: string) => {
    try {
      const res = await apiFetch(`/remote-support/sessions/${sessionId}/end`, {
        method: 'POST',
      });
      return res.ok;
    } catch (e) {
      console.error('Failed to end session:', e);
      return false;
    }
  }, []);

  return { endSession };
}

export function useRecordings() {
  const [recordings, setRecordings] = useState<SessionRecording[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecordings = useCallback(async () => {
    try {
      const res = await apiFetch('/remote-support/recordings');
      if (res.ok) setRecordings(await res.json());
    } catch (e) {
      console.error('Failed to fetch recordings:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRecordings(); }, [fetchRecordings]);

  return { recordings, loading, refetch: fetchRecordings };
}

export function useAuditLogs(sessionId?: string) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    try {
      const params = sessionId ? `?sessionId=${sessionId}` : '';
      const res = await apiFetch(`/remote-support/audit-logs${params}`);
      if (res.ok) setLogs(await res.json());
    } catch (e) {
      console.error('Failed to fetch audit logs:', e);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return { logs, loading, refetch: fetchLogs };
}

export function useRemoteWebSocket(
  sessionId: string | null,
  callbacks: {
    onSessionUpdate?: (session: any) => void;
    onSessionEnded?: (data: any) => void;
    onSignal?: (data: any) => void;
    onScreenFrame?: (data: any) => void;
  },
) {
  const sessionUpdateRef = useRef(callbacks.onSessionUpdate);
  sessionUpdateRef.current = callbacks.onSessionUpdate;
  const sessionEndedRef = useRef(callbacks.onSessionEnded);
  sessionEndedRef.current = callbacks.onSessionEnded;
  const signalRef = useRef(callbacks.onSignal);
  signalRef.current = callbacks.onSignal;
  const screenFrameRef = useRef(callbacks.onScreenFrame);
  screenFrameRef.current = callbacks.onScreenFrame;

  useEffect(() => {
    if (!sessionId) return;

    const cleanups: (() => void)[] = [];

    cleanups.push(
      subscribe('/remote', 'session-update', (session: any) => {
        sessionUpdateRef.current?.(session);
      }),
    );

    cleanups.push(
      subscribe('/remote', 'session-ended', (data: any) => {
        sessionEndedRef.current?.(data);
      }),
    );

    cleanups.push(
      subscribe('/remote', 'signal', (data: any) => {
        signalRef.current?.(data);
      }),
    );

    cleanups.push(
      subscribe('/remote', 'screen-frame', (data: any) => {
        screenFrameRef.current?.(data);
      }),
    );

    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, [sessionId]);
}
