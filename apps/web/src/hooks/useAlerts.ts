'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

function getAuthHeaders() {
  const token = localStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export interface AlertRule {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  metricName: string;
  threshold: number;
  operator: string;
  severity: string;
  debounceSeconds: number;
  enabled: boolean;
  deviceSelector: string | null;
  webhookUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Alert {
  id: string;
  orgId: string;
  alertRuleId: string;
  deviceId: string;
  metricValue: number;
  threshold: number;
  severity: string;
  message: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  device?: { id: string; name: string; hostname: string | null };
  alertRule?: { id: string; name: string; metricName: string };
}

export function useAlertRules() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/alerts/rules`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setRules(await res.json());
      }
    } catch (e) {
      console.error('Failed to fetch alert rules:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const createRule = useCallback(async (data: Partial<AlertRule>) => {
    const res = await fetch(`${API_URL}/alerts/rules`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const rule = await res.json();
      setRules((prev) => [rule, ...prev]);
      return rule;
    }
    throw new Error('Failed to create rule');
  }, []);

  const updateRule = useCallback(async (id: string, data: Partial<AlertRule>) => {
    const res = await fetch(`${API_URL}/alerts/rules/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const updated = await res.json();
      setRules((prev) => prev.map((r) => (r.id === id ? updated : r)));
      return updated;
    }
    throw new Error('Failed to update rule');
  }, []);

  const deleteRule = useCallback(async (id: string) => {
    const res = await fetch(`${API_URL}/alerts/rules/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      setRules((prev) => prev.filter((r) => r.id !== id));
    }
  }, []);

  return { rules, loading, refetch: fetchRules, createRule, updateRule, deleteRule };
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/alerts/latest`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setAlerts(await res.json());
      }
    } catch (e) {
      console.error('Failed to fetch alerts:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const acknowledgeAlert = useCallback(async (id: string) => {
    const res = await fetch(`${API_URL}/alerts/${id}/acknowledge`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    }
  }, []);

  return { alerts, loading, refetch: fetchAlerts, acknowledgeAlert };
}

export function useAlertWebSocket(orgId: string | undefined, onAlert: (alert: Alert) => void) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!orgId) return;

    const socket = io(`${WS_URL}/metrics`, {
      query: { orgId },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('[WS] Connected to alert stream');
    });

    socket.on('alerts', (data: Alert) => {
      onAlert(data);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [orgId, onAlert]);

  return { isConnected: socketRef.current?.connected ?? false };
}
