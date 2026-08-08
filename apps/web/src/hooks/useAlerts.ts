'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '@/lib/auth-client';
import { subscribe } from '@/lib/socket-client';

export type AlertRuleKind = 'metric' | 'presence';

export interface AlertRule {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  metricName: string;
  threshold: number;
  operator: string;
  severity: string;
  kind: AlertRuleKind;
  debounceSeconds: number;
  enabled: boolean;
  deviceSelector: string | null;
  webhookUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface Alert {
  id: string;
  orgId: string;
  alertRuleId: string;
  deviceId: string;
  metricValue: number;
  threshold: number;
  severity: string;
  message: string;
  status: AlertStatus;
  source: string | null;
  lastDetectedAt: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  device?: { id: string; name: string; hostname: string | null };
  alertRule?: { id: string; name: string; metricName: string; kind: AlertRuleKind };
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

export function useAlerts(options?: { status?: AlertStatus }) {
  const status = options?.status;
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const url = status ? `/alerts?status=${status}&limit=100` : '/alerts/latest';
      const res = await apiFetch(url);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data?.data ?? [];
        setAlerts(list);
        setTotal(Array.isArray(data) ? list.length : data?.total ?? list.length);
        setError(null);
      } else {
        setError(`Failed to fetch alerts: ${res.status}`);
      }
    } catch (e) {
      console.error('Failed to fetch alerts:', e);
      setError('Network error while fetching alerts');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const acknowledgeAlert = useCallback(
    async (id: string) => {
      const res = await apiFetch(`/alerts/${id}/acknowledge`, {
        method: 'PATCH',
      });
      if (!res.ok) throw new Error('Failed to acknowledge alert');
      const updated = (await res.json()) as Alert;
      // Keep the server response authoritative; an item whose status no longer
      // matches the feed scope is pruned so counts never go stale.
      const scope = status ?? 'OPEN';
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? updated : a)).filter((a) => a.id !== id || a.status === scope),
      );
      return updated;
    },
    [status],
  );

  const resolveAlert = useCallback(async (id: string) => {
    const res = await apiFetch(`/alerts/${id}/resolve`, {
      method: 'PATCH',
    });
    if (!res.ok) throw new Error('Failed to resolve alert');
    const updated = (await res.json()) as Alert;
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    return updated;
  }, []);

  return { alerts, total, loading, error, refetch: fetchAlerts, acknowledgeAlert, resolveAlert };
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
