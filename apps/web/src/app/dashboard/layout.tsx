'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

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

  async function handleLogout() {
    const token = localStorage.getItem('accessToken');
    if (token) {
      await fetch('http://localhost:3001/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    router.push('/login');
  }

  if (!user) return null;

  return (
    <div className="flex h-screen">
      <aside className="w-56 bg-gray-900 border-r border-gray-800 p-4 flex flex-col">
        <h2 className="text-lg font-bold mb-6">TechFusion AI</h2>
        <nav className="flex-1 space-y-2">
          <Link href="/dashboard" className="block rounded px-3 py-2 text-gray-300 hover:bg-gray-800">
            Dashboard
          </Link>
          <Link href="/dashboard/team" className="block rounded px-3 py-2 text-gray-300 hover:bg-gray-800">
            Team
          </Link>
          <Link href="/dashboard/settings" className="block rounded px-3 py-2 text-gray-300 hover:bg-gray-800">
            Settings
          </Link>
        </nav>
        <div className="border-t border-gray-800 pt-4">
          <p className="text-sm text-gray-400 mb-2">{user.role}</p>
          <button
            onClick={handleLogout}
            className="w-full rounded bg-gray-800 py-1.5 text-sm text-gray-300 hover:bg-gray-700"
          >
            Sign Out
          </button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="h-14 border-b border-gray-800 flex items-center px-6">
          <span className="text-gray-400 text-sm">Dashboard / Overview</span>
        </header>
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
