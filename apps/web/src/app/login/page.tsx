'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Input, GlassPanel } from '@techfusion/ui';
import { LogIn } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Login failed');
      }
      const data = await res.json();
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <GlassPanel intensity="medium" className="w-full max-w-sm p-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white tracking-tight">Welcome back</h1>
            <p className="text-sm text-white/40 mt-1">Sign in to TechFusion AI</p>
          </div>
          {error && (
            <div className="rounded-lg bg-red-600/10 border border-red-500/20 px-4 py-2.5">
              <p className="text-sm text-red-400 text-center">{error}</p>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/50">Email</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/50">Password</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required />
          </div>
          <Button type="submit" className="w-full gap-2">
            <LogIn className="h-4 w-4" />
            Sign In
          </Button>
          <p className="text-sm text-center text-white/30">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-primary-400 hover:text-primary-300 transition-colors">
              Sign up
            </Link>
          </p>
        </form>
      </GlassPanel>
    </div>
  );
}
