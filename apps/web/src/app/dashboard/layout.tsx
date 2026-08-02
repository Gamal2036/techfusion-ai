'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Toaster } from '@techfusion/ui';
import { getCurrentUser, isAuthenticated, type JwtPayload } from '@/lib/auth-client';

const MotionDiv = dynamic(() => import('framer-motion').then((m) => m.motion.div), { ssr: false });
const AnimatePresence = dynamic(() => import('framer-motion').then((m) => ({ default: m.AnimatePresence })), { ssr: false });
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { CommandPalette } from '@/components/CommandPalette';
import { AiChatDrawer } from '@/components/AiChatDrawer';
import { LoadingSpinner } from '@techfusion/ui';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<JwtPayload | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser || !isAuthenticated()) {
      router.push('/login');
      return;
    }
    setUser(currentUser);
    setAuthChecked(true);
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    const interval = setInterval(() => {
      if (!isAuthenticated()) {
        router.push('/login');
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [authChecked, router]);

  const handleOpenPalette = useCallback(() => setPaletteOpen(true), []);
  const handleToggleChat = useCallback(() => setChatOpen((v) => !v), []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (e.key === 'Escape') {
        setChatOpen(false);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <LoadingSpinner size="md" label="Loading..." />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          onToggleChat={handleToggleChat}
          onOpenPalette={handleOpenPalette}
          userName={user?.sub}
          userRole={user?.role}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {mounted && (
            <AnimatePresence>
              <MotionDiv
                key={pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                {children}
              </MotionDiv>
            </AnimatePresence>
          )}
        </main>
      </div>
      <AiChatDrawer open={chatOpen} onClose={() => setChatOpen(false)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <Toaster />
    </div>
  );
}
