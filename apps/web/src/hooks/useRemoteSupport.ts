'use client';

import { useState, useCallback, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getAuthHeaders() {
  const token = localStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

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

export function useRemoteSessions(status?: string) {
  const [sessions, setSessions] = useState<RemoteSession[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    try {
      const params = status ? `?status=${status}` : '';
      const res = await fetch(`${API_URL}/remote-support/sessions${params}`, { headers: getAuthHeaders() });
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
      const res = await fetch(`${API_URL}/remote-support/sessions`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ deviceId }),
      });
      if (res.ok) return await res.json();
      return null;
    } catch (e) {
      console.error('Failed to create session:', e);
      return null;
    } finally {
      setCreating(false);
    }
  }, []);

  return { createSession, creating };
}

export function useEndSession() {
  const endSession = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch(`${API_URL}/remote-support/sessions/${sessionId}/end`, {
        method: 'POST',
        headers: getAuthHeaders(),
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
      const res = await fetch(`${API_URL}/remote-support/recordings`, { headers: getAuthHeaders() });
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
      const res = await fetch(`${API_URL}/remote-support/audit-logs${params}`, { headers: getAuthHeaders() });
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
