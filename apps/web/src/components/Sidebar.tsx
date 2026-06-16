'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@techfusion/ui';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
  { label: 'Device Health', href: '/dashboard/device-health', icon: <Activity className="h-5 w-5" /> },
  { label: 'Monitoring', href: '/dashboard/monitoring', icon: <Monitor className="h-5 w-5" /> },
  { label: 'Cybersecurity', href: '/dashboard/cybersecurity', icon: <Shield className="h-5 w-5" /> },
  { label: 'Network', href: '/dashboard/network', icon: <Network className="h-5 w-5" /> },
  { label: 'Remote Support', href: '/dashboard/remote-support', icon: <Monitor className="h-5 w-5" /> },
  { label: 'Drivers/Software', href: '/dashboard/drivers', icon: <Cpu className="h-5 w-5" /> },
  { label: 'Backup', href: '/dashboard/backup', icon: <HardDrive className="h-5 w-5" /> },
  { label: 'AI Chat', href: '/dashboard/ai-chat', icon: <MessageSquare className="h-5 w-5" /> },
  { label: 'Knowledge Base', href: '/dashboard/knowledge-base', icon: <BookOpen className="h-5 w-5" /> },
  { label: 'Reports', href: '/dashboard/reports', icon: <BarChart3 className="h-5 w-5" /> },
  { label: 'Billing', href: '/dashboard/billing', icon: <CreditCard className="h-5 w-5" /> },
  { label: 'Settings', href: '/dashboard/settings', icon: <Settings className="h-5 w-5" /> },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setCollapsed(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-white/[0.06] bg-background transition-all duration-300 ease-in-out relative z-30',
        collapsed ? 'w-[68px]' : 'w-60',
      )}
    >
      <div className={cn('flex items-center h-14 border-b border-white/[0.06] px-4', collapsed && 'justify-center')}>
        {!collapsed && (
          <span className="text-sm font-semibold tracking-tight text-white">
            TechFusion AI
          </span>
        )}
        {collapsed && (
          <span className="text-sm font-bold text-primary-400">TF</span>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150 group relative',
                collapsed && 'justify-center px-2',
                isActive
                  ? 'bg-primary-600/15 text-primary-300 font-medium'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/[0.03]',
              )}
              title={collapsed ? item.label : undefined}
            >
              <span className={cn(isActive && 'text-primary-400')}>{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
              {isActive && !collapsed && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 w-1 h-4 rounded-full bg-primary-500" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/[0.06] p-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'flex items-center gap-2 w-full rounded-lg px-3 py-2 text-xs text-white/40 hover:text-white/70 hover:bg-white/[0.03] transition-all',
            collapsed && 'justify-center px-2',
          )}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
