'use client';

import { GlassPanel } from '@techfusion/ui';
import { Activity } from 'lucide-react';

export default function DeviceHealthPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-white tracking-tight">Device Health</h1>
        <p className="text-sm text-white/40 mt-1">Monitor the health and performance of all managed devices.</p>
      </div>
      <GlassPanel intensity="light" className="p-12 flex flex-col items-center justify-center text-center">
        <Activity className="h-12 w-12 text-white/20 mb-4" />
        <h3 className="text-lg font-medium text-white/50">Device Health Module</h3>
        <p className="text-sm text-white/30 mt-1 max-w-md">
          Real-time health monitoring, performance metrics, and predictive diagnostics will appear here.
        </p>
      </GlassPanel>
    </div>
  );
}
