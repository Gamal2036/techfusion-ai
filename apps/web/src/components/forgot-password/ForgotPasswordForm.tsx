'use client';

import { ChangeEvent, FormEvent, useRef, useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Card, Input } from '@techfusion/ui';
import { CircleAlert, KeyRound, MailCheck } from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';
import { requestPasswordReset, type RecoveryError } from '@/lib/recovery-client';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return 'Enter your email address.';
  if (!EMAIL_RE.test(trimmed)) return 'Enter a valid email address.';
  return '';
}

function mapRecoveryError(err: RecoveryError): string {
  return err.message;
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [fieldError, setFieldError] = useState('');
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);

  function handleEmailChange(e: ChangeEvent<HTMLInputElement>) {
    setEmail(e.target.value);
    setServerError('');
    setFieldError('');
  }

  function handleEmailBlur() {
    setTouched(true);
    setFieldError(validateEmail(email));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError('');

    const emailError = validateEmail(email);
    setFieldError(emailError);
    setTouched(true);

    if (emailError) {
      emailRef.current?.focus();
      return;
    }

    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSuccess(true);
    } catch (err) {
      if (err && typeof err === 'object' && 'kind' in err) {
        setServerError(mapRecoveryError(err as RecoveryError));
      } else {
        setServerError("We couldn't process your request. Try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (success) {
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
          <header className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <MailCheck className="h-6 w-6 text-primary" aria-hidden="true" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
              Check your inbox
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              If an account exists for this email, you&apos;ll receive password
              reset instructions shortly. The link will expire in 15 minutes.
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
            Password recovery
          </p>
          <h1 className="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
            Reset your password
          </h1>
          <p className="mt-1.5 text-sm text-text-secondary">
            Enter the email address associated with your account. If an account
            exists, we&apos;ll send password reset instructions.
          </p>
          <p className="mt-3 text-xs text-text-secondary">
            <span aria-hidden="true">*</span> Required
          </p>
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

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
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
            error={touched ? fieldError : undefined}
            required
            disabled={loading}
            inputSize="lg"
            className="h-11 rounded-sm"
            ref={emailRef}
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={loading}
            loadingText="Sending instructions…"
            disabled={loading}
            className="rounded-sm text-sm font-medium"
          >
            Send reset instructions
          </Button>
        </form>
      </Card>
    </AuthShell>
  );
}
