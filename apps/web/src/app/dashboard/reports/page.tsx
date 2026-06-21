'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { GlassPanel, Badge, Button } from '@techfusion/ui';
import { BarChart3, FileText, Download, Plus, Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useReports } from '@/hooks/useReports';

export default function ReportsPage() {
  const { reports, loading, generating, refetch, generateReport } = useReports();
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('health');
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!newTitle.trim()) return;
    setError('');
    try {
      await generateReport(newTitle.trim(), newType);
      setShowCreate(false);
      setNewTitle('');
      setNewType('health');
    } catch {
      setError('Failed to generate report. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Reports</h1>
          <p className="text-sm text-white/40 mt-1">Analytics and reporting dashboards.</p>
        </div>
        <Button variant="glass" size="sm" onClick={() => setShowCreate(!showCreate)} disabled={generating}>
          {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
          Generate Report
        </Button>
      </motion.div>

      {showCreate && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <GlassPanel intensity="light" className="p-5">
            <h3 className="text-sm font-medium text-white mb-4">New Report</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs text-white/40 mb-1">Report Title</label>
                <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Monthly health report"
                  className="h-10 w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-white outline-none focus:ring-2 focus:ring-primary-500/40" />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1">Type</label>
                <select value={newType} onChange={(e) => setNewType(e.target.value)}
                  className="h-10 w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-white outline-none focus:ring-2 focus:ring-primary-500/40">
                  <option value="health">Device Health</option>
                  <option value="security">Security</option>
                  <option value="performance">Performance</option>
                  <option value="compliance">Compliance</option>
                  <option value="custom">Custom</option>
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
            {error && <p className="text-xs text-red-400">{error}</p>}
          </GlassPanel>
        </motion.div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-white/[0.04] animate-pulse" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <GlassPanel intensity="light" className="p-12 flex flex-col items-center justify-center text-center">
          <BarChart3 className="h-12 w-12 text-white/20 mb-4" />
          <h3 className="text-lg font-medium text-white/50">No reports yet</h3>
          <p className="text-sm text-white/30 mt-1 max-w-md">
            Generate your first report to get insights about your devices and infrastructure.
          </p>
          <Button variant="glass" size="sm" className="mt-4" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" /> Generate Report
          </Button>
        </GlassPanel>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reports.map((report) => (
            <motion.div key={report.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <GlassPanel intensity="light" className="p-5 glass-card-hover">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary-500/10 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-primary-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-white">{report.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="primary" className="text-[10px]">{report.type}</Badge>
                        <Badge variant={report.status === 'completed' ? 'success' : report.status === 'generating' ? 'warning' : 'secondary'} className="text-[10px]">
                          {report.status === 'generating' ? <Loader2 className="h-3 w-3 mr-0.5 animate-spin" /> : null}
                          {report.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-white/30 mt-1.5">
                        Created {new Date(report.createdAt).toLocaleDateString()}
                        {report.completedAt && <> &middot; Completed {new Date(report.completedAt).toLocaleDateString()}</>}
                      </p>
                    </div>
                  </div>
                  {report.fileUrl && (
                    <a href={report.fileUrl} target="_blank" rel="noopener noreferrer"
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-white/40 hover:text-primary-400 hover:bg-white/[0.04] transition-all">
                      <Download className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </GlassPanel>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
