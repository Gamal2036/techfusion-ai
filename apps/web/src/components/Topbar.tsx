'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronDown,
  Command,
  LogOut,
  User,
  Building2,
  MessageSquare,
  Moon,
  Sun,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@techfusion/ui';
import { logout } from '@/lib/auth-client';

interface TopbarProps {
  onToggleChat: () => void;
  onOpenPalette: () => void;
  userName?: string;
  userRole?: string;
  orgName?: string;
}

export function Topbar({ onToggleChat, onOpenPalette, userName, userRole, orgName }: TopbarProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);

  async function handleLogout() {
    await logout();
  }

  return (
    <header className="flex items-center justify-between h-14 px-4 border-b border-border bg-background/80 backdrop-blur-xl z-20">
      <div className="flex items-center gap-3">
        <DropdownMenu open={orgMenuOpen} onOpenChange={setOrgMenuOpen}>
          <DropdownMenuTrigger className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">{orgName || 'My Organization'}</span>
            <ChevronDown className="h-3.5 w-3.5 transition-transform data-[state=open]:rotate-180" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={4}>
            <DropdownMenuLabel>Switch Organization</DropdownMenuLabel>
            <DropdownMenuItem>
              <Building2 className="h-4 w-4 mr-2" />
              {orgName || 'My Organization'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onOpenPalette}
          className="hidden sm:flex items-center gap-2 h-8 px-3 rounded-lg border border-border bg-surface-subtle text-xs text-text-muted hover:text-text-secondary hover:bg-surface-muted transition-all"
        >
          <Command className="h-3.5 w-3.5" />
          <span>Quick navigation...</span>
          <kbd className="ml-2 px-1.5 py-0.5 rounded bg-surface-muted text-[10px] text-text-muted">⌘K</kbd>
        </button>

        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="h-8 w-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-secondary hover:bg-surface-subtle transition-all"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <button
          onClick={onToggleChat}
          className="h-8 w-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-secondary hover:bg-surface-subtle transition-all"
        >
          <MessageSquare className="h-4 w-4" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 h-8 px-2 rounded-lg hover:bg-surface-subtle transition-all">
            <div className="h-7 w-7 rounded-full bg-primary-600/20 border border-primary-500/30 flex items-center justify-center">
              <span className="text-xs font-medium text-primary">
                {(userName || 'U').charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="hidden sm:block text-sm text-text-secondary max-w-[120px] truncate">
              {userName || 'User'}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={4}>
            <DropdownMenuLabel>
              <div>
                <p className="text-sm text-text-primary">{userName || 'User'}</p>
                <p className="text-xs text-text-muted capitalize">{userRole || 'Viewer'}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/dashboard/settings')}>
              <User className="h-4 w-4 mr-2" />
              Profile & Settings
            </DropdownMenuItem>
            <DropdownMenuItem destructive onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
