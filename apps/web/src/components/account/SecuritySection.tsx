'use client';

import { Badge, Button, GlassPanel } from '@techfusion/ui';
import { Loader2, ShieldCheck, ShieldOff } from 'lucide-react';
import type { MfaStatus } from '@/lib/account-client';

interface SecuritySectionProps {
  mfa: MfaStatus | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

function SecurityRow({
  title,
  description,
  badge,
}: {
  title: string;
  description: string;
  badge: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm text-text-primary">{title}</p>
        <p className="text-xs text-text-muted mt-0.5">{description}</p>
      </div>
      <div className="shrink-0">{badge}</div>
    </div>
  );
}

export function SecuritySection({ mfa, loading, error, onRetry }: SecuritySectionProps) {
  return (
    <GlassPanel intensity="light" className="p-5">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-medium text-text-primary">Security &amp; Sessions</h2>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-text-disabled" role="status">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading security status...
        </div>
      ) : error ? (
        <div className="space-y-3">
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : mfa ? (
        <div className="divide-y divide-border-subtle">
          <SecurityRow
            title="Multi-factor authentication (TOTP)"
            description={
              mfa.isMfaEnabled
                ? 'Enabled. You are required to enter a one-time code from your authenticator app when signing in.'
                : 'Not enabled. You sign in with your email and password only.'
            }
            badge={
              <Badge variant={mfa.isMfaEnabled ? 'success' : 'secondary'}>
                {mfa.isMfaEnabled ? (
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" /> Enabled
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <ShieldOff className="h-3 w-3" /> Not enabled
                  </span>
                )}
              </Badge>
            }
          />
          <SecurityRow
            title="Password"
            description="Password change is not available in this release."
            badge={<Badge variant="secondary">Not available</Badge>}
          />
          <SecurityRow
            title="Active sessions"
            description="Session listing and revocation are not available in this release."
            badge={<Badge variant="secondary">Not available</Badge>}
          />
        </div>
      ) : null}
    </GlassPanel>
  );
}
