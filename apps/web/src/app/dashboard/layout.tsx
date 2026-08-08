'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Toaster } from '@techfusion/ui';
import { getCurrentUser, type JwtPayload } from '@/lib/auth-client';
import { listenForOrgSwitch } from '@/lib/org-client';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { useSessionGuard } from '@/hooks/useSessionGuard';

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
  // Session guard: watches for access-token expiry and renews it through the
  // single-flight refresh. Only escalates to /login when the refresh session
  // itself is definitively invalid.
  const sessionStatus = useSessionGuard();
  // orgEpoch increments on every organization switch. It is part of the content
  // key so switching orgs unmounts the previous org's component tree (its
  // requests and polling stop) and remounts a fresh one against the new token.
  const [orgEpoch, setOrgEpoch] = useState(0);
  const { org, activeOrgId } = useCurrentOrganization();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
    }
  }, []);

  // A definitively invalid refresh session clears auth state and sends the
  // user to /login. A merely expired access token never triggers this: the
  // guard renews it transparently instead.
  useEffect(() => {
    if (sessionStatus === 'logged-out') {
      router.push('/login');
    }
  }, [sessionStatus, router]);

  // On organization switch the token pair has already been replaced by
  // switchToOrganization (lib/org-client). Here we re-read the fresh JWT,
  // bump the epoch so the org-scoped content remounts, and update the user
  // role/org shown in the shell.
  useEffect(() => {
    return listenForOrgSwitch(() => {
      const currentUser = getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
      }
      setOrgEpoch((e) => e + 1);
    });
  }, []);

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

  if (sessionStatus === 'checking') {
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
          orgName={org?.name}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {mounted && (
            <AnimatePresence>
              <MotionDiv
                key={`${pathname}:${activeOrgId ?? ''}:${orgEpoch}`}
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
