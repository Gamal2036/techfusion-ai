'use client';

import { useState, useMemo } from 'react';
import { cn, GlassPanel, Badge, StatCard, SearchInput, EmptyState } from '@techfusion/ui';
import { Cpu, Package, AlertTriangle, CheckCircle, HelpCircle, Activity, RefreshCw, Clock, Monitor } from 'lucide-react';
import { useDrivers, useSoftware, useInventoryRefresh } from '@/hooks/useInventory';

type Tab = 'drivers' | 'software';

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

  const { drivers, loading: driversLoading, lastSync: driversLastSync } = useDrivers();
  const { software, loading: softwareLoading, lastSync: softwareLastSync } = useSoftware();
  const { refresh, refreshing, lastRefresh } = useInventoryRefresh();

  const tabStyle = (t: Tab) =>
    cn(
      'px-4 py-2 rounded-lg text-sm font-medium transition-all',
      activeTab === t ? 'bg-primary-600/15 text-primary' : 'text-text-muted hover:text-text-secondary hover:bg-surface-subtle',
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

  const driverStatusCounts = useMemo(() => ({
    all: drivers.length,
    current: drivers.filter((d) => d.status === 'current').length,
    outdated: drivers.filter((d) => d.status === 'outdated').length,
    missing: drivers.filter((d) => d.status === 'missing').length,
    unknown: drivers.filter((d) => d.status === 'unknown').length,
  }), [drivers]);

  const lastSyncTime = activeTab === 'drivers' ? driversLastSync : softwareLastSync;

  const handleRefresh = async () => {
    await refresh();
    if (activeTab === 'drivers') {
      drivers && drivers.length > 0 && undefined;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary tracking-tight">Driver &amp; Software Center</h1>
          <p className="text-sm text-text-muted mt-1">Inventory tracking, version management, and catalog cross-referencing.</p>
        </div>
        <div className="flex items-center gap-3">
          {lastSyncTime && (
            <div className="flex items-center gap-1.5 text-xs text-text-disabled">
              <Clock className="h-3.5 w-3.5" />
              Last sync: {lastSyncTime.toLocaleTimeString()}
            </div>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-9 px-3 rounded-xl border border-border text-text-secondary hover:text-text-primary hover:bg-surface-subtle disabled:opacity-40 text-xs font-medium transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            {refreshing ? 'Refreshing...' : 'Refresh Inventory'}
          </button>
        </div>
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
            <StatCard title="Total" value={driverStatusCounts.all} icon={<Cpu className="h-5 w-5" />} compact />
            <StatCard title="Current" value={driverStatusCounts.current} icon={<CheckCircle className="h-5 w-5" />} tone="success" compact />
            <StatCard title="Outdated" value={driverStatusCounts.outdated} icon={<AlertTriangle className="h-5 w-5" />} tone="warning" compact />
            <StatCard title="Missing" value={driverStatusCounts.missing} icon={<HelpCircle className="h-5 w-5" />} tone="danger" compact />
            <StatCard title="Unknown" value={driverStatusCounts.unknown} icon={<Activity className="h-5 w-5" />} tone="info" compact />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <SearchInput
                placeholder="Search drivers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                fullWidth
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-xl border border-border bg-surface-subtle px-3 text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary-500/40"
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
              <Activity className="h-6 w-6 text-text-disabled mx-auto animate-pulse" />
              <p className="text-sm text-text-disabled mt-2">Loading drivers...</p>
            </GlassPanel>
          ) : filteredDrivers.length === 0 ? (
            <EmptyState
              icon={<Cpu className="h-8 w-8" />}
              title="No drivers found"
              description={drivers.length === 0 ? "No driver inventory has been collected yet. Click 'Refresh Inventory' or wait for the agent's periodic sync." : "No drivers match your current filters."}
              compact
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface">
                    <th className="text-left px-4 py-3 text-xs text-text-disabled font-medium uppercase tracking-wider">Driver</th>
                    <th className="text-left px-4 py-3 text-xs text-text-disabled font-medium uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs text-text-disabled font-medium uppercase tracking-wider">Version</th>
                    <th className="text-left px-4 py-3 text-xs text-text-disabled font-medium uppercase tracking-wider">Vendor</th>
                    <th className="text-left px-4 py-3 text-xs text-text-disabled font-medium uppercase tracking-wider">Source</th>
                    <th className="text-left px-4 py-3 text-xs text-text-disabled font-medium uppercase tracking-wider">Device</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDrivers.map((d) => {
                    const badge = STATUS_BADGE[d.status] || STATUS_BADGE.unknown;
                    return (
                      <tr key={d.id} className="border-b border-border-subtle hover:bg-surface transition-colors">
                        <td className="px-4 py-3">
                          <span className="text-text-primary font-medium">{d.name}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={badge.variant} className="text-[10px]">{badge.label}</Badge>
                        </td>
                        <td className="px-4 py-3 text-text-secondary font-mono text-xs">{d.version || '-'}</td>
                        <td className="px-4 py-3 text-text-secondary text-xs">{d.vendor || '-'}</td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className="text-[10px]">{d.source}</Badge>
                        </td>
                        <td className="px-4 py-3 text-text-muted text-xs font-mono">
                          {d.deviceId ? d.deviceId.slice(0, 8) + '...' : '-'}
                        </td>
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
          <SearchInput
            placeholder="Search software..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {softwareLoading ? (
            <GlassPanel intensity="light" className="p-12 text-center">
              <Activity className="h-6 w-6 text-text-disabled mx-auto animate-pulse" />
              <p className="text-sm text-text-disabled mt-2">Loading software...</p>
            </GlassPanel>
          ) : filteredSoftware.length === 0 ? (
            <EmptyState
              icon={<Package className="h-8 w-8" />}
              title="No software found"
              description={software.length === 0 ? "No software inventory has been collected yet. Click 'Refresh Inventory' or wait for the agent's periodic sync." : "No software matches your search."}
              compact
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface">
                    <th className="text-left px-4 py-3 text-xs text-text-disabled font-medium uppercase tracking-wider">Name</th>
                    <th className="text-left px-4 py-3 text-xs text-text-disabled font-medium uppercase tracking-wider">Version</th>
                    <th className="text-left px-4 py-3 text-xs text-text-disabled font-medium uppercase tracking-wider">Vendor</th>
                    <th className="text-left px-4 py-3 text-xs text-text-disabled font-medium uppercase tracking-wider">Source</th>
                    <th className="text-left px-4 py-3 text-xs text-text-disabled font-medium uppercase tracking-wider">Device</th>
                    <th className="text-left px-4 py-3 text-xs text-text-disabled font-medium uppercase tracking-wider">Installed</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSoftware.map((s) => (
                    <tr key={s.id} className="border-b border-border-subtle hover:bg-surface transition-colors">
                      <td className="px-4 py-3 text-text-primary font-medium">{s.name}</td>
                      <td className="px-4 py-3 text-text-secondary font-mono text-xs">{s.version || '-'}</td>
                      <td className="px-4 py-3 text-text-secondary text-xs">{s.vendor || '-'}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="text-[10px]">{s.source}</Badge>
                      </td>
                      <td className="px-4 py-3 text-text-muted text-xs font-mono">
                        {s.deviceId ? s.deviceId.slice(0, 8) + '...' : '-'}
                      </td>
                      <td className="px-4 py-3 text-text-muted text-xs">
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
