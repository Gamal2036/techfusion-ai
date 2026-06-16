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

export interface DriverEntry {
  id: string;
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
  name: string;
  version: string | null;
  vendor: string | null;
  installDate: string | null;
  description: string | null;
  source: string;
  status: string;
  lastSeenAt: string;
}

export function useDrivers() {
  const [drivers, setDrivers] = useState<DriverEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDrivers = useCallback(async (status?: string) => {
    try {
      const params = status ? `?status=${status}` : '';
      const res = await fetch(`${API_URL}/inventory/drivers${params}`, { headers: getAuthHeaders() });
      if (res.ok) setDrivers(await res.json());
    } catch (e) {
      console.error('Failed to fetch drivers:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDrivers(); }, [fetchDrivers]);

  return { drivers, loading, refetch: fetchDrivers };
}

export function useSoftware() {
  const [software, setSoftware] = useState<SoftwareEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSoftware = useCallback(async (source?: string) => {
    try {
      const params = source ? `?source=${source}` : '';
      const res = await fetch(`${API_URL}/inventory/software${params}`, { headers: getAuthHeaders() });
      if (res.ok) setSoftware(await res.json());
    } catch (e) {
      console.error('Failed to fetch software:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSoftware(); }, [fetchSoftware]);

  return { software, loading, refetch: fetchSoftware };
}
