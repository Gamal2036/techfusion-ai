'use client';

import { ChangeEvent, FormEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Alert, Button, Card, Input } from '@techfusion/ui';
import { CircleAlert, LockKeyhole, ShieldCheck } from 'lucide-react';
import { LoginLogo } from './LoginLogo';
import { LoginPasswordField } from './LoginPasswordField';
import { LoginMfaStep } from './LoginMfaStep';
import { setTokens, getApiUrl } from '@/lib/auth-client';

const API_URL = getApiUrl();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(value: string): string {
  if (!value.trim()) return 'Enter your email address.';
  if (!EMAIL_RE.test(value.trim())) return 'Enter a valid email address.';
  return '';
}

function validatePassword(value: string): string {
  if (!value) return 'Enter your password.';
  return '';
}

function validateMfaCode(value: string): string {
  if (value.length !== 6) return 'Enter the 6-digit verification code.';
  return '';
}

function mapServerError(status: number | null, message: string): string {
  if (status === 401) return message || 'Invalid email or password';
  if (status === 429)
    return 'Too many sign-in attempts. Wait a moment and try again.';
  if (status === null)
    return "We couldn't reach the service. Check your connection and try again.";
  return "We couldn't sign you in. Try again.";
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return typeof data?.message === 'string' && data.message ? data.message : '';
  } catch {
    return '';
  }
}

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' });
  const [mfaTouched, setMfaTouched] = useState(false);
  const [mfaError, setMfaError] = useState('');

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const mfaRef = useRef<HTMLInputElement>(null);

  const router = useRouter();

  function handleEmailChange(e: ChangeEvent<HTMLInputElement>) {
    setEmail(e.target.value);
    setServerError('');
    setFieldErrors((prev) => (prev.email ? { ...prev, email: '' } : prev));
  }

  function handlePasswordChange(e: ChangeEvent<HTMLInputElement>) {
    setPassword(e.target.value);
    setServerError('');
    setFieldErrors((prev) => (prev.password ? { ...prev, password: '' } : prev));
  }

  function handleEmailBlur() {
    setTouched((prev) => ({ ...prev, email: true }));
    setFieldErrors((prev) => ({ ...prev, email: validateEmail(email) }));
  }

  function handlePasswordBlur() {
    setTouched((prev) => ({ ...prev, password: true }));
    setFieldErrors((prev) => ({ ...prev, password: validatePassword(password) }));
  }

  function handleMfaCodeChange(value: string) {
    setMfaToken(value);
    setServerError('');
    if (mfaError) setMfaError('');
  }

  function handleMfaCodeBlur() {
    setMfaTouched(true);
    setMfaError(validateMfaCode(mfaToken));
  }

  async function handleCredentialsSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError('');

    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    setFieldErrors({ email: emailError, password: passwordError });
    setTouched({ email: true, password: true });

    if (emailError || passwordError) {
      if (emailError) emailRef.current?.focus();
      else passwordRef.current?.focus();
      return;
    }

    setLoading(true);
    let status: number | null = null;
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      status = res.status;
      if (!res.ok) {
        const message = await readErrorMessage(res);
        throw new Error(message);
      }
      const data = await res.json();
      if (data.mfaRequired) {
        setPendingUserId(data.userId);
        setMfaRequired(true);
        return;
      }
      setTokens(data.accessToken, data.refreshToken);
      router.push('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setServerError(mapServerError(status, message));
    } finally {
      setLoading(false);
    }
  }

  async function handleMfaSubmit(e: FormEvent) {
    e.preventDefault();
    if (!pendingUserId) return;
    setServerError('');

    const codeError = validateMfaCode(mfaToken);
    setMfaError(codeError);
    setMfaTouched(true);
    if (codeError) {
      mfaRef.current?.focus();
      return;
    }

    setLoading(true);
    let status: number | null = null;
    try {
      const res = await fetch(`${API_URL}/auth/verify-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: pendingUserId, token: mfaToken }),
      });
      status = res.status;
      if (!res.ok) {
        const message = await readErrorMessage(res);
        throw new Error(message);
      }
      const data = await res.json();
      setTokens(data.accessToken, data.refreshToken);
      router.push('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setServerError(mapServerError(status, message));
    } finally {
      setLoading(false);
    }
  }

  function handleUseDifferentAccount() {
    setMfaRequired(false);
    setPendingUserId(null);
    setMfaToken('');
    setMfaError('');
    setMfaTouched(false);
    setServerError('');
    setLoading(false);
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
      <LoginLogo className="mb-6 lg:hidden" />

      <header>
        {mfaRequired ? (
          <>
            <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Security verification
            </p>
            <h1 className="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
              Verify your identity
            </h1>
            <p className="mt-1.5 text-sm text-text-secondary">
              Enter the 6-digit code from your authenticator app.
            </p>
          </>
        ) : (
          <>
            <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
              <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
              Secure sign-in
            </p>
            <h1 className="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
              Welcome back
            </h1>
            <p className="mt-1.5 text-sm text-text-secondary">
              Sign in to continue to TechFusion-AI.
            </p>
            <p className="mt-3 text-xs text-text-secondary">
              <span aria-hidden="true">*</span> Required
            </p>
          </>
        )}
      </header>

      {serverError && (
        <Alert
          variant="danger"
          icon={<CircleAlert className="h-4 w-4" aria-hidden="true" />}
          className="mt-5 animate-slide-up motion-reduce:animate-none"
        >
          {serverError}
        </Alert>
      )}

      {mfaRequired ? (
        <LoginMfaStep
          code={mfaToken}
          onCodeChange={handleMfaCodeChange}
          onCodeBlur={handleMfaCodeBlur}
          error={mfaTouched ? mfaError : undefined}
          loading={loading}
          onSubmit={handleMfaSubmit}
          onUseDifferentAccount={handleUseDifferentAccount}
          inputRef={mfaRef}
        />
      ) : (
        <form onSubmit={handleCredentialsSubmit} className="mt-6 space-y-4" noValidate>
          <Input
            id="email"
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@company.com"
            value={email}
            onChange={handleEmailChange}
            onBlur={handleEmailBlur}
            error={touched.email ? fieldErrors.email : undefined}
            required
            disabled={loading}
            inputSize="lg"
            className="h-11 rounded-sm"
            ref={emailRef}
          />
          <LoginPasswordField
            id="password"
            label="Password"
            name="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={handlePasswordChange}
            onBlur={handlePasswordBlur}
            error={touched.password ? fieldErrors.password : undefined}
            required
            disabled={loading}
            ref={passwordRef}
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={loading}
            loadingText="Signing in…"
            disabled={loading}
            className="rounded-sm text-sm font-medium"
          >
            Sign in
          </Button>

          <p className="text-center text-sm text-text-secondary">
            Don&apos;t have an account?{' '}
            <Link
              href="/signup"
              className="rounded-sm font-medium text-primary transition-colors duration-150 hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Sign up
            </Link>
          </p>
        </form>
      )}
    </Card>
  );
}
