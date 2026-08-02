'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '@/lib/auth-client';
import { subscribe } from '@/lib/socket-client';

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
      const res = await apiFetch('/alerts/rules');
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
    const res = await apiFetch('/alerts/rules', {
      method: 'POST',
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
    const res = await apiFetch(`/alerts/rules/${id}`, {
      method: 'PATCH',
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
    const res = await apiFetch(`/alerts/rules/${id}`, {
      method: 'DELETE',
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
      const res = await apiFetch('/alerts/latest');
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
    const res = await apiFetch(`/alerts/${id}/acknowledge`, {
      method: 'PATCH',
    });
    if (res.ok) {
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    }
  }, []);

  return { alerts, loading, refetch: fetchAlerts, acknowledgeAlert };
}

export function useAlertWebSocket(onAlert: (alert: Alert) => void) {
  const callbackRef = useRef(onAlert);
  callbackRef.current = onAlert;

  useEffect(() => {
    return subscribe('/metrics', 'alerts', (alert: Alert) => {
      callbackRef.current(alert);
    });
  }, []);
}
