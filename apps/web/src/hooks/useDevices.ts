'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/auth-client';
import { useSocketConnectionState } from '@/hooks/useSocketConnectionState';

export interface Device {
  id: string;
  orgId: string;
  name: string;
  hostname: string | null;
  os: string | null;
  osVersion: string | null;
  cpuModel: string | null;
  cpuCores: number | null;
  cpuLogical: number | null;
  ramTotal: number | null;
  gpuInfo: string | null;
  diskTotal: number | null;
  isLaptop: boolean;
  registeredAt: string;
  lastSeenAt: string | null;
}

export interface DeviceMetric {
  id: string;
  deviceId: string;
  recordedAt: string;
  cpuUsage: number;
  ramPercent: number;
  ramUsed: number;
  ramTotal: number;
  diskUsed: number | null;
  diskTotal: number | null;
  tempCpu: number | null;
  loadAverage1Min: number | null;
  processes: number | null;
  uptime: number | null;
  networkRxBytes: number | null;
  networkTxBytes: number | null;
}

export interface DeviceScore {
  id: string;
  deviceId: string;
  calculatedAt: string;
  healthScore: number;
  performanceScore: number;
  riskScore: number;
}

const NORMAL_POLL_INTERVAL = 15000;
const FAST_POLL_INTERVAL = 3000;
const DISCONNECTED_POLL_INTERVAL = 10000;

export function useDeviceList() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fastPolling, setFastPolling] = useState(false);
  const socketState = useSocketConnectionState('/metrics');

  const fetchDevices = useCallback(async () => {
    try {
      const res = await apiFetch('/devices');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setDevices(data);
        } else if (data && Array.isArray(data.data)) {
          setDevices(data.data);
        } else {
          setDevices([]);
        }
        setError(null);
      } else {
        const errorBody = await res.text().catch(() => '');
        setError(`Failed to fetch devices: ${res.status} ${errorBody}`.trim());
      }
    } catch (e) {
      setError('Network error while fetching devices');
      console.error('Failed to fetch devices:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const getPollInterval = useCallback(() => {
    if (fastPolling) return FAST_POLL_INTERVAL;
    if (socketState === 'disconnected' || socketState === 'reconnecting') {
      return DISCONNECTED_POLL_INTERVAL;
    }
    return NORMAL_POLL_INTERVAL;
  }, [fastPolling, socketState]);

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, getPollInterval());
    return () => clearInterval(interval);
  }, [fetchDevices, getPollInterval]);

  useEffect(() => {
    if (fastPolling) {
      const timeout = setTimeout(() => setFastPolling(false), 120000);
      return () => clearTimeout(timeout);
    }
  }, [fastPolling]);

  const startFastPolling = useCallback(() => {
    setFastPolling(true);
  }, []);

  return { devices, loading, error, refetch: fetchDevices, startFastPolling, fastPolling };
}

export function useDevice(id: string | undefined) {
  const [device, setDevice] = useState<Device | null>(null);
  const [metrics, setMetrics] = useState<DeviceMetric[]>([]);
  const [scores, setScores] = useState<DeviceScore | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDevice = useCallback(async () => {
    if (!id) return;
    try {
      const res = await apiFetch(`/devices/${id}/latest`);
      if (res.ok) {
        const data = await res.json();
        setDevice(data.device);
        if (data.metrics) {
          setMetrics((prev) => {
            const existing = new Set(prev.map((m) => m.id));
            const newMetrics = Array.isArray(data.metrics) ? data.metrics : [data.metrics];
            const unique = newMetrics.filter((m: DeviceMetric) => !existing.has(m.id));
            if (unique.length === 0) return prev;
            const next = [...prev, ...unique];
            if (next.length > 200) next.splice(0, next.length - 200);
            return next;
          });
        }
        setScores(data.scores);
      }
    } catch (e) {
      console.error('Failed to fetch device:', e);
    }
  }, [id]);

  const fetchMetrics = useCallback(async (minutes = 60) => {
    if (!id) return;
    try {
      const res = await apiFetch(`/devices/${id}/metrics?minutes=${minutes}&limit=200`);
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch (e) {
      console.error('Failed to fetch metrics:', e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDevice();
    fetchMetrics();
  }, [fetchDevice, fetchMetrics]);

  const addLiveMetric = useCallback((metric: DeviceMetric, score: DeviceScore) => {
    setMetrics((prev) => {
      const existingIds = new Set(prev.map((m) => m.id));
      if (existingIds.has(metric.id)) return prev;
      
      const next = [...prev, metric];
      if (next.length > 200) next.splice(0, next.length - 200);
      return next.sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
    });
    setScores(score);

    setDevice((prev) => {
      if (!prev) return prev;
      if (metric.recordedAt && (!prev.lastSeenAt || new Date(metric.recordedAt) > new Date(prev.lastSeenAt))) {
        return { ...prev, lastSeenAt: metric.recordedAt };
      }
      return prev;
    });
  }, []);

  return { device, metrics, scores, loading, refetch: fetchDevice, refetchMetrics: fetchMetrics, addLiveMetric };
}
