'use client';

import { ChangeEvent, FormEvent, useEffect, useRef, useState, useId } from 'react';
import Link from 'next/link';
import { Alert, Button, Card, Input } from '@techfusion/ui';
import {
  CircleAlert,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  ShieldAlert,
} from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';
import {
  resetPassword,
  type RecoveryError,
} from '@/lib/recovery-client';

type PageState =
  | 'loading'
  | 'ready'
  | 'submitting'
  | 'success'
  | 'invalid_token'
  | 'missing_token'
  | 'error';

interface PasswordPolicy {
  minLength: boolean;
  maxLength: boolean;
}

function evaluatePassword(value: string): PasswordPolicy {
  return {
    minLength: value.length >= 8,
    maxLength: value.length <= 128,
  };
}

function isPasswordValid(policy: PasswordPolicy): boolean {
  return policy.minLength && policy.maxLength;
}

export function ResetPasswordForm() {
  const [pageState, setPageState] = useState<PageState>('loading');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [touched, setTouched] = useState({
    password: false,
    confirmPassword: false,
  });
  const [fieldErrors, setFieldErrors] = useState({
    password: '',
    confirmPassword: '',
  });
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  const passwordId = useId();
  const passwordErrorId = `${passwordId}-error`;
  const passwordHelpId = `${passwordId}-help`;
  const confirmId = useId();
  const confirmErrorId = `${confirmId}-error`;

  const policy = evaluatePassword(password);
  const passwordsMatch = password === confirmPassword;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rawToken = params.get('token');
    if (!rawToken) {
      setPageState('missing_token');
      return;
    }
    setToken(rawToken);
    setPageState('ready');
  }, []);

  function validatePasswordField(): string {
    if (!password) return 'Enter a new password.';
    if (!policy.minLength) return 'Password must be at least 8 characters.';
    if (!policy.maxLength) return 'Password must be 128 characters or fewer.';
    return '';
  }

  function validateConfirmField(): string {
    if (!confirmPassword) return 'Confirm your new password.';
    if (confirmPassword !== password) return 'Passwords do not match.';
    return '';
  }

  function handlePasswordChange(e: ChangeEvent<HTMLInputElement>) {
    setPassword(e.target.value);
    setServerError('');
    setFieldErrors((prev) => (prev.password ? { ...prev, password: '' } : prev));
  }

  function handleConfirmChange(e: ChangeEvent<HTMLInputElement>) {
    setConfirmPassword(e.target.value);
    setServerError('');
    setFieldErrors((prev) =>
      prev.confirmPassword ? { ...prev, confirmPassword: '' } : prev,
    );
  }

  function handlePasswordBlur() {
    setTouched((prev) => ({ ...prev, password: true }));
    setFieldErrors((prev) => ({
      ...prev,
      password: validatePasswordField(),
    }));
  }

  function handleConfirmBlur() {
    setTouched((prev) => ({ ...prev, confirmPassword: true }));
    setFieldErrors((prev) => ({
      ...prev,
      confirmPassword: validateConfirmField(),
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError('');

    const pwErr = validatePasswordField();
    const confirmErr = validateConfirmField();
    setFieldErrors({ password: pwErr, confirmPassword: confirmErr });
    setTouched({ password: true, confirmPassword: true });

    if (pwErr) {
      passwordRef.current?.focus();
      return;
    }
    if (confirmErr) {
      confirmRef.current?.focus();
      return;
    }

    setLoading(true);
    setPageState('submitting');
    try {
      await resetPassword(token, password);
      setPassword('');
      setConfirmPassword('');
      setPageState('success');
    } catch (err) {
      if (err && typeof err === 'object' && 'kind' in err) {
        const re = err as RecoveryError;
        if (re.message === 'invalid_token') {
          setPageState('invalid_token');
        } else {
          setServerError(re.message);
          setPageState('error');
        }
      } else {
        setServerError("We couldn't reset your password. Try again.");
        setPageState('error');
      }
    } finally {
      setLoading(false);
    }
  }

  if (pageState === 'missing_token') {
    return (
      <AuthShell
        footer={
          <Link
            href="/forgot-password"
            className="rounded-sm font-medium text-primary transition-colors duration-150 hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Request a new reset link
          </Link>
        }
      >
        <Card className="relative w-full overflow-hidden rounded-lg p-6 shadow-card ring-1 ring-border-strong/30 sm:p-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent"
          />
          <header className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warning/10">
              <ShieldAlert className="h-6 w-6 text-warning" aria-hidden="true" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
              Invalid reset link
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              This password reset link is invalid. Request a new password reset
              link to continue.
            </p>
          </header>
        </Card>
      </AuthShell>
    );
  }

  if (pageState === 'invalid_token') {
    return (
      <AuthShell
        footer={
          <Link
            href="/forgot-password"
            className="rounded-sm font-medium text-primary transition-colors duration-150 hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Request a new reset link
          </Link>
        }
      >
        <Card className="relative w-full overflow-hidden rounded-lg p-6 shadow-card ring-1 ring-border-strong/30 sm:p-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent"
          />
          <header className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warning/10">
              <ShieldAlert className="h-6 w-6 text-warning" aria-hidden="true" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
              Reset link expired
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              This reset link is invalid or has expired. Request a new password
              reset link to continue.
            </p>
          </header>
        </Card>
      </AuthShell>
    );
  }

  if (pageState === 'success') {
    return (
      <AuthShell
        footer={
          <Link
            href="/login"
            className="rounded-sm font-medium text-primary transition-colors duration-150 hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Back to sign in
          </Link>
        }
      >
        <Card className="relative w-full overflow-hidden rounded-lg p-6 shadow-card ring-1 ring-border-strong/30 sm:p-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent"
          />
          <header className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
              <CheckCircle2 className="h-6 w-6 text-success" aria-hidden="true" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
              Password reset complete
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              Your password has been reset. For your security, existing sessions
              have been signed out. You can now sign in with your new password.
            </p>
          </header>
        </Card>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      footer={
        <Link
          href="/login"
          className="rounded-sm font-medium text-primary transition-colors duration-150 hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Back to sign in
        </Link>
      }
    >
      <Card className="relative w-full overflow-hidden rounded-lg p-6 shadow-card ring-1 ring-border-strong/30 sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-[3px] h-[5px] w-[5px] -translate-x-1/2 rotate-45 border border-primary/40"
        />

        <header>
          <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
            Create new password
          </p>
          <h1 className="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
            Set a new password
          </h1>
          <p className="mt-1.5 text-sm text-text-secondary">
            Choose a strong password for your account.
          </p>
          <p className="mt-3 text-xs text-text-secondary">
            <span aria-hidden="true">*</span> Required
          </p>
        </header>

        {serverError && pageState === 'error' && (
          <Alert
            variant="danger"
            icon={<CircleAlert className="h-4 w-4" aria-hidden="true" />}
            className="mt-5 animate-slide-up motion-reduce:animate-none"
          >
            {serverError}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          {/* Password field */}
          <div>
            <div className="relative">
              <Input
                id={passwordId}
                label="New password"
                name="newPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Enter new password"
                value={password}
                onChange={handlePasswordChange}
                onBlur={handlePasswordBlur}
                error={
                  touched.password ? fieldErrors.password : undefined
                }
                aria-describedby={
                  touched.password && fieldErrors.password
                    ? passwordErrorId
                    : passwordHelpId
                }
                required
                disabled={pageState === 'submitting'}
                inputSize="lg"
                className="h-11 rounded-sm pr-14"
                ref={passwordRef}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                disabled={pageState === 'submitting'}
                className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-sm text-text-muted transition-colors duration-150 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
            <div
              id={passwordHelpId}
              className="mt-1.5 text-xs text-text-secondary"
            >
              8–128 characters
            </div>
          </div>

          {/* Confirm password field */}
          <div>
            <div className="relative">
              <Input
                id={confirmId}
                label="Confirm password"
                name="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={handleConfirmChange}
                onBlur={handleConfirmBlur}
                error={
                  touched.confirmPassword
                    ? fieldErrors.confirmPassword
                    : undefined
                }
                aria-describedby={
                  touched.confirmPassword && fieldErrors.confirmPassword
                    ? confirmErrorId
                    : undefined
                }
                required
                disabled={pageState === 'submitting'}
                inputSize="lg"
                className="h-11 rounded-sm pr-14"
                ref={confirmRef}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={
                  showConfirm ? 'Hide confirm password' : 'Show confirm password'
                }
                aria-pressed={showConfirm}
                disabled={pageState === 'submitting'}
                className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-sm text-text-muted transition-colors duration-150 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
              >
                {showConfirm ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={pageState === 'submitting'}
            loadingText="Resetting password…"
            disabled={pageState === 'submitting'}
            className="rounded-sm text-sm font-medium"
          >
            Reset password
          </Button>
        </form>
      </Card>
    </AuthShell>
  );
}
