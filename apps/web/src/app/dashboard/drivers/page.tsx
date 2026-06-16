'use client';

import { GlassPanel } from '@techfusion/ui';
import { Cpu } from 'lucide-react';

export default function DriversPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-white tracking-tight">Drivers &amp; Software</h1>
        <p className="text-sm text-white/40 mt-1">Driver and software version management.</p>
      </div>
      <GlassPanel intensity="light" className="p-12 flex flex-col items-center justify-center text-center">
        <Cpu className="h-12 w-12 text-white/20 mb-4" />
        <h3 className="text-lg font-medium text-white/50">Drivers &amp; Software Module</h3>
        <p className="text-sm text-white/30 mt-1 max-w-md">
          Driver updates, software inventory, patch management, and compliance reports.
        </p>
      </GlassPanel>
    </div>
  );
}
