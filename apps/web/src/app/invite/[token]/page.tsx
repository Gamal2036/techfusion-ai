'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Badge, Button, Card } from '@techfusion/ui';
import { Building2, CircleAlert, Clock, Loader2, Mail, Shield } from 'lucide-react';
import {
  acceptInvitation,
  inspectInvitation,
  switchToOrganization,
  type InvitationInspection,
} from '@/lib/org-client';
import { isAuthenticated } from '@/lib/auth-client';

function roleVariant(role: string): 'primary' | 'success' | 'warning' | 'secondary' {
  switch (role) {
    case 'Owner': return 'primary';
    case 'Admin': return 'success';
    case 'Technician': return 'warning';
    default: return 'secondary';
  }
}

function formatExpiry(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? 'Expired'
    : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? '';
  const router = useRouter();

  const [inspection, setInspection] = useState<InvitationInspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');

  const authenticated = isAuthenticated();

  const load = useCallback(async () => {
    if (!token) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    try {
      const data = await inspectInvitation(token);
      setInspection(data);
      setNotFound(data.status !== 'PENDING');
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  async function handleAccept() {
    setAccepting(true);
    setError('');
    try {
      const result = await acceptInvitation(token);
      // Make the newly joined organization active so the redirect lands on it.
      await switchToOrganization(result.organization.id);
      router.push('/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not accept the invitation.');
      setAccepting(false);
    }
  }

  const signInHref = `/login?next=${encodeURIComponent(`/invite/${token}`)}`;
  const signUpHref = `/signup?next=${encodeURIComponent(`/invite/${token}`)}`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-8 text-foreground">
      <Card className="relative w-full max-w-[440px] overflow-hidden rounded-lg p-6 shadow-card ring-1 ring-border-strong/30 sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent"
        />

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-text-secondary">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Checking invitation…</p>
          </div>
        ) : notFound || !inspection ? (
          <>
            <header>
              <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                Invitation
              </p>
              <h1 className="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
                This invitation is no longer available
              </h1>
              <p className="mt-1.5 text-sm text-text-secondary">
                The invitation link may have expired, been revoked, or already
                been accepted.
              </p>
            </header>
            <div className="mt-6 space-y-3">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                className="rounded-sm text-sm font-medium"
                onClick={() => router.push('/dashboard')}
              >
                Go to dashboard
              </Button>
            </div>
          </>
        ) : (
          <>
            <header>
              <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                Organization invitation
              </p>
              <h1 className="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
                You&apos;re invited to {inspection.organization.name}
              </h1>
              <p className="mt-1.5 text-sm text-text-secondary">
                Join the organization with the role below.
              </p>
            </header>

            <dl className="mt-6 space-y-3 rounded-lg border border-border bg-surface-subtle/60 p-4">
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Organization
                </dt>
                <dd className="text-sm font-medium text-text-primary">{inspection.organization.name}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                  Role
                </dt>
                <dd>
                  <Badge variant={roleVariant(inspection.role)}>{inspection.role}</Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                  Invited email
                </dt>
                <dd className="text-sm text-text-primary">{inspection.email}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  Expires
                </dt>
                <dd className="text-sm text-text-primary">{formatExpiry(inspection.expiresAt)}</dd>
              </div>
            </dl>

            {error && (
              <div
                role="alert"
                className="mt-5 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger"
              >
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <div className="mt-6 space-y-3">
              {authenticated ? (
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={accepting}
                  loadingText="Accepting…"
                  className="rounded-sm text-sm font-medium"
                  onClick={handleAccept}
                >
                  Accept invitation
                </Button>
              ) : (
                <>
                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    className="rounded-sm text-sm font-medium"
                    onClick={() => router.push(signInHref)}
                  >
                    Sign in to accept
                  </Button>
                  <p className="text-center text-sm text-text-secondary">
                    No account yet?{' '}
                    <Link
                      href={signUpHref}
                      className="rounded-sm font-medium text-primary transition-colors duration-150 hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Create account
                    </Link>
                  </p>
                </>
              )}
            </div>
          </>
        )}
      </Card>
    </main>
  );
}
