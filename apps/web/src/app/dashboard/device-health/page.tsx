'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { cn, GlassPanel, Badge, SearchInput, EmptyState } from '@techfusion/ui';
import { Activity, Monitor, Cpu, Wifi, Clock } from 'lucide-react';
import { useDeviceList } from '@/hooks/useDevices';
import { useWebSocket } from '@/hooks/useWebSocket';
import { apiFetch } from '@/lib/auth-client';
import { formatDeviceLastSeen } from '@/lib/device-presence';
import {
  derivePresenceState,
  PRESENCE_BADGE_VARIANT,
  PRESENCE_STATE_LABELS,
  type PresenceState,
} from '@/lib/device-presence-state';

interface ScoreData {
  healthScore: number;
  performanceScore: number;
  riskScore: number;
}

export default function DeviceHealthPage() {
  const router = useRouter();
  const { devices, loading, refetch } = useDeviceList();
  const [scores, setScores] = useState<Record<string, ScoreData>>({});
  const [lastSeenUpdates, setLastSeenUpdates] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [presenceTick, setPresenceTick] = useState(0);

  useEffect(() => {
    const devicesNeedingScores = devices.filter((d) => !scores[d.id]);
    if (devicesNeedingScores.length === 0) return;

    Promise.allSettled(
      devicesNeedingScores.map(async (device) => {
        const res = await apiFetch(`/devices/${device.id}/scores`);
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
      })
    );
  }, [devices]);

  useEffect(() => {
    const interval = setInterval(() => {
      setPresenceTick((t) => t + 1);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

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
      if (data.lastSeenAt) {
        setLastSeenUpdates((prev) => ({
          ...prev,
          [data.deviceId]: data.lastSeenAt,
        }));
      }
    },
    [],
  );

  useWebSocket(onMetrics);

  const getEffectiveLastSeen = useCallback(
    (device: { id: string; lastSeenAt: string }) => {
      return lastSeenUpdates[device.id] || device.lastSeenAt;
    },
    [lastSeenUpdates],
  );

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
          <h1 className="text-2xl font-semibold text-text-primary tracking-tight">Device Health Center</h1>
          <p className="text-sm text-text-muted mt-1">
            {devices.length} device{devices.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        <div className="relative">
          <SearchInput
            placeholder="Search devices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            inputSize="md"
          />
        </div>
      </div>

      {loading && devices.length === 0 ? (
        <GlassPanel intensity="light" className="p-12 flex items-center justify-center">
          <div className="flex items-center gap-3 text-text-disabled">
            <Activity className="h-5 w-5 animate-pulse" />
            <span className="text-sm">Loading devices...</span>
          </div>
        </GlassPanel>
      ) : filtered.length === 0 ? (
        <GlassPanel intensity="light" className="p-12 text-center">
          <EmptyState
            icon={<Monitor className="h-12 w-12" />}
            title={devices.length === 0 ? 'No devices registered' : 'No devices match your search'}
            description={
              devices.length === 0
                ? 'Install the TechFusion agent on a device to get started.'
                : 'Try a different search term.'
            }
            compact
          />
        </GlassPanel>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map((device) => {
            const s = scores[device.id];
            const effectiveLastSeen = getEffectiveLastSeen(device);
            const presence: PresenceState = derivePresenceState(effectiveLastSeen);

            return (
              <button
                key={device.id}
                onClick={() => router.push(`/dashboard/device-health/${device.id}`)}
                className="w-full text-left"
              >
                <GlassPanel
                  intensity="light"
                  className="p-5 hover:bg-surface-muted transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-surface-subtle border border-border flex items-center justify-center shrink-0">
                        <Monitor className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-medium text-text-primary truncate">{device.name}</h3>
                          <Badge
                            variant={PRESENCE_BADGE_VARIANT[presence]}
                            className="text-[10px] shrink-0"
                          >
                            {PRESENCE_STATE_LABELS[presence]}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
                          {device.hostname && (
                            <span className="text-xs text-text-disabled flex items-center gap-1">
                              <Wifi className="h-3 w-3" />
                              {device.hostname}
                            </span>
                          )}
                          {device.cpuModel && (
                            <span className="text-xs text-text-disabled flex items-center gap-1">
                              <Cpu className="h-3 w-3" />
                              {device.cpuModel.split(' ').slice(0, 2).join(' ')}
                            </span>
                          )}
                          <span className="text-xs text-text-disabled flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDeviceLastSeen(effectiveLastSeen)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {s && (
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-center">
                          <div className="text-lg font-bold text-success">{s.healthScore}</div>
                          <div className="text-[10px] text-text-disabled uppercase tracking-wider">Health</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-primary">{s.performanceScore}</div>
                          <div className="text-[10px] text-text-disabled uppercase tracking-wider">Perf</div>
                        </div>
                        <div className="text-center">
                          <div className={cn(
                            'text-lg font-bold',
                            s.riskScore <= 20 ? 'text-success' :
                            s.riskScore <= 50 ? 'text-warning' : 'text-danger'
                          )}>
                            {s.riskScore}
                          </div>
                          <div className="text-[10px] text-text-disabled uppercase tracking-wider">Risk</div>
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
