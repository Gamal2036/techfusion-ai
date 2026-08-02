'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { GlassPanel, Badge, Button, Skeleton, EmptyState } from '@techfusion/ui';
import { BarChart3, FileText, Download, Plus, Loader2, AlertTriangle, Trash2 } from 'lucide-react';
import { useReports } from '@/hooks/useReports';
import { getApiUrl } from '@/lib/auth-client';
import type { ReportType, ReportFormat } from '@techfusion/types';
import { ScheduledReportsSection } from './ScheduledReportsSection';

const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: 'device_health', label: 'Device Health' },
  { value: 'security_executive', label: 'Security Executive' },
  { value: 'fleet_summary', label: 'Fleet Summary' },
  { value: 'network', label: 'Network' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'remote_support', label: 'Remote Support' },
];

const REPORT_FORMATS: { value: ReportFormat; label: string }[] = [
  { value: 'pdf', label: 'PDF' },
  { value: 'docx', label: 'DOCX' },
  { value: 'html', label: 'HTML' },
  { value: 'csv', label: 'CSV' },
  { value: 'json', label: 'JSON' },
];

export default function ReportsPage() {
  const { reports, loading, generating, error, refetch, generateReport, deleteReport } = useReports();
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<ReportType>('device_health');
  const [newFormat, setNewFormat] = useState<ReportFormat>('pdf');
  const [generateAiSummary, setGenerateAiSummary] = useState(false);

  const handleGenerate = async () => {
    if (!newTitle.trim()) return;
    try {
      await generateReport(newType, newFormat, {
        title: newTitle.trim(),
        generateAiSummary,
      });
      setShowCreate(false);
      setNewTitle('');
    } catch {
      // Error is set by the hook
    }
  };

  const buildDownloadUrl = (signedUrl: string | null) => {
    if (!signedUrl) return null;
    if (signedUrl.startsWith('http')) return signedUrl;
    return `${getApiUrl()}${signedUrl}`;
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary tracking-tight">Reports</h1>
          <p className="text-sm text-text-muted mt-1">Analytics and reporting dashboards.</p>
        </div>
        <Button variant="glass" size="sm" onClick={() => setShowCreate(!showCreate)} disabled={generating}>
          {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
          Generate Report
        </Button>
      </motion.div>

      {error && (
        <GlassPanel intensity="light" className="p-4 border-red-500/30">
          <div className="flex items-center gap-2 text-sm text-danger">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error.message}</span>
            {error.code === 'SECURITY_SCAN_REQUIRED' && (
              <Link href="/dashboard/cybersecurity" className="ml-1 text-primary hover:text-primary-300 underline underline-offset-2 transition-colors">
                Go to Cybersecurity
              </Link>
            )}
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => refetch()}>Retry</Button>
          </div>
        </GlassPanel>
      )}

      {showCreate && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <GlassPanel intensity="light" className="p-5">
            <h3 className="text-sm font-medium text-text-primary mb-4">New Report</h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-xs text-text-muted mb-1">Report Title</label>
                <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Monthly health report"
                  className="h-10 w-full rounded-xl border border-border bg-surface-subtle px-3 text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary-500/40" />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Type</label>
                <select value={newType} onChange={(e) => setNewType(e.target.value as ReportType)}
                  className="h-10 w-full rounded-xl border border-border bg-surface-subtle px-3 text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary-500/40">
                  {REPORT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Format</label>
                <select value={newFormat} onChange={(e) => setNewFormat(e.target.value as ReportFormat)}
                  className="h-10 w-full rounded-xl border border-border bg-surface-subtle px-3 text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary-500/40">
                  {REPORT_FORMATS.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <Button variant="glass" size="sm" onClick={handleGenerate} disabled={!newTitle.trim() || generating}>
                  {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}
                  Generate
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={generateAiSummary}
                onChange={(e) => setGenerateAiSummary(e.target.checked)}
                className="rounded border-border-strong bg-surface-subtle text-primary-500 focus:ring-primary-500/40"
              />
              Include AI executive summary
            </label>
          </GlassPanel>
        </motion.div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <EmptyState
          icon={<BarChart3 className="h-12 w-12" />}
          title="No reports yet"
          description="Generate your first report to get insights about your devices and infrastructure."
          primaryAction={{
            label: 'Generate Report',
            onClick: () => setShowCreate(true),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reports.map((report) => (
            <motion.div key={report.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <GlassPanel intensity="light" className="p-5 glass-card-hover">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary-500/10 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-text-primary">{report.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="primary" className="text-[10px]">{report.type.replace(/_/g, ' ')}</Badge>
                        <Badge variant={report.status === 'completed' ? 'success' : report.status === 'generating' ? 'warning' : 'secondary'} className="text-[10px]">
                          {report.status === 'generating' ? <Loader2 className="h-3 w-3 mr-0.5 animate-spin" /> : null}
                          {report.status}
                        </Badge>
                        {report.aiGenerated && (
                          <Badge variant="secondary" className="text-[10px]">AI</Badge>
                        )}
                      </div>
                      <p className="text-xs text-text-disabled mt-1.5">
                        Created {new Date(report.createdAt).toLocaleDateString()}
                        {report.completedAt && <> &middot; Completed {new Date(report.completedAt).toLocaleDateString()}</>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => {
                      if (window.confirm('Delete this report?')) {
                        deleteReport(report.id);
                      }
                    }}
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-text-muted hover:text-danger hover:bg-surface-subtle transition-all">
                      <Trash2 className="h-4 w-4" />
                    </button>
                    {report.signedUrl && (
                      <a href={buildDownloadUrl(report.signedUrl) || '#'} target="_blank" rel="noopener noreferrer"
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-text-muted hover:text-primary hover:bg-surface-subtle transition-all">
                        <Download className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              </GlassPanel>
            </motion.div>
          ))}
        </div>
      )}

      <ScheduledReportsSection />
    </div>
  );
}
