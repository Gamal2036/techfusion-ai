'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GlassPanel, Badge, ScorePill } from '@techfusion/ui';
import { Activity, Monitor, Cpu, HardDrive, Wifi, Clock, Search } from 'lucide-react';
import { useDeviceList } from '@/hooks/useDevices';
import { useWebSocket } from '@/hooks/useWebSocket';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getAuthHeaders() {
  const token = localStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

interface ScoreData {
  healthScore: number;
  performanceScore: number;
  riskScore: number;
}

export default function DeviceHealthPage() {
  const router = useRouter();
  const { devices, loading, refetch } = useDeviceList();
  const [scores, setScores] = useState<Record<string, ScoreData>>({});
  const [search, setSearch] = useState('');
  const [orgId, setOrgId] = useState<string | undefined>();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setOrgId(payload.orgId);
    } catch {}
  }, []);

  // Fetch scores for all devices
  useEffect(() => {
    devices.forEach(async (device) => {
      try {
        const res = await fetch(`${API_URL}/devices/${device.id}/scores`, {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          if (data) {
            setScores((prev) => ({
              ...prev,
              [device.id]: {
                healthScore: data.healthScore,
                performanceScore: data.performanceScore,
                riskScore: data.riskScore,
              },
            }));
          }
        }
      } catch {}
    });
  }, [devices]);

  const onMetrics = useCallback(
    (data: any) => {
      if (data.score) {
        setScores((prev) => ({
          ...prev,
          [data.deviceId]: {
            healthScore: data.score.healthScore,
            performanceScore: data.score.performanceScore,
            riskScore: data.score.riskScore,
          },
        }));
      }
      refetch();
    },
    [refetch],
  );

  useWebSocket(orgId, onMetrics);

  const filtered = devices.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      (d.hostname && d.hostname.toLowerCase().includes(search.toLowerCase())) ||
      (d.os && d.os.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Device Health Center</h1>
          <p className="text-sm text-white/40 mt-1">
            {devices.length} device{devices.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            type="text"
            placeholder="Search devices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-64 rounded-xl border border-white/[0.06] bg-white/[0.03] pl-10 pr-4 text-sm text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-primary-500/40 transition-all"
          />
        </div>
      </div>

      {loading && devices.length === 0 ? (
        <GlassPanel intensity="light" className="p-12 flex items-center justify-center">
          <div className="flex items-center gap-3 text-white/30">
            <Activity className="h-5 w-5 animate-pulse" />
            <span className="text-sm">Loading devices...</span>
          </div>
        </GlassPanel>
      ) : filtered.length === 0 ? (
        <GlassPanel intensity="light" className="p-12 text-center">
          <Monitor className="h-12 w-12 text-white/20 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white/50">
            {devices.length === 0 ? 'No devices registered' : 'No devices match your search'}
          </h3>
          <p className="text-sm text-white/30 mt-1">
            {devices.length === 0
              ? 'Install the TechFusion agent on a device to get started.'
              : 'Try a different search term.'}
          </p>
        </GlassPanel>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map((device) => {
            const s = scores[device.id];
            const lastSeen = new Date(device.lastSeenAt);
            const isOnline = Date.now() - lastSeen.getTime() < 120_000;

            return (
              <button
                key={device.id}
                onClick={() => router.push(`/dashboard/device-health/${device.id}`)}
                className="w-full text-left"
              >
                <GlassPanel
                  intensity="light"
                  className="p-5 hover:bg-white/[0.06] transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0">
                        <Monitor className="h-5 w-5 text-primary-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-medium text-white truncate">{device.name}</h3>
                          <Badge
                            variant={isOnline ? 'success' : 'secondary'}
                            className="text-[10px] shrink-0"
                          >
                            {isOnline ? 'Online' : 'Offline'}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
                          {device.hostname && (
                            <span className="text-xs text-white/30 flex items-center gap-1">
                              <Wifi className="h-3 w-3" />
                              {device.hostname}
                            </span>
                          )}
                          {device.cpuModel && (
                            <span className="text-xs text-white/30 flex items-center gap-1">
                              <Cpu className="h-3 w-3" />
                              {device.cpuModel.split(' ').slice(0, 2).join(' ')}
                            </span>
                          )}
                          <span className="text-xs text-white/30 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {lastSeen.toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {s && (
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-center">
                          <div className="text-lg font-bold text-green-400">{s.healthScore}</div>
                          <div className="text-[10px] text-white/30 uppercase tracking-wider">Health</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-primary-400">{s.performanceScore}</div>
                          <div className="text-[10px] text-white/30 uppercase tracking-wider">Perf</div>
                        </div>
                        <div className="text-center">
                          <div className={cn(
                            'text-lg font-bold',
                            s.riskScore <= 20 ? 'text-green-400' :
                            s.riskScore <= 50 ? 'text-amber-400' : 'text-red-400'
                          )}>
                            {s.riskScore}
                          </div>
                          <div className="text-[10px] text-white/30 uppercase tracking-wider">Risk</div>
                        </div>
                      </div>
                    )}
                  </div>
                </GlassPanel>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
