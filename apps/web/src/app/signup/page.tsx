'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Input, GlassPanel } from '@techfusion/ui';
import { UserPlus } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName, orgName }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Signup failed');
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white tracking-tight">Create Account</h1>
            <p className="text-sm text-white/40 mt-1">Set up your organization</p>
          </div>
          {error && (
            <div className="rounded-lg bg-red-600/10 border border-red-500/20 px-4 py-2.5">
              <p className="text-sm text-red-400 text-center">{error}</p>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/50">Organization Name</label>
            <Input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Acme Corp" required />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/50">Display Name</label>
            <Input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Jane Doe" required />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/50">Email</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/50">Password</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create a strong password" required />
          </div>
          <Button type="submit" className="w-full gap-2">
            <UserPlus className="h-4 w-4" />
            Create Account
          </Button>
          <p className="text-sm text-center text-white/30">
            Already have an account?{' '}
            <Link href="/login" className="text-primary-400 hover:text-primary-300 transition-colors">
              Sign in
            </Link>
          </p>
        </form>
      </GlassPanel>
    </div>
  );
}
