'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { CommandPalette } from '@/components/CommandPalette';
import { AiChatDrawer } from '@/components/AiChatDrawer';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.push('/login');
      return;
    }
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setUser(payload);
    } catch {
      router.push('/login');
    }
  }, [router]);

  const handleOpenPalette = useCallback(() => setPaletteOpen(true), []);
  const handleToggleChat = useCallback(() => setChatOpen((v) => !v), []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          onToggleChat={handleToggleChat}
          onOpenPalette={handleOpenPalette}
          userName={user.displayName || user.sub}
          userRole={user.role}
          orgName={user.orgName}
        />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
      <AiChatDrawer open={chatOpen} onClose={() => setChatOpen(false)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
