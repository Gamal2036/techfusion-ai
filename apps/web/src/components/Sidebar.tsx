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
  Users,
  Key,
  UserCog,
} from 'lucide-react';
import { cn } from '@techfusion/ui';
import { getCurrentUser, type JwtPayload } from '@/lib/auth-client';
import { can, Permission, type ClientPermission } from '@/lib/permissions';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  permissions?: ClientPermission[];
}

const allNavItems: NavItem[] = [
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
  { label: 'Billing', href: '/dashboard/billing', icon: <CreditCard className="h-5 w-5" />, permissions: [Permission.BILLING_VIEW] },
  { label: 'Team', href: '/dashboard/team', icon: <Users className="h-5 w-5" />, permissions: [Permission.MEMBERS_VIEW] },
  { label: 'Enrollment', href: '/dashboard/settings/enrollment', icon: <Key className="h-5 w-5" />, permissions: [Permission.DEVICES_ENROLL] },
  { label: 'Settings', href: '/dashboard/settings', icon: <Settings className="h-5 w-5" /> },
  { label: 'Account', href: '/dashboard/settings/account', icon: <UserCog className="h-5 w-5" /> },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<JwtPayload | null>(null);

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

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

  const navItems = allNavItems.filter((item) => {
    if (!item.permissions) return true;
    return can(user, ...item.permissions);
  });

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-border bg-background transition-all duration-300 ease-in-out relative z-30',
        collapsed ? 'w-[68px]' : 'w-60',
      )}
    >
      <div className={cn('flex items-center h-14 border-b border-border px-4', collapsed && 'justify-center')}>
        {!collapsed && (
          <span className="text-sm font-semibold tracking-tight text-text-primary">
            TechFusion AI
          </span>
        )}
        {collapsed && (
          <span className="text-sm font-bold text-primary">TF</span>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map((item) => {
          const isActive = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150 group relative',
                collapsed && 'justify-center px-2',
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface-subtle',
              )}
              title={collapsed ? item.label : undefined}
            >
              <span className={cn(isActive && 'text-primary')}>{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
              {isActive && !collapsed && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 w-1 h-4 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'flex items-center gap-2 w-full rounded-lg px-3 py-2 text-xs text-text-muted hover:text-text-secondary hover:bg-surface-subtle transition-all',
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
