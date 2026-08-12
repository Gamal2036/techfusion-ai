'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { apiFetch } from '@/lib/auth-client';
import { subscribe } from '@/lib/socket-client';

export interface NetworkDevice {
  id: string;
  orgId: string;
  ip: string;
  mac: string | null;
  hostname: string | null;
  vendor: string | null;
  interface: string | null;
  source: string;
  reachable: boolean;
  latencyMs: number | null;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface TopologyNode {
  id: string;
  label: string;
  ip: string;
  mac: string | null;
  vendor: string | null;
  hostname: string | null;
  reachable: boolean;
  latencyMs: number | null;
  isGateway: boolean;
  isLocal: boolean;
}

export interface TopologyLink {
  source: string;
  target: string;
  type: string;
}

export interface TopologyData {
  nodes: TopologyNode[];
  links: TopologyLink[];
  scan: {
    id: string;
    subnet: string | null;
    gatewayIp: string | null;
    localIp: string | null;
    deviceCount: number;
    scanDurationMs: number | null;
    startedAt: string;
  } | null;
}

export interface LatencyResult {
  targetIp: string;
  results: { seq: number; latencyMs: number | null; error?: string }[];
  avg: number | null;
  min: number | null;
  max: number | null;
  packetLoss: number;
  count: number;
  timestamp: string;
}

export interface DnsResult {
  hostname: string;
  results: { resolver: string; addresses: string[]; timeMs: number; error?: string }[];
  timestamp: string;
}

export interface TracerouteResult {
  target: string;
  hops: { hop: number; ip: string; latencyMs: number | null }[];
  timestamp: string;
}

export interface ConnectivityResult {
  results: { name: string; reachable: boolean; latencyMs: number | null; error?: string }[];
  timestamp: string;
}

export function useNetworkDevices() {
  const [devices, setDevices] = useState<NetworkDevice[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDevices = useCallback(async () => {
    try {
      const res = await apiFetch('/network/devices');
      if (res.ok) {
        setDevices(await res.json());
      }
    } catch (e) {
      console.error('Failed to fetch network devices:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 30000);
    return () => clearInterval(interval);
  }, [fetchDevices]);

  return { devices, loading, refetch: fetchDevices };
}

export function useNetworkTopology() {
  const [topology, setTopology] = useState<TopologyData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTopology = useCallback(async () => {
    try {
      const res = await apiFetch('/network/topology');
      if (res.ok) {
        setTopology(await res.json());
      }
    } catch (e) {
      console.error('Failed to fetch topology:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTopology();
    const interval = setInterval(fetchTopology, 30000);
    return () => clearInterval(interval);
  }, [fetchTopology]);

  return { topology, loading, refetch: fetchTopology };
}

export function useNetworkScans() {
  const [scans, setScans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchScans = useCallback(async () => {
    try {
      const res = await apiFetch('/network/scans?limit=10');
      if (res.ok) {
        setScans(await res.json());
      }
    } catch (e) {
      console.error('Failed to fetch network scans:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScans();
  }, [fetchScans]);

  return { scans, loading, refetch: fetchScans };
}

export type DiscoveryState =
  | 'idle'
  | 'triggering'
  | 'running'
  | 'completed'
  | 'failed'
  | 'timeout';

export const NETWORK_POLL_INTERVAL_MS = 5000;
export const NETWORK_SCAN_TIMEOUT_MS = 90000;

/**
 * NET-01A: the Web discovery flow must NEVER touch the agent-only,
 * DeviceTokenGuard-protected routes (/network/discovery/pending|status|result).
 * Triggering uses the user JWT + RBAC POST /network/discovery/trigger, and the
 * scan status is read exclusively through the user JWT read path
 * GET /network/scans. Polling stops on a terminal state (completed/failed) or
 * on the timeout backstop — never infinite loading.
 */
export function useStartDiscovery() {
  const [state, setState] = useState<DiscoveryState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [scanId, setScanId] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const pollDeadlineRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    pollDeadlineRef.current = 0;
  }, []);

  const checkStatus = useCallback(
    async (activeId: string) => {
      let res: Response;
      try {
        res = await apiFetch('/network/scans?limit=50');
      } catch {
        if (pollDeadlineRef.current === 0) return;
        stopPolling();
        setState('failed');
        setError('Could not reach the network service. Please try again.');
        return;
      }
      // Polling may have reached a terminal state (completed/failed/timeout)
      // while this request was in flight; a stale status write must never
      // overwrite the terminal state.
      if (pollDeadlineRef.current === 0) return;

      if (res.status === 401 || res.status === 403) {
        stopPolling();
        setState('failed');
        setError(
          'Network data access was denied (401/403). Please refresh your session and try again.',
        );
        return;
      }
      if (!res.ok) {
        stopPolling();
        setState('failed');
        setError(`Could not verify the discovery status (HTTP ${res.status}). Please try again.`);
        return;
      }
      let scans: any[];
      try {
        scans = await res.json();
      } catch {
        if (pollDeadlineRef.current === 0) return;
        stopPolling();
        setState('failed');
        setError('Could not verify the discovery status. Please try again.');
        return;
      }
      if (pollDeadlineRef.current === 0) return;

      const active = Array.isArray(scans) ? scans.find((s: any) => s.id === activeId) : null;
      if (active) {
        setScanStatus(active.status);
        if (active.status === 'completed' || active.status === 'failed') {
          stopPolling();
          setState(active.status);
          if (active.status === 'failed' && active.error) {
            setError(active.error);
          }
          return;
        }
      }
      setState('running');
    },
    [stopPolling],
  );

  const startPolling = useCallback(
    (activeId: string) => {
      if (pollingRef.current) return;
      pollDeadlineRef.current = Date.now() + NETWORK_SCAN_TIMEOUT_MS;
      pollingRef.current = setInterval(() => {
        if (Date.now() >= pollDeadlineRef.current) {
          stopPolling();
          setState('timeout');
          setError(
            'Discovery timed out — no agent completed the scan in time. Verify the agent is online and network discovery is enabled, then try again.',
          );
          return;
        }
        checkStatus(activeId);
      }, NETWORK_POLL_INTERVAL_MS);
    },
    [checkStatus, stopPolling],
  );

  const startDiscovery = useCallback(
    async (deviceId?: string) => {
      if (state === 'triggering' || state === 'running') return null;
      setError(null);
      setScanStatus(null);
      setState('triggering');
      try {
        const res = await apiFetch('/network/discovery/trigger', {
          method: 'POST',
          body: JSON.stringify({ deviceId }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.scanId) {
            setScanId(data.scanId);
            setState('running');
            startPolling(data.scanId);
            return data;
          }
          setState('failed');
          setError('Discovery was accepted but returned no scan id. Please try again.');
          return null;
        }
        if (res.status === 401 || res.status === 403) {
          setState('failed');
          setError(
            'Access to network discovery was denied (401/403). Please refresh your session and try again.',
          );
        } else {
          setState('failed');
          setError(`Could not start the discovery scan (HTTP ${res.status}). Please try again.`);
        }
        return null;
      } catch {
        setState('failed');
        setError('Network error starting the discovery scan. Please try again.');
        return null;
      }
    },
    [state, startPolling],
  );

  const resetDiscovery = useCallback(() => {
    stopPolling();
    setState('idle');
    setError(null);
    setScanId(null);
    setScanStatus(null);
  }, [stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  return {
    state,
    error,
    scanId,
    scanStatus,
    starting: state === 'triggering',
    discoveryPolling: state === 'triggering' || state === 'running',
    startDiscovery,
    resetDiscovery,
  };
}

export function useLatencyCheck() {
  const [result, setResult] = useState<LatencyResult | null>(null);
  const [running, setRunning] = useState(false);

  const run = useCallback(async (targetIp: string, count = 4) => {
    setRunning(true);
    try {
      const res = await apiFetch('/network/diagnostics/latency', {
        method: 'POST',
        body: JSON.stringify({ targetIp, count }),
      });
      if (res.ok) {
        setResult(await res.json());
      }
    } catch (e) {
      console.error('Latency check failed:', e);
    } finally {
      setRunning(false);
    }
  }, []);

  return { result, running, run };
}

export function useDnsResolution() {
  const [result, setResult] = useState<DnsResult | null>(null);
  const [running, setRunning] = useState(false);

  const run = useCallback(async (hostname: string, resolvers?: string[]) => {
    setRunning(true);
    try {
      const res = await apiFetch('/network/diagnostics/dns', {
        method: 'POST',
        body: JSON.stringify({ hostname, resolvers }),
      });
      if (res.ok) {
        setResult(await res.json());
      }
    } catch (e) {
      console.error('DNS resolution failed:', e);
    } finally {
      setRunning(false);
    }
  }, []);

  return { result, running, run };
}

export function useTraceroute() {
  const [result, setResult] = useState<TracerouteResult | null>(null);
  const [running, setRunning] = useState(false);

  const run = useCallback(async (target: string) => {
    setRunning(true);
    try {
      const res = await apiFetch('/network/diagnostics/traceroute', {
        method: 'POST',
        body: JSON.stringify({ target }),
      });
      if (res.ok) {
        setResult(await res.json());
      }
    } catch (e) {
      console.error('Traceroute failed:', e);
    } finally {
      setRunning(false);
    }
  }, []);

  return { result, running, run };
}

export function useConnectivityCheck() {
  const [result, setResult] = useState<ConnectivityResult | null>(null);
  const [running, setRunning] = useState(false);

  const run = useCallback(async () => {
    setRunning(true);
    try {
      const res = await apiFetch('/network/diagnostics/connectivity', {
        method: 'POST',
      });
      if (res.ok) {
        setResult(await res.json());
      }
    } catch (e) {
      console.error('Connectivity check failed:', e);
    } finally {
      setRunning(false);
    }
  }, []);

  return { result, running, run };
}

export function useNetworkWebSocket(callbacks: {
  onTopology?: (topology: TopologyData) => void;
  onDiagnostics?: (data: any) => void;
  onScanStatus?: (scan: any) => void;
}) {
  const topologyRef = useRef(callbacks.onTopology);
  topologyRef.current = callbacks.onTopology;
  const diagnosticsRef = useRef(callbacks.onDiagnostics);
  diagnosticsRef.current = callbacks.onDiagnostics;
  const scanStatusRef = useRef(callbacks.onScanStatus);
  scanStatusRef.current = callbacks.onScanStatus;

  useEffect(() => {
    const cleanups: (() => void)[] = [];

    if (topologyRef.current) {
      cleanups.push(
        subscribe('/network', 'topology', (topology: TopologyData) => {
          topologyRef.current?.(topology);
        }),
      );
    }

    if (diagnosticsRef.current) {
      cleanups.push(
        subscribe('/network', 'diagnostics', (data: any) => {
          diagnosticsRef.current?.(data);
        }),
      );
    }

    if (scanStatusRef.current) {
      cleanups.push(
        subscribe('/network', 'scan-status', (scan: any) => {
          scanStatusRef.current?.(scan);
        }),
      );
    }

    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, []);
}
