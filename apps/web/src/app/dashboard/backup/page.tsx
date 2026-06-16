'use client';

import { useState, useEffect, useCallback } from 'react';
import { GlassPanel, Badge, Card, CardHeader, CardTitle, CardContent, Button } from '@techfusion/ui';
import {
  HardDrive,
  Plus,
  Play,
  Trash2,
  RefreshCw,
  Clock,
  Database,
  FolderOpen,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  FileText,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import { useBackupJobs, useBackupRuns, useRestorePoints, BackupJob, BackupRun } from '@/hooks/useBackups';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getAuthHeaders() {
  const token = localStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

type Tab = 'jobs' | 'runs' | 'restore';
type WizardStep = 'select-point' | 'review' | 'executing' | 'result';

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '-';
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(0) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return bytes + ' B';
}

function formatDate(d: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleString();
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'text-green-400 bg-green-500/10',
  running: 'text-primary-400 bg-primary-500/10',
  pending: 'text-amber-400 bg-amber-500/10',
  failed: 'text-red-400 bg-red-500/10',
  cancelled: 'text-white/40 bg-white/[0.04]',
};

export default function BackupPage() {
  const [activeTab, setActiveTab] = useState<Tab>('jobs');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>('select-point');
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [restoreResult, setRestoreResult] = useState<any>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', deviceId: '', type: 'file', schedule: '', sourcePaths: '', destination: '', retention: 7 });

  const { jobs, loading: jobsLoading, refetch: refetchJobs } = useBackupJobs();
  const { runs, loading: runsLoading, refetch: refetchRuns } = useBackupRuns();
  const { points, loading: pointsLoading, refetch: refetchPoints } = useRestorePoints(selectedDeviceId || undefined);

  const tabStyle = (t: Tab) =>
    cn(
      'px-4 py-2 rounded-lg text-sm font-medium transition-all',
      activeTab === t ? 'bg-primary-600/15 text-primary-400' : 'text-white/40 hover:text-white/60 hover:bg-white/[0.04]',
    );

  const handleCreateJob = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/backups/jobs`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...createForm,
          sourcePaths: createForm.sourcePaths ? createForm.sourcePaths.split(',').map((s) => s.trim()) : undefined,
        }),
      });
      if (res.ok) {
        setShowCreateForm(false);
        setCreateForm({ name: '', deviceId: '', type: 'file', schedule: '', sourcePaths: '', destination: '', retention: 7 });
        refetchJobs();
      }
    } catch (e) {
      console.error('Failed to create job:', e);
    }
  }, [createForm, refetchJobs]);

  const handleTriggerJob = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`${API_URL}/backups/jobs/${jobId}/trigger`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setTimeout(refetchRuns, 3000);
        setTimeout(refetchJobs, 3000);
      }
    } catch (e) {
      console.error('Failed to trigger job:', e);
    }
  }, [refetchRuns, refetchJobs]);

  const handleDeleteJob = useCallback(async (jobId: string) => {
    try {
      await fetch(`${API_URL}/backups/jobs/${jobId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      refetchJobs();
    } catch (e) {
      console.error('Failed to delete job:', e);
    }
  }, [refetchJobs]);

  const startWizard = useCallback((deviceId: string) => {
    setSelectedDeviceId(deviceId);
    setWizardOpen(true);
    setWizardStep('select-point');
    setSelectedRunId(null);
    setRestoreResult(null);
    setTimeout(refetchPoints, 100);
  }, [refetchPoints]);

  const executeRestore = useCallback(async () => {
    if (!selectedRunId) return;
    setWizardStep('executing');
    try {
      const res = await fetch(`${API_URL}/backups/runs/${selectedRunId}/restore`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setRestoreResult(data);
        setWizardStep('result');
      } else {
        setRestoreResult({ status: 'failure', message: 'Restore request failed' });
        setWizardStep('result');
      }
    } catch (e: any) {
      setRestoreResult({ status: 'failure', message: e.message || 'Restore failed' });
      setWizardStep('result');
    }
  }, [selectedRunId]);

  const devices = [...new Set(jobs.map((j) => j.deviceId))];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Backup &amp; Recovery Center</h1>
          <p className="text-sm text-white/40 mt-1">Job scheduling, run tracking, and guided recovery.</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="h-10 px-4 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New Job
        </button>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setActiveTab('jobs')} className={tabStyle('jobs')}>
          <Clock className="h-4 w-4 inline mr-1.5" />
          Jobs ({jobs.length})
        </button>
        <button onClick={() => setActiveTab('runs')} className={tabStyle('runs')}>
          <Activity className="h-4 w-4 inline mr-1.5" />
          Run History ({runs.length})
        </button>
        <button onClick={() => setActiveTab('restore')} className={tabStyle('restore')}>
          <RefreshCw className="h-4 w-4 inline mr-1.5" />
          Recovery Wizard
        </button>
      </div>

      {showCreateForm && (
        <GlassPanel intensity="light" className="p-5">
          <h3 className="text-sm font-medium text-white mb-4">Create Backup Job</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-white/40 mb-1">Job Name</label>
              <input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                className="h-10 w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-white outline-none focus:ring-2 focus:ring-primary-500/40" />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Device ID</label>
              <input value={createForm.deviceId} onChange={(e) => setCreateForm({ ...createForm, deviceId: e.target.value })}
                className="h-10 w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-white outline-none focus:ring-2 focus:ring-primary-500/40" />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Type</label>
              <select value={createForm.type} onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })}
                className="h-10 w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-white outline-none focus:ring-2 focus:ring-primary-500/40">
                <option value="file">File-level</option>
                <option value="full_image">Full Image</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Schedule (cron)</label>
              <input value={createForm.schedule} onChange={(e) => setCreateForm({ ...createForm, schedule: e.target.value })}
                placeholder="0 2 * * * (daily at 2am)"
                className="h-10 w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-white placeholder:text-white/20 outline-none focus:ring-2 focus:ring-primary-500/40" />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Source Paths (comma-sep)</label>
              <input value={createForm.sourcePaths} onChange={(e) => setCreateForm({ ...createForm, sourcePaths: e.target.value })}
                placeholder="/etc,/home,/var/www"
                className="h-10 w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-white placeholder:text-white/20 outline-none focus:ring-2 focus:ring-primary-500/40" />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Retention (days)</label>
              <input type="number" value={createForm.retention} onChange={(e) => setCreateForm({ ...createForm, retention: parseInt(e.target.value) || 7 })}
                className="h-10 w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-white outline-none focus:ring-2 focus:ring-primary-500/40" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreateJob}
              className="h-9 px-4 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-medium transition-colors">
              Create
            </button>
            <button onClick={() => setShowCreateForm(false)}
              className="h-9 px-4 rounded-xl border border-white/[0.06] text-white/50 hover:text-white/70 text-xs transition-colors">
              Cancel
            </button>
          </div>
        </GlassPanel>
      )}

      {activeTab === 'jobs' && (
        <div className="space-y-4">
          {jobsLoading && jobs.length === 0 ? (
            <GlassPanel intensity="light" className="p-12 text-center">
              <Loader2 className="h-6 w-6 text-white/20 mx-auto animate-spin" />
            </GlassPanel>
          ) : jobs.length === 0 ? (
            <GlassPanel intensity="light" className="p-12 text-center">
              <Database className="h-8 w-8 text-white/20 mx-auto mb-2" />
              <p className="text-sm text-white/30">No backup jobs configured</p>
            </GlassPanel>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {jobs.map((job) => (
                <GlassPanel key={job.id} intensity="light" className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary-500/10 flex items-center justify-center shrink-0">
                        <HardDrive className="h-5 w-5 text-primary-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-medium text-white">{job.name}</h3>
                          <Badge variant={job.isEnabled ? 'success' : 'secondary'} className="text-[10px]">
                            {job.isEnabled ? 'Active' : 'Disabled'}
                          </Badge>
                          <Badge variant="primary" className="text-[10px]">{job.type}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-white/40">
                          <span>Device: {job.deviceId.slice(0, 8)}...</span>
                          {job.schedule && <span>Schedule: {job.schedule}</span>}
                          <span>Retention: {job.retention}d</span>
                          {job._count && <span>Runs: {job._count.runs}</span>}
                          {job.lastRunAt && <span>Last: {formatDate(job.lastRunAt)}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => handleTriggerJob(job.id)}
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-white/40 hover:text-primary-400 hover:bg-white/[0.04] transition-all"
                        title="Trigger Run">
                        <Play className="h-4 w-4" />
                      </button>
                      <button onClick={() => startWizard(job.deviceId)}
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-white/40 hover:text-cyan-400 hover:bg-white/[0.04] transition-all"
                        title="Restore">
                        <RefreshCw className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDeleteJob(job.id)}
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-white/[0.04] transition-all"
                        title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </GlassPanel>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'runs' && (
        <div className="space-y-4">
          {runsLoading && runs.length === 0 ? (
            <GlassPanel intensity="light" className="p-12 text-center">
              <Loader2 className="h-6 w-6 text-white/20 mx-auto animate-spin" />
            </GlassPanel>
          ) : runs.length === 0 ? (
            <GlassPanel intensity="light" className="p-12 text-center">
              <Activity className="h-8 w-8 text-white/20 mx-auto mb-2" />
              <p className="text-sm text-white/30">No backup runs yet. Trigger a job to see results.</p>
            </GlassPanel>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                    <th className="text-left px-4 py-3 text-xs text-white/30 font-medium uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs text-white/30 font-medium uppercase tracking-wider">Type</th>
                    <th className="text-left px-4 py-3 text-xs text-white/30 font-medium uppercase tracking-wider">Started</th>
                    <th className="text-left px-4 py-3 text-xs text-white/30 font-medium uppercase tracking-wider">Completed</th>
                    <th className="text-left px-4 py-3 text-xs text-white/30 font-medium uppercase tracking-wider">Size</th>
                    <th className="text-left px-4 py-3 text-xs text-white/30 font-medium uppercase tracking-wider">Files</th>
                    <th className="text-left px-4 py-3 text-xs text-white/30 font-medium uppercase tracking-wider">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium', STATUS_COLORS[r.status] || STATUS_COLORS.pending)}>
                          {r.status === 'running' && <Loader2 className="h-3 w-3 animate-spin" />}
                          {r.status === 'completed' && <CheckCircle className="h-3 w-3" />}
                          {r.status === 'failed' && <XCircle className="h-3 w-3" />}
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/70 text-xs">{r.type}</td>
                      <td className="px-4 py-3 text-white/50 text-xs">{formatDate(r.startedAt)}</td>
                      <td className="px-4 py-3 text-white/50 text-xs">{formatDate(r.completedAt)}</td>
                      <td className="px-4 py-3 text-white/70 font-mono text-xs">{formatSize(r.sizeBytes)}</td>
                      <td className="px-4 py-3 text-white/70 text-xs">{r.fileCount ?? '-'}</td>
                      <td className="px-4 py-3 text-red-400 text-xs max-w-[200px] truncate">{r.errorMessage || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'restore' && (
        <div className="space-y-4">
          {!wizardOpen ? (
            <GlassPanel intensity="light" className="p-8 text-center">
              <RefreshCw className="h-10 w-10 text-white/20 mx-auto mb-3" />
              <h3 className="text-base font-medium text-white/60 mb-1">Recovery Wizard</h3>
              <p className="text-sm text-white/30 mb-4">Select a device to begin the guided restore process.</p>
              {devices.length === 0 ? (
                <p className="text-xs text-white/20">No backup jobs found. Create a job first.</p>
              ) : (
                <div className="flex flex-wrap justify-center gap-2">
                  {devices.map((did) => (
                    <button key={did} onClick={() => startWizard(did)}
                      className="px-4 py-2 rounded-xl bg-primary-600/20 text-primary-400 text-sm hover:bg-primary-600/30 transition-colors">
                      Device: {did.slice(0, 8)}...
                    </button>
                  ))}
                </div>
              )}
            </GlassPanel>
          ) : (
            <GlassPanel intensity="light" className="p-6">
              {wizardStep === 'select-point' && (
                <div>
                  <div className="flex items-center gap-2 mb-5">
                    <div className="h-7 w-7 rounded-full bg-primary-600/20 text-primary-400 flex items-center justify-center text-xs font-bold">1</div>
                    <span className="text-sm font-medium text-white">Select Restore Point</span>
                  </div>
                  {pointsLoading ? (
                    <div className="flex items-center gap-2 text-white/30 text-sm py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading restore points...
                    </div>
                  ) : points.length === 0 ? (
                    <div className="py-4 text-center">
                      <AlertTriangle className="h-6 w-6 text-amber-400 mx-auto mb-2" />
                      <p className="text-sm text-white/40">No completed backup runs found for this device.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto mb-5">
                      {points.map((p) => (
                        <button key={p.id} onClick={() => setSelectedRunId(p.id)}
                          className={cn(
                            'w-full text-left p-3 rounded-xl border transition-all',
                            selectedRunId === p.id
                              ? 'border-primary-500/40 bg-primary-500/10'
                              : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]',
                          )}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-white font-medium">{p.job?.name || p.type} backup</p>
                              <p className="text-xs text-white/40 mt-0.5">{formatDate(p.startedAt)}</p>
                            </div>
                            <div className="text-right text-xs text-white/40">
                              <p>{formatSize(p.sizeBytes)}</p>
                              <p>{p.fileCount ?? '-'} files</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => setWizardOpen(false)}
                      className="h-9 px-4 rounded-xl border border-white/[0.06] text-white/50 hover:text-white/70 text-xs transition-colors flex items-center gap-1.5">
                      <ChevronLeft className="h-3.5 w-3.5" /> Cancel
                    </button>
                    <button onClick={() => setWizardStep('review')} disabled={!selectedRunId}
                      className="h-9 px-4 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-medium transition-colors disabled:opacity-40 flex items-center gap-1.5">
                      Next <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {wizardStep === 'review' && (
                <div>
                  <div className="flex items-center gap-2 mb-5">
                    <div className="h-7 w-7 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs font-bold">&#10003;</div>
                    <div className="h-7 w-7 rounded-full bg-primary-600/20 text-primary-400 flex items-center justify-center text-xs font-bold">2</div>
                    <span className="text-sm font-medium text-white">Review & Confirm</span>
                  </div>
                  <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 mb-5 space-y-2">
                    <div className="flex justify-between text-sm"><span className="text-white/40">Restore Point:</span><span className="text-white">{selectedRunId ? selectedRunId.slice(0, 8) : 'N/A'}...</span></div>
                    <div className="flex justify-between text-sm"><span className="text-white/40">Device:</span><span className="text-white">{selectedDeviceId.slice(0, 12)}...</span></div>
                    <div className="flex justify-between text-sm"><span className="text-white/40">Operation:</span><span className="text-white">Full file restore to original location</span></div>
                    <div className="flex justify-between text-sm"><span className="text-white/40">Overwrite existing:</span><span className="text-amber-400">Yes (backup will be created first)</span></div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setWizardStep('select-point')}
                      className="h-9 px-4 rounded-xl border border-white/[0.06] text-white/50 hover:text-white/70 text-xs transition-colors flex items-center gap-1.5">
                      <ChevronLeft className="h-3.5 w-3.5" /> Back
                    </button>
                    <button onClick={executeRestore}
                      className="h-9 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5">
                      Start Restore <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {wizardStep === 'executing' && (
                <div className="py-8 text-center">
                  <Loader2 className="h-10 w-10 text-primary-400 mx-auto mb-4 animate-spin" />
                  <h3 className="text-base font-medium text-white">Executing Restore</h3>
                  <p className="text-sm text-white/40 mt-1">Restoring files to original location...</p>
                  <div className="mt-6 h-2 w-full max-w-sm mx-auto rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="h-full w-2/3 rounded-full bg-primary-500 animate-pulse" />
                  </div>
                </div>
              )}

              {wizardStep === 'result' && (
                <div className="py-8 text-center">
                  {restoreResult?.status === 'success' ? (
                    <>
                      <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-white">Restore Complete</h3>
                      <p className="text-sm text-white/40 mt-1">{restoreResult.message}</p>
                      <div className="mt-4 rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 text-left max-w-sm mx-auto space-y-1 text-xs text-white/50">
                        <p>Files restored: {restoreResult.details?.filesRestored ?? 'N/A'}</p>
                        <p>Size: {restoreResult.details?.sizeBytes ? formatSize(restoreResult.details.sizeBytes) : 'N/A'}</p>
                        <p>Destination: {restoreResult.details?.destination ?? 'N/A'}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-white">Restore Failed</h3>
                      <p className="text-sm text-red-400/80 mt-1">{restoreResult?.message || 'Unknown error'}</p>
                    </>
                  )}
                  <button onClick={() => { setWizardOpen(false); setWizardStep('select-point'); }}
                    className="mt-6 h-9 px-4 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-medium transition-colors">
                    Close Wizard
                  </button>
                </div>
              )}
            </GlassPanel>
          )}
        </div>
      )}
    </div>
  );
}
