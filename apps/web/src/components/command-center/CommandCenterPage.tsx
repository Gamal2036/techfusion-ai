'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  HardDrive,
  Monitor,
  Network,
  Users,
} from 'lucide-react';
import { GlassPanel, Skeleton, StatusBadge } from '@techfusion/ui';
import { useCommandCenterData } from '@/hooks/useCommandCenterData';
import { isDeviceOnline, formatDeviceLastSeen, metricAge } from '@/lib/device-presence';
import { Atmosphere } from '@/components/command-center/Atmosphere';
import { InfrastructurePlane } from '@/components/command-center/InfrastructurePlane';
import { CommandHorizon } from '@/components/command-center/CommandHorizon';
import { CommandHeader } from '@/components/command-center/CommandHeader';
import { SignalField } from '@/components/command-center/SignalField';
import { OperationalState } from '@/components/command-center/OperationalState';
import { FleetCountCard } from '@/components/command-center/FleetCountCard';
import { ModuleSlot } from '@/components/command-center/ModuleSlot';
import { OnboardingFlow } from '@/components/command-center/OnboardingFlow';
import './command-center.css';

function formatAsOf(generatedAt: string | null | undefined): string | null {
  if (!generatedAt) return null;
  const d = new Date(generatedAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function CommandCenterPage() {
  const router = useRouter();
  const {
    summary,
    summaryLoading,
    summaryError,
    refetchSummary,
    status,
    reasons,
    stale,
  } = useCommandCenterData();
  const [showOnboarding, setShowOnboarding] = useState(false);

  const alertsCount = summary?.alerts?.unacknowledged ?? null;
  const teamCount = summary?.team?.total ?? null;
  const deviceHealth = summary?.fleet?.deviceHealth ?? null;
  const worstRisk = summary?.security?.worstRiskLevel ?? null;
  const openFindingsTotal = summary?.security?.openFindings?.total ?? null;
  const coveragePercent = summary?.security?.scanCoverage?.coveragePercent ?? null;
  const lastScanAgeDays = summary?.security?.latestScanAgesDays ?? null;
  const backups = summary?.operations?.backups ?? null;
  const recentDevices = summary?.fleet?.recentDevices ?? [];
  const skeleton = summaryLoading;

  useEffect(() => {
    if (summary && !summaryLoading && !summaryError && summary.fleet.total === 0) {
      setShowOnboarding(true);
    }
  }, [summary, summaryLoading, summaryError]);

  const backupStatusText = (() => {
    if (!backups) return summaryLoading ? 'Loading…' : 'Status unavailable';
    if (backups.running > 0) return `${backups.running} running`;
    if (backups.pending > 0) return `${backups.pending} pending`;
    if (backups.failedLast24h > 0) return `${backups.failedLast24h} failed · 24h`;
    if (backups.lastCompletedAt) return `Last backup ${metricAge(backups.lastCompletedAt) ?? 'recently'}`;
    return 'No backups yet';
  })();

  const asOf = summary ? formatAsOf(summary.generatedAt) : null;

  if (showOnboarding) {
    return (
      <div className="command-center">
        <Atmosphere />
        <div className="cmd-content space-y-6">
          <CommandHeader />
          <OnboardingFlow
            onComplete={() => {
              setShowOnboarding(false);
              refetchSummary();
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="command-center">
      <Atmosphere />
      <InfrastructurePlane />
      <CommandHorizon />
      <div className="cmd-content space-y-8">
        <CommandHeader asOf={asOf} stale={stale} />

        {skeleton ? (
          <div className="space-y-8">
            <Skeleton className="h-24" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          </div>
        ) : (
          <SignalField ariaLabel="Live operational state">
            <div className="space-y-6">
              <OperationalState
                status={status}
                reasons={reasons}
                generatedAt={summary?.generatedAt ?? null}
                stale={stale}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <FleetCountCard label="Total Devices" value={summary?.fleet.total ?? null} icon={<Monitor className="h-5 w-5 text-primary" />} />
                <FleetCountCard label="Online Agents" value={summary?.fleet.online ?? null} icon={<Activity className="h-5 w-5 text-success" />} />
                <FleetCountCard label="Active Alerts" value={alertsCount} icon={<AlertTriangle className="h-5 w-5 text-warning" />} />
                <FleetCountCard label="Team Members" value={teamCount} icon={<Users className="h-5 w-5 text-accent-400" />} />
              </div>
            </div>
          </SignalField>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <GlassPanel intensity="light" className="p-5">
            <h2 className="mb-4 text-sm font-medium text-text-primary">Fleet &amp; Security</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">Device Health</span>
                <div className="flex items-center gap-2">
                  {deviceHealth === null ? (
                    <span className="text-xs text-text-disabled italic">No health scores yet</span>
                  ) : (
                    <>
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-muted">
                        <div
                          className={`h-full rounded-full ${deviceHealth >= 80 ? 'bg-green-500' : deviceHealth >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${deviceHealth}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-xs text-text-secondary tabular-nums">{deviceHealth}%</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">Risk Assessment</span>
                <div className="flex items-center gap-2">
                  {worstRisk === null ? (
                    <span className="text-xs text-text-disabled italic">No scans yet</span>
                  ) : (
                    <span className="text-xs text-text-secondary capitalize">
                      {worstRisk}{openFindingsTotal !== null && openFindingsTotal > 0 ? ` · ${openFindingsTotal} open` : ''}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">Security Posture</span>
                <div className="flex items-center gap-2">
                  {coveragePercent === null ? (
                    <span className="text-xs text-text-disabled italic">No scans yet</span>
                  ) : (
                    <>
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-muted">
                        <div
                          className={`h-full rounded-full ${coveragePercent >= 80 ? 'bg-green-500' : coveragePercent >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${coveragePercent}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-xs text-text-secondary tabular-nums">{coveragePercent}%</span>
                      <span className="text-[10px] text-text-disabled">
                        {lastScanAgeDays === null ? '' : lastScanAgeDays === 0 ? 'scanned today' : `scan ${lastScanAgeDays}d ago`}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </GlassPanel>

          <GlassPanel intensity="light" className="p-5">
            <h2 className="mb-4 text-sm font-medium text-text-primary">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Connect Device', icon: Monitor, desc: 'Enroll new device', action: () => setShowOnboarding(true) },
                { label: 'View Alerts', icon: AlertTriangle, desc: alertsCount === null ? 'Status unavailable' : alertsCount > 0 ? `${alertsCount} unresolved` : 'All clear', href: '/dashboard/monitoring' },
                { label: 'Network Map', icon: Network, desc: 'Topology view', href: '/dashboard/network' },
                { label: 'Backup Status', icon: HardDrive, desc: backupStatusText, href: '/dashboard/backup' },
              ].map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => (action.action ? action.action() : router.push(action.href!))}
                    className="cmd-focus-ring flex flex-col items-start gap-1.5 rounded-xl border border-border bg-surface p-3.5 text-left transition-all hover:bg-surface-subtle"
                  >
                    <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                    <span className="text-sm font-medium text-text-secondary">{action.label}</span>
                    <span className="text-xs text-text-disabled">{action.desc}</span>
                  </button>
                );
              })}
            </div>
          </GlassPanel>
        </div>

        <GlassPanel intensity="light" className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium text-text-primary">
              {recentDevices.length > 0 ? 'Recently Active Devices' : 'No devices connected'}
            </h2>
            {recentDevices.length > 0 && (
              <button
                type="button"
                onClick={() => setShowOnboarding(true)}
                className="cmd-focus-ring flex items-center gap-1 text-xs text-primary transition-colors hover:text-primary-300"
              >
                <Monitor className="h-3 w-3" aria-hidden="true" /> Connect Device
              </button>
            )}
          </div>
          {skeleton ? (
            <div className="space-y-3">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : recentDevices.length === 0 ? (
            <div className="py-8 text-center">
              <Monitor className="mx-auto mb-3 h-10 w-10 text-text-disabled" aria-hidden="true" />
              <p className="text-sm text-text-disabled">Connect your first device to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-3 text-xs font-medium uppercase tracking-wider text-text-muted">Device</th>
                    <th className="pb-3 text-xs font-medium uppercase tracking-wider text-text-muted">Status</th>
                    <th className="pb-3 text-xs font-medium uppercase tracking-wider text-text-muted">OS</th>
                    <th className="pb-3 text-xs font-medium uppercase tracking-wider text-text-muted">Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDevices.slice(0, 8).map((device) => {
                    const isOnline = isDeviceOnline(device.lastSeenAt);
                    return (
                      <tr key={device.id} className="border-b border-border-subtle">
                        <td className="py-3 font-mono text-xs text-text-secondary">{device.name}</td>
                        <td className="py-3">
                          <StatusBadge status={isOnline ? 'online' : 'offline'} size="sm" dot />
                        </td>
                        <td className="py-3 text-xs text-text-secondary">{device.os || '-'}</td>
                        <td className="py-3 text-xs text-text-muted">{formatDeviceLastSeen(device.lastSeenAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </GlassPanel>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <ModuleSlot
            overline="Attention"
            title="Attention rail"
            description="Live alerts, critical and high findings, failed operations, and offline devices with acknowledge actions."
            href="/dashboard/monitoring"
            hrefLabel="View alerts"
          />
          <ModuleSlot
            overline="Fleet Intelligence"
            title="Spatial fleet view"
            description="Freshness-aware device grouping and per-device presence in the command space."
            href="/dashboard/device-health"
            hrefLabel="Open device health"
          />
          <ModuleSlot
            overline="Operations"
            title="Job operations"
            description="Running, failed, and completed backups, scans, and reports with routing to owning pages."
            href="/dashboard/backup"
            hrefLabel="Open backups"
          />
        </div>
      </div>
    </div>
  );
}
