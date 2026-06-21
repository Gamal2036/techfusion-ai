'use client';

import { useState, useEffect, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getAuthHeaders(): Record<string, string> {
  let token: string | null = null;
  try {
    token = typeof localStorage !== 'undefined' ? localStorage.getItem('accessToken') : null;
  } catch {
    token = null;
  }
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

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
  lastSeenAt: string;
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

export function useDeviceList() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDevices = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/devices`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setDevices(data);
      }
    } catch (e) {
      console.error('Failed to fetch devices:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 15000);
    return () => clearInterval(interval);
  }, [fetchDevices]);

  return { devices, loading, refetch: fetchDevices };
}

export function useDevice(id: string | undefined) {
  const [device, setDevice] = useState<Device | null>(null);
  const [metrics, setMetrics] = useState<DeviceMetric[]>([]);
  const [scores, setScores] = useState<DeviceScore | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDevice = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`${API_URL}/devices/${id}/latest`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setDevice(data.device);
        setScores(data.scores);
      }
    } catch (e) {
      console.error('Failed to fetch device:', e);
    }
  }, [id]);

  const fetchMetrics = useCallback(async (minutes = 60) => {
    if (!id) return;
    try {
      const res = await fetch(`${API_URL}/devices/${id}/metrics?minutes=${minutes}&limit=200`, {
        headers: getAuthHeaders(),
      });
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
      const next = [...prev, metric];
      if (next.length > 200) next.splice(0, next.length - 200);
      return next;
    });
    setScores(score);
  }, []);

  return { device, metrics, scores, loading, refetch: fetchDevice, refetchMetrics: fetchMetrics, addLiveMetric };
}
