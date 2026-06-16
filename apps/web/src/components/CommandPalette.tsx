'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import {
  LayoutDashboard,
  Activity,
  Shield,
  Network,
  Monitor,
  Cpu,
  HardDrive,
  MessageSquare,
  BookOpen,
  BarChart3,
  CreditCard,
  Settings,
  Command as CommandIcon,
} from 'lucide-react';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

const pages = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Device Health', href: '/dashboard/device-health', icon: Activity },
  { label: 'Monitoring', href: '/dashboard/monitoring', icon: Monitor },
  { label: 'Cybersecurity', href: '/dashboard/cybersecurity', icon: Shield },
  { label: 'Network', href: '/dashboard/network', icon: Network },
  { label: 'Remote Support', href: '/dashboard/remote-support', icon: Monitor },
  { label: 'Drivers / Software', href: '/dashboard/drivers', icon: Cpu },
  { label: 'Backup', href: '/dashboard/backup', icon: HardDrive },
  { label: 'AI Chat', href: '/dashboard/ai-chat', icon: MessageSquare },
  { label: 'Knowledge Base', href: '/dashboard/knowledge-base', icon: BookOpen },
  { label: 'Reports', href: '/dashboard/reports', icon: BarChart3 },
  { label: 'Billing', href: '/dashboard/billing', icon: CreditCard },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();

  const handleSelect = useCallback(
    (href: string) => {
      router.push(href);
      onClose();
    },
    [router, onClose],
  );

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (open) onClose();
      }
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-[90vw] max-w-[560px]">
        <Command className="rounded-2xl border border-white/[0.06] bg-surface-950/95 backdrop-blur-2xl shadow-dialog overflow-hidden">
          <div className="flex items-center border-b border-white/[0.06] px-4">
            <CommandIcon className="h-4 w-4 text-white/30 mr-3 shrink-0" />
            <Command.Input
              placeholder="Search pages..."
              className="flex-1 h-12 bg-transparent text-sm text-white placeholder:text-white/30 outline-none border-0"
              autoFocus
            />
            <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-white/30">ESC</kbd>
          </div>
          <Command.List className="max-h-[300px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-white/40">
              No results found.
            </Command.Empty>
            <Command.Group heading="Navigation" className="text-xs text-white/30 px-2 py-1.5">
              {pages.map((page) => {
                const Icon = page.icon;
                return (
                  <Command.Item
                    key={page.href}
                    value={page.label}
                    onSelect={() => handleSelect(page.href)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/70 cursor-pointer aria-selected:bg-primary-600/15 aria-selected:text-primary-300 transition-colors"
                  >
                    <Icon className="h-4 w-4" />
                    <span>{page.label}</span>
                  </Command.Item>
                );
              })}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
