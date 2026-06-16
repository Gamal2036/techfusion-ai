'use client';

import { GlassPanel, CardHeader, CardTitle, CardContent } from '@techfusion/ui';
import { Settings, User, Bell, Palette, Key } from 'lucide-react';

const settingsSections = [
  { label: 'Profile', icon: User, desc: 'Manage your personal information and preferences' },
  { label: 'Notifications', icon: Bell, desc: 'Configure alert and notification channels' },
  { label: 'Appearance', icon: Palette, desc: 'Customize theme and display settings' },
  { label: 'API Keys', icon: Key, desc: 'Manage API tokens and integrations' },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-white tracking-tight">Settings</h1>
        <p className="text-sm text-white/40 mt-1">Manage your account and application preferences.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {settingsSections.map((section) => {
          const Icon = section.icon;
          return (
            <button
              key={section.label}
              className="flex items-start gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 text-left hover:bg-white/[0.04] transition-all"
            >
              <div className="h-10 w-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0">
                <Icon className="h-5 w-5 text-primary-400" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-white">{section.label}</h3>
                <p className="text-xs text-white/40 mt-1">{section.desc}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
