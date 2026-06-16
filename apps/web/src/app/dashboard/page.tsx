'use client';

import { Card, GlassPanel, CardHeader, CardTitle, CardContent, ScorePill, Badge } from '@techfusion/ui';
import {
  Activity,
  Monitor,
  AlertTriangle,
  Shield,
  Network,
  HardDrive,
  TrendingUp,
  Users,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

const stats = [
  {
    label: 'Total Devices',
    value: '156',
    change: '+12',
    trend: 'up',
    icon: Monitor,
    color: 'text-primary-400',
  },
  {
    label: 'Active Agents',
    value: '142',
    change: '+8',
    trend: 'up',
    icon: Activity,
    color: 'text-green-400',
  },
  {
    label: 'Active Alerts',
    value: '23',
    change: '-5',
    trend: 'down',
    icon: AlertTriangle,
    color: 'text-amber-400',
  },
  {
    label: 'Team Members',
    value: '18',
    change: '+2',
    trend: 'up',
    icon: Users,
    color: 'text-accent-400',
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-white tracking-tight">Fleet Overview</h1>
        <p className="text-sm text-white/40 mt-1">Real-time status of your managed devices and infrastructure.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <GlassPanel key={stat.label} intensity="light" className="p-5">
              <div className="flex items-start justify-between">
                <div className="h-10 w-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <Badge variant={stat.trend === 'up' ? 'success' : 'warning'} className="text-[10px]">
                  {stat.change}
                  {stat.trend === 'up' ? (
                    <ArrowUpRight className="h-3 w-3 ml-0.5" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 ml-0.5" />
                  )}
                </Badge>
              </div>
              <div className="mt-4">
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-xs text-white/40 mt-0.5">{stat.label}</p>
              </div>
            </GlassPanel>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassPanel intensity="light" className="p-5">
          <h3 className="text-sm font-medium text-white mb-4">Device Fleet Scores</h3>
          <div className="space-y-3">
            <ScorePill label="Device Health" value={87} variant="health" />
            <ScorePill label="Risk Assessment" value={23} variant="risk" />
            <ScorePill label="Security Posture" value={76} variant="security" />
          </div>
        </GlassPanel>

        <GlassPanel intensity="light" className="p-5">
          <h3 className="text-sm font-medium text-white mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Run Health Check', icon: Activity, desc: 'Scan all devices' },
              { label: 'View Alerts', icon: AlertTriangle, desc: '23 unresolved' },
              { label: 'Network Map', icon: Network, desc: 'Topology view' },
              { label: 'Backup Status', icon: HardDrive, desc: 'Last: 2h ago' },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  className="flex flex-col items-start gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 text-left hover:bg-white/[0.04] transition-all"
                >
                  <Icon className="h-4 w-4 text-primary-400" />
                  <span className="text-sm font-medium text-white/80">{action.label}</span>
                  <span className="text-xs text-white/30">{action.desc}</span>
                </button>
              );
            })}
          </div>
        </GlassPanel>
      </div>

      <GlassPanel intensity="light" className="p-5">
        <h3 className="text-sm font-medium text-white mb-4">Recently Active Devices</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left">
                <th className="pb-3 text-xs font-medium text-white/40 uppercase tracking-wider">Device</th>
                <th className="pb-3 text-xs font-medium text-white/40 uppercase tracking-wider">Status</th>
                <th className="pb-3 text-xs font-medium text-white/40 uppercase tracking-wider">Health</th>
                <th className="pb-3 text-xs font-medium text-white/40 uppercase tracking-wider">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'ws-001.example.com', status: 'Online', health: 94, lastSeen: '2 min ago' },
                { name: 'db-02.example.com', status: 'Online', health: 88, lastSeen: '5 min ago' },
                { name: 'gw-prod-01', status: 'Warning', health: 65, lastSeen: '12 min ago' },
                { name: 'dev-wk-42', status: 'Offline', health: 0, lastSeen: '3h ago' },
                { name: 'cache-01.example.com', status: 'Online', health: 97, lastSeen: '1 min ago' },
              ].map((device) => (
                <tr key={device.name} className="border-b border-white/[0.03]">
                  <td className="py-3 text-white/80 font-mono text-xs">{device.name}</td>
                  <td className="py-3">
                    <Badge
                      variant={
                        device.status === 'Online' ? 'success' :
                        device.status === 'Warning' ? 'warning' : 'destructive'
                      }
                      className="text-[10px]"
                    >
                      {device.status}
                    </Badge>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            device.health >= 80 ? 'bg-green-500' :
                            device.health >= 50 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${device.health}%` }}
                        />
                      </div>
                      <span className="text-xs text-white/50">{device.health}%</span>
                    </div>
                  </td>
                  <td className="py-3 text-xs text-white/40">{device.lastSeen}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassPanel>
    </div>
  );
}
