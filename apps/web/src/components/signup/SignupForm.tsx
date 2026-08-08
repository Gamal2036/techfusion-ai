'use client';

import { useState, FormEvent, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Alert, Button, Card, Input } from '@techfusion/ui';
import { ArrowRight, Building2, CircleAlert } from 'lucide-react';
import { SignupPasswordField } from './SignupPasswordField';
import { SignupLogo } from './SignupLogo';
import { setTokens, getApiUrl } from '@/lib/auth-client';
import { getSafeNextPath } from '@/components/login/LoginForm';

const API_URL = getApiUrl();

const inputClassName = 'h-11 rounded-sm';

export function SignupForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const [nextPath] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : getSafeNextPath(window.location.search),
  );

  const confirmMismatch = useMemo(
    () => confirmPassword.length > 0 && password !== confirmPassword,
    [confirmPassword, password],
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
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
      setTokens(data.accessToken, data.refreshToken);
      router.push(nextPath ?? '/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="relative w-full overflow-hidden rounded-lg p-6 shadow-card ring-1 ring-border-strong/30 sm:p-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[3px] h-[5px] w-[5px] -translate-x-1/2 rotate-45 border border-primary/40"
      />
      <SignupLogo className="mb-6 lg:hidden" />

      <header>
        <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
          <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
          Enterprise onboarding
        </p>
        <h2 className="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
          Create your account
        </h2>
        <p className="mt-1.5 text-sm text-text-secondary">
          Set up your workspace in under a minute.
        </p>
        <p className="mt-3 text-xs text-text-secondary">
          <span aria-hidden="true">*</span> Required
        </p>
      </header>

      {error && (
        <Alert
          variant="danger"
          icon={<CircleAlert className="h-4 w-4" aria-hidden="true" />}
          className="mt-5 animate-slide-up motion-reduce:animate-none"
        >
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        <Input
          id="orgName"
          label="Organization"
          name="organization"
          type="text"
          autoComplete="organization"
          placeholder="Acme Corp"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          required
          disabled={loading}
          inputSize="lg"
          className={inputClassName}
        />
        <Input
          id="displayName"
          label="Full Name"
          name="displayName"
          type="text"
          autoComplete="name"
          placeholder="Jane Doe"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          disabled={loading}
          inputSize="lg"
          className={inputClassName}
        />
        <Input
          id="email"
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
          inputSize="lg"
          className={inputClassName}
        />
        <SignupPasswordField
          id="password"
          label="Password"
          name="password"
          autoComplete="new-password"
          placeholder="Create a strong password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
        />
        <SignupPasswordField
          id="confirmPassword"
          label="Confirm Password"
          name="confirmPassword"
          autoComplete="new-password"
          placeholder="Re-enter your password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          disabled={loading}
          showStrength={false}
          error={confirmMismatch ? 'Passwords do not match.' : undefined}
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={loading}
          loadingText="Creating account…"
          leftIcon={<ArrowRight className="h-4 w-4" />}
          disabled={loading}
          className="rounded-sm text-sm font-medium"
        >
          Create account
        </Button>

        <p className="text-center text-sm text-text-secondary">
          Already have an account?{' '}
          <Link
            href={nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : '/login'}
            className="rounded-sm font-medium text-primary transition-colors duration-150 hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Sign in
          </Link>
        </p>

        <p className="text-center text-sm leading-relaxed text-text-secondary">
          By creating an account you agree to our Terms of Service and Privacy
          Policy.
        </p>
      </form>
    </Card>
  );
}
