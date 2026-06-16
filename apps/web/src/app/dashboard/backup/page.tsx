'use client';

import { GlassPanel } from '@techfusion/ui';
import { HardDrive } from 'lucide-react';

export default function BackupPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-white tracking-tight">Backup</h1>
        <p className="text-sm text-white/40 mt-1">Backup scheduling and recovery management.</p>
      </div>
      <GlassPanel intensity="light" className="p-12 flex flex-col items-center justify-center text-center">
        <HardDrive className="h-12 w-12 text-white/20 mb-4" />
        <h3 className="text-lg font-medium text-white/50">Backup Module</h3>
        <p className="text-sm text-white/30 mt-1 max-w-md">
          Automated backup schedules, restore points, and disaster recovery planning.
        </p>
      </GlassPanel>
    </div>
  );
}
