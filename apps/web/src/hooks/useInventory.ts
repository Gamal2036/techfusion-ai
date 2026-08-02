'use client';

import { useState, useCallback, useEffect } from 'react';
import { apiFetch } from '@/lib/auth-client';

export interface DriverEntry {
  id: string;
  deviceId: string | null;
  name: string;
  vendor: string | null;
  version: string | null;
  modulePath: string | null;
  usedBy: string | null;
  source: string;
  status: string;
  lastSeenAt: string;
}

export interface SoftwareEntry {
  id: string;
  deviceId: string | null;
  name: string;
  version: string | null;
  vendor: string | null;
  installDate: string | null;
  description: string | null;
  source: string;
  status: string;
  lastSeenAt: string;
}

export interface InventoryDevice {
  id: string;
  hostname: string;
  os: string | null;
  lastSeenAt: string;
}

export function useDrivers() {
  const [drivers, setDrivers] = useState<DriverEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const fetchDrivers = useCallback(async (status?: string) => {
    try {
      const params = status ? `?status=${status}` : '';
      const res = await apiFetch(`/inventory/drivers${params}`);
      if (res.ok) {
        const data = await res.json();
        setDrivers(data);
        if (data.length > 0) setLastSync(new Date());
      }
    } catch (e) {
      console.error('Failed to fetch drivers:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDrivers(); }, [fetchDrivers]);

  return { drivers, loading, lastSync, refetch: fetchDrivers };
}

export function useSoftware() {
  const [software, setSoftware] = useState<SoftwareEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const fetchSoftware = useCallback(async (source?: string) => {
    try {
      const params = source ? `?source=${source}` : '';
      const res = await apiFetch(`/inventory/software${params}`);
      if (res.ok) {
        const data = await res.json();
        setSoftware(data);
        if (data.length > 0) setLastSync(new Date());
      }
    } catch (e) {
      console.error('Failed to fetch software:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSoftware(); }, [fetchSoftware]);

  return { software, loading, lastSync, refetch: fetchSoftware };
}

export function useInventoryRefresh() {
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const refresh = useCallback(async (deviceId?: string) => {
    setRefreshing(true);
    try {
      const res = await apiFetch('/inventory/refresh', {
        method: 'POST',
        body: JSON.stringify({ deviceId }),
      });
      if (res.ok) {
        setLastRefresh(new Date());
        return await res.json();
      }
      return null;
    } catch (e) {
      console.error('Failed to refresh inventory:', e);
      return null;
    } finally {
      setRefreshing(false);
    }
  }, []);

  return { refresh, refreshing, lastRefresh };
}
