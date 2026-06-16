'use client';

import { useState } from 'react';
import { GlassPanel, Badge } from '@techfusion/ui';
import { Cpu, Package, Search, AlertTriangle, CheckCircle, HelpCircle, Activity } from 'lucide-react';
import { useDrivers, useSoftware } from '@/hooks/useInventory';

type Tab = 'drivers' | 'software';

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}

const STATUS_BADGE: Record<string, { variant: 'success' | 'warning' | 'secondary' | 'primary'; label: string }> = {
  current: { variant: 'success', label: 'Current' },
  outdated: { variant: 'warning', label: 'Outdated' },
  missing: { variant: 'secondary', label: 'Missing' },
  unknown: { variant: 'primary', label: 'Unknown' },
};

export default function DriversPage() {
  const [activeTab, setActiveTab] = useState<Tab>('drivers');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { drivers, loading: driversLoading } = useDrivers();
  const { software, loading: softwareLoading } = useSoftware();

  const tabStyle = (t: Tab) =>
    cn(
      'px-4 py-2 rounded-lg text-sm font-medium transition-all',
      activeTab === t ? 'bg-primary-600/15 text-primary-400' : 'text-white/40 hover:text-white/60 hover:bg-white/[0.04]',
    );

  const filteredDrivers = drivers.filter((d) => {
    if (statusFilter && d.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return d.name.toLowerCase().includes(q) || (d.vendor && d.vendor.toLowerCase().includes(q));
  });

  const filteredSoftware = software.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || (s.vendor && s.vendor.toLowerCase().includes(q));
  });

  const driverStatusCounts = {
    all: drivers.length,
    current: drivers.filter((d) => d.status === 'current').length,
    outdated: drivers.filter((d) => d.status === 'outdated').length,
    missing: drivers.filter((d) => d.status === 'missing').length,
    unknown: drivers.filter((d) => d.status === 'unknown').length,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-white tracking-tight">Driver &amp; Software Center</h1>
        <p className="text-sm text-white/40 mt-1">Inventory tracking, version management, and catalog cross-referencing.</p>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setActiveTab('drivers')} className={tabStyle('drivers')}>
          <Cpu className="h-4 w-4 inline mr-1.5" />
          Drivers ({driverStatusCounts.all})
        </button>
        <button onClick={() => setActiveTab('software')} className={tabStyle('software')}>
          <Package className="h-4 w-4 inline mr-1.5" />
          Software ({software.length})
        </button>
      </div>

      {activeTab === 'drivers' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatCard label="Total" value={driverStatusCounts.all} icon={Cpu} color="text-white" />
            <StatCard label="Current" value={driverStatusCounts.current} icon={CheckCircle} color="text-green-400" />
            <StatCard label="Outdated" value={driverStatusCounts.outdated} icon={AlertTriangle} color="text-amber-400" />
            <StatCard label="Missing" value={driverStatusCounts.missing} icon={HelpCircle} color="text-red-400" />
            <StatCard label="Unknown" value={driverStatusCounts.unknown} icon={Activity} color="text-primary-400" />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <input
                type="text"
                placeholder="Search drivers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 w-full rounded-xl border border-white/[0.06] bg-white/[0.03] pl-10 pr-4 text-sm text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-primary-500/40"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-white outline-none focus:ring-2 focus:ring-primary-500/40"
            >
              <option value="">All Status</option>
              <option value="current">Current</option>
              <option value="outdated">Outdated</option>
              <option value="missing">Missing</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>

          {driversLoading ? (
            <GlassPanel intensity="light" className="p-12 text-center">
              <Activity className="h-6 w-6 text-white/20 mx-auto animate-pulse" />
              <p className="text-sm text-white/30 mt-2">Loading drivers...</p>
            </GlassPanel>
          ) : filteredDrivers.length === 0 ? (
            <GlassPanel intensity="light" className="p-12 text-center">
              <Cpu className="h-8 w-8 text-white/20 mx-auto" />
              <p className="text-sm text-white/30 mt-2">No drivers found</p>
            </GlassPanel>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                    <th className="text-left px-4 py-3 text-xs text-white/30 font-medium uppercase tracking-wider">Driver</th>
                    <th className="text-left px-4 py-3 text-xs text-white/30 font-medium uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs text-white/30 font-medium uppercase tracking-wider">Version</th>
                    <th className="text-left px-4 py-3 text-xs text-white/30 font-medium uppercase tracking-wider">Vendor</th>
                    <th className="text-left px-4 py-3 text-xs text-white/30 font-medium uppercase tracking-wider">Source</th>
                    <th className="text-left px-4 py-3 text-xs text-white/30 font-medium uppercase tracking-wider">Module</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDrivers.map((d) => {
                    const badge = STATUS_BADGE[d.status] || STATUS_BADGE.unknown;
                    return (
                      <tr key={d.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <span className="text-white font-medium">{d.name}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={badge.variant} className="text-[10px]">{badge.label}</Badge>
                        </td>
                        <td className="px-4 py-3 text-white/70 font-mono text-xs">{d.version || '-'}</td>
                        <td className="px-4 py-3 text-white/50 text-xs">{d.vendor || '-'}</td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className="text-[10px]">{d.source}</Badge>
                        </td>
                        <td className="px-4 py-3 text-white/40 font-mono text-xs max-w-[200px] truncate">{d.modulePath || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'software' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <input
              type="text"
              placeholder="Search software..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full max-w-md rounded-xl border border-white/[0.06] bg-white/[0.03] pl-10 pr-4 text-sm text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-primary-500/40"
            />
          </div>

          {softwareLoading ? (
            <GlassPanel intensity="light" className="p-12 text-center">
              <Activity className="h-6 w-6 text-white/20 mx-auto animate-pulse" />
              <p className="text-sm text-white/30 mt-2">Loading software...</p>
            </GlassPanel>
          ) : filteredSoftware.length === 0 ? (
            <GlassPanel intensity="light" className="p-12 text-center">
              <Package className="h-8 w-8 text-white/20 mx-auto" />
              <p className="text-sm text-white/30 mt-2">No software found</p>
            </GlassPanel>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                    <th className="text-left px-4 py-3 text-xs text-white/30 font-medium uppercase tracking-wider">Name</th>
                    <th className="text-left px-4 py-3 text-xs text-white/30 font-medium uppercase tracking-wider">Version</th>
                    <th className="text-left px-4 py-3 text-xs text-white/30 font-medium uppercase tracking-wider">Vendor</th>
                    <th className="text-left px-4 py-3 text-xs text-white/30 font-medium uppercase tracking-wider">Source</th>
                    <th className="text-left px-4 py-3 text-xs text-white/30 font-medium uppercase tracking-wider">Installed</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSoftware.map((s) => (
                    <tr key={s.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-white font-medium">{s.name}</td>
                      <td className="px-4 py-3 text-white/70 font-mono text-xs">{s.version || '-'}</td>
                      <td className="px-4 py-3 text-white/50 text-xs">{s.vendor || '-'}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="text-[10px]">{s.source}</Badge>
                      </td>
                      <td className="px-4 py-3 text-white/40 text-xs">
                        {s.installDate ? new Date(s.installDate).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <GlassPanel intensity="light" className="p-3 flex items-center gap-3">
      <Icon className={`h-5 w-5 ${color}`} />
      <div>
        <p className={`text-lg font-bold ${color}`}>{value}</p>
        <p className="text-[10px] text-white/30">{label}</p>
      </div>
    </GlassPanel>
  );
}
