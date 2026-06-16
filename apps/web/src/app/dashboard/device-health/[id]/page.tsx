'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  GlassPanel,
  Badge,
  ScorePill,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@techfusion/ui';
import {
  ArrowLeft,
  Monitor,
  Cpu,
  HardDrive,
  Activity,
  Thermometer,
  Clock,
  Wifi,
  Zap,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { ScoreGauge } from '@/components/ScoreGauge';
import { useDevice } from '@/hooks/useDevices';
import { useWebSocket } from '@/hooks/useWebSocket';

export default function DeviceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { device, metrics, scores, loading, addLiveMetric } = useDevice(id);
  const [orgId, setOrgId] = useState<string | undefined>();
  const [timeRange, setTimeRange] = useState(60);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setOrgId(payload.orgId);
    } catch {}
  }, []);

  const onMetrics = useCallback(
    (data: any) => {
      if (data.deviceId === id && data.metric && data.score) {
        addLiveMetric(data.metric, data.score);
      }
    },
    [id, addLiveMetric],
  );

  useWebSocket(orgId, onMetrics);

  if (loading && !device) {
    return (
      <div className="flex items-center justify-center h-64">
        <Activity className="h-6 w-6 text-white/30 animate-pulse" />
        <span className="ml-3 text-sm text-white/30">Loading device data...</span>
      </div>
    );
  }

  if (!device) {
    return (
      <GlassPanel intensity="light" className="p-12 text-center">
        <Monitor className="h-12 w-12 text-white/20 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-white/50">Device not found</h3>
        <Link href="/dashboard/device-health" className="text-sm text-primary-400 hover:underline mt-2 inline-block">
          Back to Device Health Center
        </Link>
      </GlassPanel>
    );
  }

  const lastSeen = new Date(device.lastSeenAt);
  const isOnline = Date.now() - lastSeen.getTime() < 120_000;

  const chartData = metrics.map((m) => ({
    time: new Date(m.recordedAt).toLocaleTimeString(),
    cpu: Math.round(m.cpuUsage * 10) / 10,
    ram: Math.round(m.ramPercent * 10) / 10,
    temp: m.tempCpu ? Math.round(m.tempCpu * 10) / 10 : null,
  }));

  const cpuAvg =
    metrics.length > 0
      ? Math.round((metrics.reduce((s, m) => s + m.cpuUsage, 0) / metrics.length) * 10) / 10
      : 0;
  const ramAvg =
    metrics.length > 0
      ? Math.round((metrics.reduce((s, m) => s + m.ramPercent, 0) / metrics.length) * 10) / 10
      : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/device-health"
          className="h-8 w-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-white tracking-tight">{device.name}</h1>
            <Badge variant={isOnline ? 'success' : 'secondary'}>
              {isOnline ? 'Online' : 'Offline'}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-white/30">
            {device.hostname && (
              <span className="flex items-center gap-1">
                <Wifi className="h-3 w-3" />
                {device.hostname}
              </span>
            )}
            {device.os && <span>{device.os} {device.osVersion}</span>}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last seen: {lastSeen.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Score Gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GlassPanel intensity="light" className="p-6 flex justify-center">
          <ScoreGauge value={scores?.healthScore ?? 0} variant="health" size="lg" />
        </GlassPanel>
        <GlassPanel intensity="light" className="p-6 flex justify-center">
          <ScoreGauge value={scores?.performanceScore ?? 0} variant="performance" size="lg" />
        </GlassPanel>
        <GlassPanel intensity="light" className="p-6 flex justify-center">
          <ScoreGauge value={scores?.riskScore ?? 0} variant="risk" size="lg" />
        </GlassPanel>
      </div>

      {/* Score Pills */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ScorePill label="Device Health" value={scores?.healthScore ?? 0} variant="health" />
        <ScorePill label="Performance" value={scores?.performanceScore ?? 0} variant="health" />
        <ScorePill label="Risk Assessment" value={scores?.riskScore ?? 0} variant="risk" />
      </div>

      {/* CPU / RAM / Temp Chart */}
      <GlassPanel intensity="light" className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-white">Metrics History</h3>
          <div className="flex gap-1">
            {[15, 30, 60, 120].map((m) => (
              <button
                key={m}
                onClick={() => setTimeRange(m)}
                className={`px-2.5 py-1 rounded-lg text-xs transition-all ${
                  timeRange === m
                    ? 'bg-primary-600/20 text-primary-400'
                    : 'text-white/40 hover:text-white/60 hover:bg-white/[0.04]'
                }`}
              >
                {m}m
              </button>
            ))}
          </div>
        </div>
        {chartData.length > 0 ? (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ramGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="time"
                  tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 100]}
                />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(10,10,10,0.95)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area
                  type="monotone"
                  dataKey="cpu"
                  stroke="#3b82f6"
                  fill="url(#cpuGrad)"
                  strokeWidth={2}
                  dot={false}
                  name="CPU %"
                />
                <Area
                  type="monotone"
                  dataKey="ram"
                  stroke="#22d3ee"
                  fill="url(#ramGrad)"
                  strokeWidth={2}
                  dot={false}
                  name="RAM %"
                />
                {chartData.some((d) => d.temp != null) && (
                  <Area
                    type="monotone"
                    dataKey="temp"
                    stroke="#ef4444"
                    fill="url(#tempGrad)"
                    strokeWidth={2}
                    dot={false}
                    name="Temp °C"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-white/30 text-sm">
            No metrics data available yet. Waiting for agent to report...
          </div>
        )}
      </GlassPanel>

      {/* System Info */}
      <GlassPanel intensity="light" className="p-5">
        <h3 className="text-sm font-medium text-white mb-4">System Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: 'CPU', value: device.cpuModel || 'N/A', icon: Cpu },
            { label: 'Cores', value: device.cpuCores ? `${device.cpuCores} (${device.cpuLogical || ''} logical)` : 'N/A', icon: Cpu },
            { label: 'RAM', value: device.ramTotal ? `${(Number(device.ramTotal) / 1073741824).toFixed(1)} GB` : 'N/A', icon: HardDrive },
            { label: 'OS', value: device.os || 'N/A', icon: Monitor },
            { label: 'Hostname', value: device.hostname || 'N/A', icon: Wifi },
            { label: 'Registered', value: new Date(device.registeredAt).toLocaleDateString(), icon: Clock },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex items-start gap-3 rounded-xl border border-white/[0.04] bg-white/[0.02] p-3">
                <Icon className="h-4 w-4 text-white/30 mt-0.5" />
                <div>
                  <p className="text-xs text-white/30">{item.label}</p>
                  <p className="text-sm text-white/70 mt-0.5">{item.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      </GlassPanel>
    </div>
  );
}
