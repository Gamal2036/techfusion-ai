'use client';

import { GlassPanel } from '@techfusion/ui';
import { BarChart3 } from 'lucide-react';

export default function ReportsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-white tracking-tight">Reports</h1>
        <p className="text-sm text-white/40 mt-1">Analytics and reporting dashboards.</p>
      </div>
      <GlassPanel intensity="light" className="p-12 flex flex-col items-center justify-center text-center">
        <BarChart3 className="h-12 w-12 text-white/20 mb-4" />
        <h3 className="text-lg font-medium text-white/50">Reports Module</h3>
        <p className="text-sm text-white/30 mt-1 max-w-md">
          Custom reports, scheduled exports, and compliance documentation.
        </p>
      </GlassPanel>
    </div>
  );
}
