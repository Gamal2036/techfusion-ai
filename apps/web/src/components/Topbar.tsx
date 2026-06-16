'use client';

import { useState, useRef, useEffect } from 'react';
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
import { cn } from '@techfusion/ui';

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
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const orgMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (orgMenuRef.current && !orgMenuRef.current.contains(e.target as Node)) {
        setOrgMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleLogout() {
    const token = localStorage.getItem('accessToken');
    if (token) {
      await fetch('http://localhost:3001/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      }).catch(() => {});
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    router.push('/login');
  }

  return (
    <header className="flex items-center justify-between h-14 px-4 border-b border-white/[0.06] bg-background/80 backdrop-blur-xl z-20">
      <div className="flex items-center gap-3">
        <div className="relative" ref={orgMenuRef}>
          <button
            onClick={() => setOrgMenuOpen(!orgMenuOpen)}
            className="flex items-center gap-2 text-sm text-white/60 hover:text-white/80 transition-colors"
          >
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">{orgName || 'My Organization'}</span>
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', orgMenuOpen && 'rotate-180')} />
          </button>
          {orgMenuOpen && (
            <div className="absolute top-full left-0 mt-1 w-56 rounded-xl border border-white/[0.06] bg-surface-950 backdrop-blur-2xl shadow-dialog py-1 z-50">
              <div className="px-3 py-2 text-xs text-white/40 border-b border-white/[0.06]">
                Switch Organization
              </div>
              <button className="w-full px-3 py-2 text-left text-sm text-white/70 hover:bg-white/[0.04] flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                {orgName || 'My Organization'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onOpenPalette}
          className="hidden sm:flex items-center gap-2 h-8 px-3 rounded-lg border border-white/[0.06] bg-white/[0.02] text-xs text-white/40 hover:text-white/60 hover:bg-white/[0.04] transition-all"
        >
          <Command className="h-3.5 w-3.5" />
          <span>Quick navigation...</span>
          <kbd className="ml-2 px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-white/30">⌘K</kbd>
        </button>

        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="h-8 w-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-all"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <button
          onClick={onToggleChat}
          className="h-8 w-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-all"
        >
          <MessageSquare className="h-4 w-4" />
        </button>

        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 h-8 px-2 rounded-lg hover:bg-white/[0.04] transition-all"
          >
            <div className="h-7 w-7 rounded-full bg-primary-600/20 border border-primary-500/30 flex items-center justify-center">
              <span className="text-xs font-medium text-primary-400">
                {(userName || 'U').charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="hidden sm:block text-sm text-white/70 max-w-[120px] truncate">
              {userName || 'User'}
            </span>
            <ChevronDown className={cn('h-3.5 w-3.5 text-white/40 transition-transform', userMenuOpen && 'rotate-180')} />
          </button>
          {userMenuOpen && (
            <div className="absolute top-full right-0 mt-1 w-56 rounded-xl border border-white/[0.06] bg-surface-950 backdrop-blur-2xl shadow-dialog py-1 z-50">
              <div className="px-3 py-2 border-b border-white/[0.06]">
                <p className="text-sm text-white">{userName || 'User'}</p>
                <p className="text-xs text-white/40 capitalize">{userRole || 'Viewer'}</p>
              </div>
              <button
                onClick={() => { router.push('/dashboard/settings'); setUserMenuOpen(false); }}
                className="w-full px-3 py-2 text-left text-sm text-white/70 hover:bg-white/[0.04] flex items-center gap-2"
              >
                <User className="h-4 w-4" />
                Profile & Settings
              </button>
              <button
                onClick={handleLogout}
                className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-white/[0.04] flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
