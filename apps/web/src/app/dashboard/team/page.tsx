'use client';

import { GlassPanel } from '@techfusion/ui';
import { Users } from 'lucide-react';

export default function TeamPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-white tracking-tight">Team</h1>
        <p className="text-sm text-white/40 mt-1">Manage your team members and their roles.</p>
      </div>
      <GlassPanel intensity="light" className="p-12 flex flex-col items-center justify-center text-center">
        <Users className="h-12 w-12 text-white/20 mb-4" />
        <h3 className="text-lg font-medium text-white/50">Team Management</h3>
        <p className="text-sm text-white/30 mt-1 max-w-md">
          Invite team members, assign roles, and manage permissions across your organization.
        </p>
      </GlassPanel>
    </div>
  );
}
