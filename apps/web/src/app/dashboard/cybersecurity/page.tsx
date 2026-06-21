'use client';

import { useState, useCallback } from 'react';
import { Shield, RefreshCw, Download, AlertTriangle, CheckCircle, XCircle, ChevronDown, Activity } from 'lucide-react';
import { cn, GlassPanel, Badge, Button, ScorePill, Card, CardHeader, CardTitle, CardContent, CardDescription } from '@techfusion/ui';
import { useDeviceList } from '@/hooks/useDevices';
import { useSecurity, SecurityFinding } from '@/hooks/useSecurity';

const severityColors: Record<string, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#16a34a',
};

const severityBg: Record<string, string> = {
  critical: 'bg-red-500/10 border-red-500/30',
  high: 'bg-orange-500/10 border-orange-500/30',
  medium: 'bg-yellow-500/10 border-yellow-500/30',
  low: 'bg-green-500/10 border-green-500/30',
};

const categoryLabels: Record<string, string> = {
  updates: 'Updates',
  firewall: 'Firewall',
  weak_config: 'Weak Configuration',
  open_ports: 'Open Ports',
  password_policy: 'Password Policy',
};

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span
      className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border"
      style={{
        color: severityColors[severity] || '#6b7280',
        borderColor: severityColors[severity] || '#6b7280',
        backgroundColor: `${severityColors[severity] || '#6b7280'}15`,
      }}
    >
      {severity}
    </span>
  );
}

function ScoreGauge({ score }: { score: number }) {
  const getColor = (s: number) => {
    if (s >= 75) return '#16a34a';
    if (s >= 50) return '#ca8a04';
    if (s >= 25) return '#ea580c';
    return '#dc2626';
  };

  const strokeDasharray = 2 * Math.PI * 54;
  const strokeDashoffset = strokeDasharray * ((100 - score) / 100);

  return (
    <div className="relative flex items-center justify-center w-32 h-32">
      <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        <circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke={getColor(score)}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <span className="text-2xl font-bold" style={{ color: getColor(score) }}>{score}</span>
          <span className="text-[10px] text-white/40 block -mt-1">/ 100</span>
        </div>
      </div>
    </div>
  );
}

function FindingsSection({ findings, onRemediate }: { findings: SecurityFinding[]; onRemediate: (id: string) => void }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const grouped = findings.reduce(
    (acc, f) => {
      if (!acc[f.severity]) acc[f.severity] = [];
      acc[f.severity].push(f);
      return acc;
    },
    {} as Record<string, SecurityFinding[]>,
  );

  const severityOrder = ['critical', 'high', 'medium', 'low'];

  return (
    <div className="space-y-3">
      {severityOrder.map((sev) => {
        const items = grouped[sev] || [];
        if (items.length === 0) return null;
        return (
          <div key={sev} className="space-y-2">
            <h4 className="text-xs font-medium uppercase tracking-wider" style={{ color: severityColors[sev] }}>
              {sev} ({items.length})
            </h4>
            {items.map((f) => (
              <GlassPanel key={f.id} intensity="light" className={cn('p-4 border rounded-xl', severityBg[f.severity] || 'border-white/[0.06]')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <SeverityBadge severity={f.severity} />
                      <span className="text-[10px] text-white/30 uppercase">{categoryLabels[f.category] || f.category}</span>
                      {f.status === 'remediated' && <CheckCircle className="h-3 w-3 text-green-400" />}
                    </div>
                    <p className="text-sm text-white/80 font-medium">{f.finding}</p>
                    <div className="mt-2">
                      <button
                        onClick={() => setExpanded((prev) => ({ ...prev, [f.id]: !prev[f.id] }))}
                        className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
                      >
                        {expanded[f.id] ? 'Hide remediation' : 'Show remediation'}
                      </button>
                      {expanded[f.id] && (
                        <div className="mt-2 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                          <p className="text-xs text-white/60 leading-relaxed">{f.remediation}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  {f.status === 'open' && (
                    <button
                      onClick={() => onRemediate(f.id)}
                      className="shrink-0 h-7 px-3 rounded-lg text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20 transition-all"
                    >
                      Remediate
                    </button>
                  )}
                </div>
              </GlassPanel>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default function CybersecurityPage() {
  const { devices, loading: devLoading } = useDeviceList();
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [showDropdown, setShowDropdown] = useState(false);
  const [view, setView] = useState<'findings' | 'executive'>('findings');

  const { latestScan, scans, summary, loading, triggering, triggerScan, remediateFinding } = useSecurity(selectedId);

  const selectedDevice = devices.find((d) => d.id === selectedId);

  const openFindings = latestScan?.findings?.filter((f) => f.status === 'open') || [];
  const allFindings = latestScan?.findings || [];

  const handleExportPdf = useCallback(() => {
    if (!selectedId) return;
    const token = localStorage.getItem('accessToken');
    const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/security/export-pdf/${selectedId}`;
    window.open(url, '_blank');
  }, [selectedId]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Cybersecurity Center</h1>
          <p className="text-sm text-white/40 mt-1">Security posture scanning, findings, and remediation.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="glass"
            size="sm"
            onClick={triggerScan}
            disabled={!selectedId || triggering}
          >
            <Activity className={cn('h-3.5 w-3.5 mr-1.5', triggering && 'animate-spin')} />
            {triggering ? 'Scanning...' : 'Trigger Scan'}
          </Button>
          <Button
            variant="glass"
            size="sm"
            onClick={handleExportPdf}
            disabled={!summary}
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Device Selector */}
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className={cn(
            'flex items-center justify-between gap-2 w-full sm:w-80 px-4 py-2.5 rounded-xl text-sm transition-all border',
            selectedDevice
              ? 'bg-primary-600/10 border-primary-500/30 text-white'
              : 'bg-white/[0.03] border-white/[0.06] text-white/50 hover:text-white/70',
          )}
        >
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span>{selectedDevice ? selectedDevice.name : 'Select a device...'}</span>
          </div>
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        {showDropdown && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
            <div className="absolute top-full left-0 z-20 mt-1 w-80 rounded-xl border border-white/[0.06] bg-background/95 backdrop-blur-xl shadow-2xl max-h-60 overflow-y-auto">
              {devices.map((d) => (
                <button
                  key={d.id}
                  onClick={() => { setSelectedId(d.id); setShowDropdown(false); }}
                  className={cn(
                    'w-full text-left px-4 py-2.5 text-sm transition-colors',
                    selectedId === d.id
                      ? 'text-primary-300 bg-primary-600/10'
                      : 'text-white/60 hover:text-white/80 hover:bg-white/[0.04]',
                  )}
                >
                  {d.name}
                  {d.hostname && <span className="text-white/20 ml-1.5 text-xs">({d.hostname})</span>}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {!selectedId ? (
        <GlassPanel intensity="light" className="p-12 flex flex-col items-center justify-center text-center">
          <Shield className="h-12 w-12 text-white/20 mb-4" />
          <h3 className="text-lg font-medium text-white/50">Select a device</h3>
          <p className="text-sm text-white/30 mt-1 max-w-md">
            Choose a device from the dropdown above to view its security posture and scan results.
          </p>
        </GlassPanel>
      ) : loading ? (
        <GlassPanel intensity="light" className="p-12 flex items-center justify-center">
          <Activity className="h-5 w-5 text-white/30 animate-spin mr-3" />
          <span className="text-sm text-white/30">Loading security data...</span>
        </GlassPanel>
      ) : !latestScan ? (
        <GlassPanel intensity="light" className="p-12 flex flex-col items-center justify-center text-center">
          <AlertTriangle className="h-12 w-12 text-white/20 mb-4" />
          <h3 className="text-lg font-medium text-white/50">No scan data available</h3>
          <p className="text-sm text-white/30 mt-1 max-w-md">
            No security scan has been performed for this device yet.
          </p>
          <button
            onClick={triggerScan}
            disabled={triggering}
            className="mt-4 h-9 px-4 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {triggering ? <Activity className="h-3.5 w-3.5 animate-spin" /> : <Shield className="h-3.5 w-3.5" />}
            {triggering ? 'Scanning...' : 'Run First Scan'}
          </button>
        </GlassPanel>
      ) : (
        <>
          {/* Score and Summary Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Score Card */}
            <GlassPanel intensity="light" className="p-6 flex flex-col items-center">
              <ScoreGauge score={latestScan.score?.securityScore ?? 0} />
              <p className="mt-3 text-sm font-medium text-white/60">
                Risk Level:{' '}
                <span
                  className="font-semibold uppercase"
                  style={{ color: severityColors[latestScan.score?.riskLevel || 'low'] }}
                >
                  {latestScan.score?.riskLevel || 'Unknown'}
                </span>
              </p>
            </GlassPanel>

            {/* Counts */}
            <GlassPanel intensity="light" className="p-6">
              <h3 className="text-sm font-medium text-white/60 mb-4">Finding Summary</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Critical', count: latestScan.score?.criticalCount || 0, color: severityColors.critical },
                  { label: 'High', count: latestScan.score?.highCount || 0, color: severityColors.high },
                  { label: 'Medium', count: latestScan.score?.mediumCount || 0, color: severityColors.medium },
                  { label: 'Low', count: latestScan.score?.lowCount || 0, color: severityColors.low },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-3 text-center">
                    <span className="text-xl font-bold" style={{ color: item.color }}>{item.count}</span>
                    <p className="text-[10px] text-white/40 uppercase mt-0.5">{item.label}</p>
                  </div>
                ))}
              </div>
            </GlassPanel>

            {/* Scan Info */}
            <GlassPanel intensity="light" className="p-6">
              <h3 className="text-sm font-medium text-white/60 mb-3">Last Scan</h3>
              <div className="space-y-2 text-xs text-white/50">
                <p>Status: <span className="text-green-400 font-medium capitalize">{latestScan.status}</span></p>
                <p>Started: {new Date(latestScan.startedAt).toLocaleString()}</p>
                {latestScan.completedAt && (
                  <p>Completed: {new Date(latestScan.completedAt).toLocaleString()}</p>
                )}
                <p>Total findings: <span className="text-white/70">{latestScan.score?.totalFindings || 0}</span></p>
                <p>Open findings: <span className="text-white/70">{openFindings.length}</span></p>
              </div>
            </GlassPanel>
          </div>

          {/* View Toggle */}
          <div className="flex gap-1 rounded-xl bg-white/[0.03] border border-white/[0.06] p-1 w-fit">
            <button
              onClick={() => setView('findings')}
              className={cn(
                'px-4 py-1.5 rounded-lg text-xs font-medium transition-all',
                view === 'findings' ? 'bg-white/[0.08] text-white' : 'text-white/40 hover:text-white/60',
              )}
            >
              Findings
            </button>
            <button
              onClick={() => setView('executive')}
              className={cn(
                'px-4 py-1.5 rounded-lg text-xs font-medium transition-all',
                view === 'executive' ? 'bg-white/[0.08] text-white' : 'text-white/40 hover:text-white/60',
              )}
            >
              Executive Summary
            </button>
          </div>

          {/* Findings View */}
          {view === 'findings' && (
            allFindings.length === 0 ? (
              <GlassPanel intensity="light" className="p-12 text-center">
                <CheckCircle className="h-10 w-10 text-green-400/50 mx-auto mb-3" />
                <h3 className="text-sm font-medium text-white/50">No findings</h3>
                <p className="text-xs text-white/30 mt-1">This device has a clean security posture.</p>
              </GlassPanel>
            ) : (
              <FindingsSection findings={allFindings} onRemediate={remediateFinding} />
            )
          )}

          {/* Executive Summary View */}
          {view === 'executive' && summary && (
            <GlassPanel intensity="light" className="p-6">
              <h3 className="text-sm font-medium text-white mb-4">Executive Summary</h3>
              <div className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] mb-4">
                <p className="text-sm text-white/70 leading-relaxed">{summary.summaryText}</p>
              </div>

              {summary.topFindings.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-xs font-medium text-white/50 uppercase mb-3">Top Findings</h4>
                  <div className="space-y-2">
                    {summary.topFindings.map((f, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-xl border border-white/[0.04] bg-white/[0.02]">
                        <SeverityBadge severity={f.severity} />
                        <div>
                          <p className="text-xs text-white/70">{f.finding}</p>
                          <p className="text-[10px] text-white/40 mt-0.5">{f.remediation}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {summary.recommendations.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-xs font-medium text-white/50 uppercase mb-3">Recommendations</h4>
                  <ul className="space-y-1.5">
                    {summary.recommendations.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-white/60">
                        <span className="text-primary-400 mt-0.5">&#8594;</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </GlassPanel>
          )}

          {/* Scan History */}
          {scans.length > 0 && (
            <GlassPanel intensity="light" className="p-6">
              <h3 className="text-sm font-medium text-white mb-4">Scan History</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left py-2 px-3 text-white/40 font-medium">Date</th>
                      <th className="text-left py-2 px-3 text-white/40 font-medium">Status</th>
                      <th className="text-left py-2 px-3 text-white/40 font-medium">Score</th>
                      <th className="text-left py-2 px-3 text-white/40 font-medium">Risk</th>
                      <th className="text-left py-2 px-3 text-white/40 font-medium">Findings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scans.slice(0, 10).map((s) => (
                      <tr key={s.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                        <td className="py-2.5 px-3 text-white/60">{new Date(s.startedAt).toLocaleDateString()}</td>
                        <td className="py-2.5 px-3">
                          <Badge variant={s.status === 'completed' ? 'success' : s.status === 'pending' ? 'warning' : 'secondary'}>
                            {s.status}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-white/70 font-medium">{s.score?.securityScore ?? '-'}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className="font-medium uppercase text-[10px]"
                            style={{ color: severityColors[s.score?.riskLevel || 'low'] || '#6b7280' }}
                          >
                            {s.score?.riskLevel || '-'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-white/60">{s.findingCount ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassPanel>
          )}
        </>
      )}
    </div>
  );
}
