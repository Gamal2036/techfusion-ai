'use client';

import { useState, useCallback, useRef } from 'react';
import { cn, GlassPanel, Badge, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, toast } from '@techfusion/ui';
import {
  HardDrive,
  Plus,
  Play,
  Trash2,
  RefreshCw,
  Clock,
  Database,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Activity,
  AlertTriangle,
  Shield,
  Download,
} from 'lucide-react';
import { useBackupJobs, useBackupRuns, useRestorePoints } from '@/hooks/useBackups';
import { useDeviceList } from '@/hooks/useDevices';
import { apiFetch } from '@/lib/auth-client';

type Tab = 'jobs' | 'runs' | 'restore';
type WizardStep = 'select-point' | 'review' | 'executing' | 'result';

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

function formatDuration(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return '-';
  const diff = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (diff < 1000) return '<1s';
  if (diff < 60000) return Math.round(diff / 1000) + 's';
  const mins = Math.floor(diff / 60000);
  const secs = Math.round((diff % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'text-success bg-green-500/10',
  running: 'text-primary bg-primary-500/10',
  pending: 'text-warning bg-amber-500/10',
  failed: 'text-danger bg-red-500/10',
  cancelled: 'text-text-muted bg-surface-subtle',
};

const BACKUP_TYPE_LABELS: Record<string, string> = {
  file: 'Files',
  full_image: 'System (Database + Files + Config)',
  database: 'Database',
  config: 'Configuration',
};

const BACKUP_TYPES = [
  { value: 'file', label: 'Files / Directories', supported: true },
  { value: 'full_image', label: 'Full System Backup', supported: false },
  { value: 'database', label: 'Database', supported: true },
  { value: 'config', label: 'Configuration', supported: true },
];

export default function BackupPage() {
  const [activeTab, setActiveTab] = useState<Tab>('jobs');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>('select-point');
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [restoreResult, setRestoreResult] = useState<any>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', deviceId: '', type: 'file', schedule: '', sourcePaths: '', destination: '', retention: 7 });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [triggerConfirmId, setTriggerConfirmId] = useState<string | null>(null);
  const [verifyingJobs, setVerifyingJobs] = useState<Set<string>>(new Set());
  const triggerRef = useRef(false);

  const { jobs, loading: jobsLoading, error: jobsError, refetch: refetchJobs } = useBackupJobs();
  const { runs, loading: runsLoading, error: runsError, hasActiveRun, refetch: refetchRuns } = useBackupRuns();
  const { points, loading: pointsLoading, error: pointsError, refetch: refetchPoints } = useRestorePoints(selectedDeviceId || undefined);
  const { devices, loading: devicesLoading } = useDeviceList();

  const tabStyle = (t: Tab) =>
    cn(
      'px-4 py-2 rounded-lg text-sm font-medium transition-all',
      activeTab === t ? 'bg-primary-600/15 text-primary' : 'text-text-muted hover:text-text-secondary hover:bg-surface-subtle',
    );

  const validateForm = useCallback(() => {
    const errors: Record<string, string> = {};
    if (!createForm.name.trim()) errors.name = 'Job name is required';
    if (!createForm.deviceId) errors.deviceId = 'Device selection is required';
    if (createForm.schedule && !/^(\S+\s+){4}\S+$/.test(createForm.schedule.trim())) {
      errors.schedule = 'Invalid cron expression (expected 5 fields)';
    }
    if (createForm.sourcePaths.trim()) {
      const paths = createForm.sourcePaths.split(',').map((s) => s.trim()).filter(Boolean);
      const invalid = paths.filter((p) => !p.startsWith('/'));
      if (invalid.length > 0) {
        errors.sourcePaths = `Invalid paths (must be absolute): ${invalid.join(', ')}`;
      }
    }
    if (createForm.retention < 1 || createForm.retention > 3650) {
      errors.retention = 'Retention must be between 1 and 3650 days';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [createForm]);

  const handleCreateJob = useCallback(async () => {
    if (isCreating) return;
    if (!validateForm()) return;

    setIsCreating(true);
    try {
      const sourcePaths = createForm.sourcePaths.trim()
        ? createForm.sourcePaths.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined;

      const res = await apiFetch('/backups/jobs', {
        method: 'POST',
        body: JSON.stringify({
          name: createForm.name.trim(),
          deviceId: createForm.deviceId,
          type: createForm.type,
          schedule: createForm.schedule.trim() || undefined,
          sourcePaths: sourcePaths && sourcePaths.length > 0 ? sourcePaths : undefined,
          retention: createForm.retention,
        }),
      });
      if (res.ok) {
        setShowCreateForm(false);
        setCreateForm({ name: '', deviceId: '', type: 'file', schedule: '', sourcePaths: '', destination: '', retention: 7 });
        setFormErrors({});
        toast.success('Backup job created successfully');
        refetchJobs();
      } else {
        const err = await res.json().catch(() => ({ message: 'Failed to create job' }));
        toast.error(err.message || 'Failed to create backup job');
      }
    } catch (e: any) {
      toast.error(e.message || 'Network error while creating job');
      console.error('Failed to create job:', e);
    } finally {
      setIsCreating(false);
    }
  }, [createForm, validateForm, isCreating, refetchJobs]);

  const handleTriggerJob = useCallback(async (jobId: string) => {
    if (triggerRef.current) return;
    triggerRef.current = true;
    setTriggerConfirmId(null);
    try {
      const res = await apiFetch(`/backups/jobs/${jobId}/trigger`, {
        method: 'POST',
      });
      if (res.ok) {
        toast.success('Backup run triggered');
        setTimeout(refetchRuns, 1500);
        setTimeout(refetchJobs, 1500);
      } else {
        const err = await res.json().catch(() => ({ message: 'Failed to trigger run' }));
        toast.error(err.message || 'Failed to trigger backup run');
      }
    } catch (e: any) {
      toast.error(e.message || 'Network error while triggering run');
      console.error('Failed to trigger job:', e);
    } finally {
      setTimeout(() => { triggerRef.current = false; }, 2000);
    }
  }, [refetchRuns, refetchJobs]);

  const handleDeleteJob = useCallback(async (jobId: string) => {
    setDeleteConfirmId(null);
    try {
      const res = await apiFetch(`/backups/jobs/${jobId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('Backup job deleted');
        refetchJobs();
      } else {
        const err = await res.json().catch(() => ({ message: 'Failed to delete job' }));
        toast.error(err.message || 'Failed to delete backup job');
      }
    } catch (e: any) {
      toast.error(e.message || 'Network error while deleting job');
      console.error('Failed to delete job:', e);
    }
  }, [refetchJobs]);

  const handleVerifyJob = useCallback(async (jobId: string) => {
    const completed = runs.filter((r) => r.jobId === jobId && r.status === 'completed' && r.completedAt);
    completed.sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());
    const latestCompleted = completed[0];

    if (!latestCompleted) {
      toast.error('No completed runs to verify');
      return;
    }

    setVerifyingJobs((prev) => new Set(prev).add(jobId));
    try {
      const res = await apiFetch(`/backups/runs/${latestCompleted.id}/verify`, {
        method: 'POST',
      });
      if (res.ok) {
        toast.success('Verification queued');
        setTimeout(refetchRuns, 2000);
      } else {
        const err = await res.json().catch(() => ({ message: 'Failed to queue verification' }));
        toast.error(err.message || 'Failed to queue verification');
      }
    } catch (e: any) {
      toast.error(e.message || 'Network error');
      console.error('Failed to verify job:', e);
    } finally {
      setVerifyingJobs((prev) => { const next = new Set(prev); next.delete(jobId); return next; });
    }
  }, [runs, refetchRuns]);

  const handleDownloadArtifact = useCallback(async (runId: string) => {
    try {
      const res = await apiFetch(`/backups/artifacts/${runId}`);
      if (res.ok) {
        const blob = await res.blob();
        const disposition = res.headers.get('Content-Disposition') || '';
        const match = disposition.match(/filename="(.+)"/);
        const filename = match ? match[1] : `backup-${runId.slice(0, 8)}.tar.gz`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const err = await res.json().catch(() => ({ message: 'Download failed' }));
        toast.error(err.message || 'Failed to download artifact');
      }
    } catch (e: any) {
      toast.error(e.message || 'Network error while downloading');
      console.error('Failed to download artifact:', e);
    }
  }, []);

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
      const res = await apiFetch(`/backups/runs/${selectedRunId}/restore`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setRestoreResult(data);
        setWizardStep('result');
      } else {
        const err = await res.json().catch(() => ({ message: 'Restore request failed' }));
        setRestoreResult({ status: 'failure', message: err.message || 'Restore request failed' });
        setWizardStep('result');
      }
    } catch (e: any) {
      setRestoreResult({ status: 'failure', message: e.message || 'Restore failed' });
      setWizardStep('result');
    }
  }, [selectedRunId]);

  const jobDevices = [...new Set(jobs.map((j) => j.deviceId))];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary tracking-tight">Backup &amp; Recovery Center</h1>
          <p className="text-sm text-text-muted mt-1">Job scheduling, run tracking, and guided recovery.</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="h-10 px-4 rounded-xl bg-primary-600 hover:bg-primary-500 text-text-primary text-sm font-medium transition-colors flex items-center gap-2"
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
          {hasActiveRun && <Loader2 className="h-3 w-3 animate-spin inline ml-1 text-primary" />}
        </button>
        <button onClick={() => setActiveTab('restore')} className={tabStyle('restore')}>
          <RefreshCw className="h-4 w-4 inline mr-1.5" />
          Recovery Wizard
        </button>
      </div>

      {showCreateForm && (
        <GlassPanel intensity="light" className="p-5">
          <h3 className="text-sm font-medium text-text-primary mb-4">Create Backup Job</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-text-muted mb-1">Job Name *</label>
              <input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                className={cn('h-10 w-full rounded-xl border px-3 text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary-500/40',
                  formErrors.name ? 'border-danger' : 'border-border bg-surface-subtle')}
                placeholder="My Backup Job" />
              {formErrors.name && <p className="text-xs text-danger mt-1">{formErrors.name}</p>}
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Device *</label>
              {devicesLoading ? (
                <div className="h-10 w-full rounded-xl border border-border bg-surface-subtle flex items-center px-3 text-sm text-text-muted">
                  <Loader2 className="h-3 w-3 animate-spin mr-2" /> Loading devices...
                </div>
              ) : (
                <select value={createForm.deviceId} onChange={(e) => setCreateForm({ ...createForm, deviceId: e.target.value })}
                  className={cn('h-10 w-full rounded-xl border px-3 text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary-500/40',
                    formErrors.deviceId ? 'border-danger' : 'border-border bg-surface-subtle')}>
                  <option value="">-- Select a device --</option>
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>{d.name || d.hostname || d.id.slice(0, 8)}</option>
                  ))}
                </select>
              )}
              {formErrors.deviceId && <p className="text-xs text-danger mt-1">{formErrors.deviceId}</p>}
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Type</label>
              <select value={createForm.type} onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })}
                className="h-10 w-full rounded-xl border border-border bg-surface-subtle px-3 text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary-500/40">
                {BACKUP_TYPES.map((t) => (
                  <option key={t.value} value={t.value} disabled={!t.supported}>
                    {t.label}{!t.supported ? ' (unavailable)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Schedule (cron)</label>
              <input value={createForm.schedule} onChange={(e) => setCreateForm({ ...createForm, schedule: e.target.value })}
                placeholder="0 2 * * * (daily at 2am)"
                className={cn('h-10 w-full rounded-xl border px-3 text-sm text-text-primary placeholder:text-text-disabled outline-none focus:ring-2 focus:ring-primary-500/40',
                  formErrors.schedule ? 'border-danger' : 'border-border bg-surface-subtle')} />
              {formErrors.schedule && <p className="text-xs text-danger mt-1">{formErrors.schedule}</p>}
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Source Paths (comma-sep)</label>
              <input value={createForm.sourcePaths} onChange={(e) => setCreateForm({ ...createForm, sourcePaths: e.target.value })}
                placeholder="/etc,/home,/var/www"
                className={cn('h-10 w-full rounded-xl border px-3 text-sm text-text-primary placeholder:text-text-disabled outline-none focus:ring-2 focus:ring-primary-500/40',
                  formErrors.sourcePaths ? 'border-danger' : 'border-border bg-surface-subtle')} />
              {formErrors.sourcePaths && <p className="text-xs text-danger mt-1">{formErrors.sourcePaths}</p>}
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Retention (days)</label>
              <input type="number" value={createForm.retention} onChange={(e) => setCreateForm({ ...createForm, retention: parseInt(e.target.value) || 7 })}
                min={1} max={3650}
                className={cn('h-10 w-full rounded-xl border px-3 text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary-500/40',
                  formErrors.retention ? 'border-danger' : 'border-border bg-surface-subtle')} />
              {formErrors.retention && <p className="text-xs text-danger mt-1">{formErrors.retention}</p>}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreateJob} disabled={isCreating}
              className="h-9 px-4 rounded-xl bg-primary-600 hover:bg-primary-500 text-text-primary text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5">
              {isCreating && <Loader2 className="h-3 w-3 animate-spin" />}
              {isCreating ? 'Creating...' : 'Create'}
            </button>
            <button onClick={() => { setShowCreateForm(false); setFormErrors({}); }}
              className="h-9 px-4 rounded-xl border border-border text-text-secondary hover:text-text-secondary text-xs transition-colors">
              Cancel
            </button>
          </div>
        </GlassPanel>
      )}

      {activeTab === 'jobs' && (
        <div className="space-y-4">
          {jobsError && (
            <GlassPanel intensity="light" className="p-4 border border-danger/30">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-danger shrink-0" />
                <p className="text-sm text-danger">{jobsError}</p>
                <button onClick={refetchJobs} className="ml-auto text-xs text-primary hover:underline">Retry</button>
              </div>
            </GlassPanel>
          )}
          {jobsLoading && jobs.length === 0 ? (
            <GlassPanel intensity="light" className="p-12 text-center">
              <Loader2 className="h-6 w-6 text-text-disabled mx-auto animate-spin" />
            </GlassPanel>
          ) : jobs.length === 0 ? (
            <GlassPanel intensity="light" className="p-12 text-center">
              <Database className="h-8 w-8 text-text-disabled mx-auto mb-2" />
              <p className="text-sm text-text-disabled">No backup jobs configured</p>
              <button onClick={() => setShowCreateForm(true)}
                className="mt-4 h-9 px-4 rounded-xl bg-primary-600 hover:bg-primary-500 text-text-primary text-xs font-medium transition-colors">
                Create Your First Job
              </button>
            </GlassPanel>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {jobs.map((job) => (
                <GlassPanel key={job.id} intensity="light" className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary-500/10 flex items-center justify-center shrink-0">
                        <HardDrive className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-medium text-text-primary">{job.name}</h3>
                          <Badge variant={job.isEnabled ? 'success' : 'secondary'} className="text-[10px]">
                            {job.isEnabled ? 'Active' : 'Disabled'}
                          </Badge>
                          <Badge variant="primary" className="text-[10px]">{BACKUP_TYPE_LABELS[job.type] || job.type}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-text-muted">
                          <span>Device: {job.deviceId.slice(0, 8)}...</span>
                          {job.schedule && <span>Schedule: {job.schedule}</span>}
                          <span>Retention: {job.retention}d</span>
                          {job._count && <span>Runs: {job._count.runs}</span>}
                          {job.lastRunAt && <span>Last: {formatDate(job.lastRunAt)}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setTriggerConfirmId(job.id)}
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-text-muted hover:text-primary hover:bg-surface-subtle transition-all"
                        title="Trigger Run">
                        <Play className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleVerifyJob(job.id)}
                        disabled={verifyingJobs.has(job.id)}
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-text-muted hover:text-primary hover:bg-surface-subtle transition-all disabled:opacity-50"
                        title="Verify Latest Archive">
                        {verifyingJobs.has(job.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                      </button>
                      <button onClick={() => setDeleteConfirmId(job.id)}
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-text-muted hover:text-danger hover:bg-surface-subtle transition-all"
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
          {runsError && (
            <GlassPanel intensity="light" className="p-4 border border-danger/30">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-danger shrink-0" />
                <p className="text-sm text-danger">{runsError}</p>
                <button onClick={refetchRuns} className="ml-auto text-xs text-primary hover:underline">Retry</button>
              </div>
            </GlassPanel>
          )}
          {runsLoading && runs.length === 0 ? (
            <GlassPanel intensity="light" className="p-12 text-center">
              <Loader2 className="h-6 w-6 text-text-disabled mx-auto animate-spin" />
            </GlassPanel>
          ) : runs.length === 0 ? (
            <GlassPanel intensity="light" className="p-12 text-center">
              <Activity className="h-8 w-8 text-text-disabled mx-auto mb-2" />
              <p className="text-sm text-text-disabled">No backup runs yet. Trigger a job to see results.</p>
            </GlassPanel>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-surface">
                        <th className="text-left px-4 py-3 text-xs text-text-disabled font-medium uppercase tracking-wider">Status</th>
                        <th className="text-left px-4 py-3 text-xs text-text-disabled font-medium uppercase tracking-wider">Type</th>
                        <th className="text-left px-4 py-3 text-xs text-text-disabled font-medium uppercase tracking-wider">Started</th>
                        <th className="text-left px-4 py-3 text-xs text-text-disabled font-medium uppercase tracking-wider">Duration</th>
                        <th className="text-left px-4 py-3 text-xs text-text-disabled font-medium uppercase tracking-wider">Size</th>
                        <th className="text-left px-4 py-3 text-xs text-text-disabled font-medium uppercase tracking-wider">Files</th>
                        <th className="text-left px-4 py-3 text-xs text-text-disabled font-medium uppercase tracking-wider">Verified</th>
                        <th className="text-left px-4 py-3 text-xs text-text-disabled font-medium uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {runs.map((r) => {
                        const meta = r.metadata as Record<string, unknown> | null;
                        const v = (meta?.verification as any) || {};
                        const verificationStatus: string = v?.status || '';
                        const hasArtifact = !!(meta as any)?.backupPath;
                        return (
                        <tr key={r.id} className="border-b border-border-subtle hover:bg-surface transition-colors">
                          <td className="px-4 py-3">
                            <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium', STATUS_COLORS[r.status] || STATUS_COLORS.pending)}>
                              {r.status === 'running' && <Loader2 className="h-3 w-3 animate-spin" />}
                              {r.status === 'pending' && <Clock className="h-3 w-3" />}
                              {r.status === 'completed' && <CheckCircle className="h-3 w-3" />}
                              {r.status === 'failed' && <XCircle className="h-3 w-3" />}
                              {r.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-text-secondary text-xs">{BACKUP_TYPE_LABELS[r.type] || r.type}</td>
                          <td className="px-4 py-3 text-text-secondary text-xs">{formatDate(r.startedAt)}</td>
                          <td className="px-4 py-3 text-text-secondary text-xs">{formatDuration(r.startedAt, r.completedAt)}</td>
                          <td className="px-4 py-3 text-text-secondary font-mono text-xs">{formatSize(r.sizeBytes)}</td>
                          <td className="px-4 py-3 text-text-secondary text-xs">{r.fileCount ?? '-'}</td>
                          <td className="px-4 py-3 text-xs">
                            {verificationStatus === 'Verified' ? (
                              <span className="text-success flex items-center gap-1"><CheckCircle className="h-3 w-3" />Verified</span>
                            ) : verificationStatus === 'Corrupted' ? (
                              <span className="text-danger flex items-center gap-1"><XCircle className="h-3 w-3" />Corrupted</span>
                            ) : verificationStatus === 'Verification Failed' ? (
                              <span className="text-danger flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Failed</span>
                            ) : r.status === 'completed' ? (
                              <span className="text-text-muted">Pending</span>
                            ) : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              {r.status === 'completed' && hasArtifact && (
                                <button onClick={() => handleDownloadArtifact(r.id)}
                                  className="h-7 w-7 rounded-lg flex items-center justify-center text-text-muted hover:text-cyan-400 hover:bg-surface-subtle transition-all"
                                  title="Download Artifact">
                                  <Download className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {r.status === 'completed' && verificationStatus !== 'Verified' && (
                                <button onClick={() => handleVerifyJob(r.jobId)}
                                  className="h-7 w-7 rounded-lg flex items-center justify-center text-text-muted hover:text-primary hover:bg-surface-subtle transition-all"
                                  title="Verify Artifact">
                                  <Shield className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
              {hasActiveRun && (
                <div className="px-4 py-2 border-t border-border-subtle bg-surface-muted/50 flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin text-primary" />
                  <span className="text-xs text-text-muted">Active runs detected — auto-refreshing...</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'restore' && (
        <div className="space-y-4">
          {pointsError && (
            <GlassPanel intensity="light" className="p-4 border border-danger/30">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-danger shrink-0" />
                <p className="text-sm text-danger">{pointsError}</p>
              </div>
            </GlassPanel>
          )}
          {!wizardOpen ? (
            <GlassPanel intensity="light" className="p-8 text-center">
              <RefreshCw className="h-10 w-10 text-text-disabled mx-auto mb-3" />
              <h3 className="text-base font-medium text-text-secondary mb-1">Recovery Wizard</h3>
              <p className="text-sm text-text-disabled mb-4">Select a device to begin the guided restore process.</p>
              {jobDevices.length === 0 ? (
                <p className="text-xs text-text-disabled">No backup jobs found. Create a job first.</p>
              ) : (
                <div className="flex flex-wrap justify-center gap-2">
                  {jobDevices.map((did) => (
                    <button key={did} onClick={() => startWizard(did)}
                      className="px-4 py-2 rounded-xl bg-primary-600/20 text-primary text-sm hover:bg-primary-600/30 transition-colors">
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
                    <div className="h-7 w-7 rounded-full bg-primary-600/20 text-primary flex items-center justify-center text-xs font-bold">1</div>
                    <span className="text-sm font-medium text-text-primary">Select Restore Point</span>
                  </div>
                  {pointsLoading ? (
                    <div className="flex items-center gap-2 text-text-disabled text-sm py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading restore points...
                    </div>
                  ) : points.length === 0 ? (
                    <div className="py-4 text-center">
                      <AlertTriangle className="h-6 w-6 text-warning mx-auto mb-2" />
                      <p className="text-sm text-text-muted">No completed backup runs found for this device.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto mb-5">
                      {points.map((p) => {
                        const meta = p.metadata as Record<string, unknown> | null;
                        const checksum = meta?.checksum as string | null;
                        const v = meta?.verification ? (meta.verification as any) : null;
                        const verificationStatus: string = v?.status || '';
                        return (
                          <button key={p.id} onClick={() => setSelectedRunId(p.id)}
                            className={cn(
                              'w-full text-left p-3 rounded-xl border transition-all',
                              selectedRunId === p.id
                                ? 'border-primary-500/40 bg-primary-500/10'
                                : 'border-border bg-surface hover:bg-surface-subtle',
                            )}>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-text-primary font-medium">{p.job?.name || p.type} backup</p>
                                <p className="text-xs text-text-muted mt-0.5">{formatDate(p.startedAt)}</p>
                              </div>
                              <div className="text-right text-xs text-text-muted">
                                <p>{formatSize(p.sizeBytes)}</p>
                                <p>{p.fileCount ?? '-'} files</p>
                                {verificationStatus === 'Verified' && <p className="text-success">Verified</p>}
                                {verificationStatus === 'Corrupted' && <p className="text-danger">Corrupted</p>}
                                {checksum && <p className="font-mono text-[10px]">{checksum.slice(0, 12)}...</p>}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => setWizardOpen(false)}
                      className="h-9 px-4 rounded-xl border border-border text-text-secondary hover:text-text-secondary text-xs transition-colors flex items-center gap-1.5">
                      <ChevronLeft className="h-3.5 w-3.5" /> Cancel
                    </button>
                    <button onClick={() => setWizardStep('review')} disabled={!selectedRunId}
                      className="h-9 px-4 rounded-xl bg-primary-600 hover:bg-primary-500 text-text-primary text-xs font-medium transition-colors disabled:opacity-40 flex items-center gap-1.5">
                      Next <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {wizardStep === 'review' && (
                <div>
                  <div className="flex items-center gap-2 mb-5">
                    <div className="h-7 w-7 rounded-full bg-green-500/20 text-success flex items-center justify-center text-xs font-bold">&#10003;</div>
                    <div className="h-7 w-7 rounded-full bg-primary-600/20 text-primary flex items-center justify-center text-xs font-bold">2</div>
                    <span className="text-sm font-medium text-text-primary">Review & Confirm</span>
                  </div>
                  <div className="rounded-xl bg-surface-subtle border border-border p-4 mb-5 space-y-2">
                    <div className="flex justify-between text-sm"><span className="text-text-muted">Restore Point:</span><span className="text-text-primary">{selectedRunId ? selectedRunId.slice(0, 8) : 'N/A'}...</span></div>
                    <div className="flex justify-between text-sm"><span className="text-text-muted">Device:</span><span className="text-text-primary">{selectedDeviceId.slice(0, 12)}...</span></div>
                    <div className="flex justify-between text-sm"><span className="text-text-muted">Operation:</span><span className="text-text-primary">Non-destructive restore to recovery directory</span></div>
                    <div className="flex justify-between text-sm"><span className="text-text-muted">Overwrite existing:</span><span className="text-success">No (safe mode, copies to recovery_*/)</span></div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setWizardStep('select-point')}
                      className="h-9 px-4 rounded-xl border border-border text-text-secondary hover:text-text-secondary text-xs transition-colors flex items-center gap-1.5">
                      <ChevronLeft className="h-3.5 w-3.5" /> Back
                    </button>
                    <button onClick={executeRestore}
                      className="h-9 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-text-primary text-xs font-medium transition-colors flex items-center gap-1.5">
                      Start Safe Restore <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {wizardStep === 'executing' && (
                <div className="py-8 text-center">
                  <Loader2 className="h-10 w-10 text-primary mx-auto mb-4 animate-spin" />
                  <h3 className="text-base font-medium text-text-primary">Executing Restore</h3>
                  <p className="text-sm text-text-muted mt-1">Restoring to recovery directory...</p>
                  <div className="mt-6 h-2 w-full max-w-sm mx-auto rounded-full bg-surface-muted overflow-hidden">
                    <div className="h-full w-2/3 rounded-full bg-primary-500 animate-pulse" />
                  </div>
                </div>
              )}

              {wizardStep === 'result' && (
                <div className="py-8 text-center">
                  {restoreResult?.status === 'queued' || restoreResult?.status === 'success' ? (
                    <>
                      <CheckCircle className="h-12 w-12 text-success mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-text-primary">Restore Queued</h3>
                      <p className="text-sm text-text-muted mt-1">{restoreResult.message || 'Restore job has been queued and will execute shortly.'}</p>
                      <div className="mt-4 rounded-xl bg-surface-subtle border border-border p-4 text-left max-w-sm mx-auto space-y-1 text-xs text-text-secondary">
                        <p>Run ID: {restoreResult.runId?.slice(0, 8) ?? 'N/A'}...</p>
                        <p>Type: {restoreResult.type ?? 'N/A'}</p>
                        <p>Destination: {restoreResult.details?.destination ?? 'N/A'}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-12 w-12 text-danger mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-text-primary">Restore Failed</h3>
                      <p className="text-sm text-danger/80 mt-1">{restoreResult?.message || 'Unknown error'}</p>
                    </>
                  )}
                  <button onClick={() => { setWizardOpen(false); setWizardStep('select-point'); }}
                    className="mt-6 h-9 px-4 rounded-xl bg-primary-600 hover:bg-primary-500 text-text-primary text-xs font-medium transition-colors">
                    Close Wizard
                  </button>
                </div>
              )}
            </GlassPanel>
          )}
        </div>
      )}

      <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Backup Job</DialogTitle>
            <DialogDescription>
              This will permanently delete this backup job and all its run history. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setDeleteConfirmId(null)}
              className="h-9 px-4 rounded-xl border border-border text-text-secondary text-xs transition-colors">
              Cancel
            </button>
            <button onClick={() => deleteConfirmId && handleDeleteJob(deleteConfirmId)}
              className="h-9 px-4 rounded-xl bg-danger hover:bg-danger/80 text-white text-xs font-medium transition-colors flex items-center gap-1.5">
              <Trash2 className="h-3.5 w-3.5" /> Delete Job
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={triggerConfirmId !== null} onOpenChange={(open) => { if (!open) { setTriggerConfirmId(null); triggerRef.current = false; } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trigger Backup Run</DialogTitle>
            <DialogDescription>
              Start a new backup run now. A backup will be performed using the job&apos;s current configuration.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => { setTriggerConfirmId(null); triggerRef.current = false; }}
              className="h-9 px-4 rounded-xl border border-border text-text-secondary text-xs transition-colors">
              Cancel
            </button>
            <button onClick={() => triggerConfirmId && handleTriggerJob(triggerConfirmId)}
              className="h-9 px-4 rounded-xl bg-primary-600 hover:bg-primary-500 text-text-primary text-xs font-medium transition-colors flex items-center gap-1.5">
              <Play className="h-3.5 w-3.5" /> Run Now
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
