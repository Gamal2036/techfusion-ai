'use client';

import { GlassPanel } from '@techfusion/ui';
import { Monitor } from 'lucide-react';

export default function MonitoringPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-white tracking-tight">Monitoring</h1>
        <p className="text-sm text-white/40 mt-1">System-wide monitoring dashboards and metrics.</p>
      </div>
      <GlassPanel intensity="light" className="p-12 flex flex-col items-center justify-center text-center">
        <Monitor className="h-12 w-12 text-white/20 mb-4" />
        <h3 className="text-lg font-medium text-white/50">Monitoring Module</h3>
        <p className="text-sm text-white/30 mt-1 max-w-md">
          Real-time metrics, graphs, and alerts for CPU, memory, disk, and network utilization.
        </p>
      </GlassPanel>
    </div>
  );
}
