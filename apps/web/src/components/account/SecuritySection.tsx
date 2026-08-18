'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, GlassPanel, StatusMessage } from '@techfusion/ui';
import { Loader2, ShieldCheck, ShieldOff, Key, MonitorSmartphone } from 'lucide-react';
import {
  fetchMfaStatus,
  fetchRecoveryCodesStatus,
  type MfaStatus,
  type RecoveryCodesStatus,
} from '@/lib/mfa-client';
import { mapMfaError } from '@/lib/mfa-errors';
import { useAccountSecurity } from '@/hooks/useAccountSecurity';
import { MfaEnrollmentDialog } from './mfa/MfaEnrollmentDialog';
import { RecoveryCodesDialog } from './mfa/RecoveryCodesDialog';
import { DisableMfaDialog } from './mfa/DisableMfaDialog';
import { PasswordChangeDialog } from './PasswordChangeDialog';
import { ActiveSessions } from './ActiveSessions';

type LoadState =
  | { status: 'loading' }
  | { status: 'failed'; message: string }
  | { status: 'ready' };

function SecurityRow({
  title,
  description,
  badge,
  actions,
}: {
  title: string;
  description: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm text-text-primary">{title}</p>
        <p className="text-xs text-text-muted mt-0.5">{description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {badge}
        {actions}
      </div>
    </div>
  );
}

/**
 * ACC-UX-02C — Security & Sessions capability panel. Owns all MFA state: it
 * fetches the authoritative /mfa/status and /mfa/recovery-codes/status, runs
 * the enrollment / recovery / disable flows, and refreshes from the server
 * after every mutation. States: loading, unavailable/error, disabled,
 * enrollment-in-progress, enabled, recovery available/depleted, throttled.
 */
export function SecuritySection() {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  const [mfa, setMfa] = useState<MfaStatus | null>(null);
  const [recovery, setRecovery] = useState<RecoveryCodesStatus | null>(null);
  const [recoveryFailed, setRecoveryFailed] = useState(false);
  const [throttled, setThrottled] = useState(false);

  const [enrollOpen, setEnrollOpen] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryRegenerate, setRecoveryRegenerate] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const { sessionsState, refreshSessions } = useAccountSecurity();

  const load = useCallback(async () => {
    setLoadState({ status: 'loading' });
    setThrottled(false);
    try {
      const [mfaResult, recoveryResult] = await Promise.allSettled([
        fetchMfaStatus(),
        fetchRecoveryCodesStatus(),
      ]);
      if (mfaResult.status === 'rejected') {
        setMfa(null);
        setRecovery(null);
        setRecoveryFailed(false);
        setLoadState({ status: 'failed', message: mapMfaError(mfaResult.reason).message });
        return;
      }
      const status = mfaResult.value;
      setMfa(status);
      if (status.isMfaEnabled) {
        if (recoveryResult.status === 'fulfilled') {
          setRecovery(recoveryResult.value);
          setRecoveryFailed(false);
        } else {
          setRecovery(null);
          setRecoveryFailed(true);
        }
      } else {
        setRecovery(null);
        setRecoveryFailed(false);
      }
      setLoadState({ status: 'ready' });
    } catch (error) {
      setMfa(null);
      setRecovery(null);
      setLoadState({ status: 'failed', message: mapMfaError(error).message });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const closeEnrollment = useCallback(
    (open: boolean) => {
      setEnrollOpen(open);
      if (!open) load();
    },
    [load],
  );

  const closeRecovery = useCallback(
    (open: boolean) => {
      setRecoveryOpen(open);
      if (!open) load();
    },
    [load],
  );

  const closeDisable = useCallback(
    (open: boolean) => {
      setDisableOpen(open);
      if (!open) load();
    },
    [load],
  );

  const openRecovery = useCallback((regenerate: boolean) => {
    setRecoveryRegenerate(regenerate);
    setRecoveryOpen(true);
  }, []);

  const handleThrottled = useCallback(() => setThrottled(true), []);

  const mfaEnabled = mfa?.isMfaEnabled === true;

  function recoveryDescription(): string {
    if (recoveryFailed) return 'Recovery code status is unavailable.';
    if (!recovery) return 'Recovery code status is unknown.';
    if (!recovery.generated) {
      return 'Generate codes so you can get back in if you lose your authenticator app.';
    }
    if (recovery.availableCount === 0) {
      return 'All recovery codes have been used. Regenerate to receive a fresh set.';
    }
    return `You have ${recovery.availableCount} recovery ${recovery.availableCount === 1 ? 'code' : 'codes'} remaining. Each code can be used once.`;
  }

  return (
    <GlassPanel intensity="light" className="p-5">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-medium text-text-primary">Security &amp; Sessions</h2>
      </div>

      {throttled && (
        <StatusMessage variant="warning" layout="block" className="mt-3">
          Too many security attempts. Wait a moment before trying again.
          <Button variant="ghost" size="xs" onClick={() => setThrottled(false)} className="ml-auto">
            Dismiss
          </Button>
        </StatusMessage>
      )}

      {loadState.status === 'loading' ? (
        <div className="flex items-center gap-2 text-sm text-text-disabled" role="status">
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
          Loading security status...
        </div>
      ) : loadState.status === 'failed' ? (
        <div className="space-y-3">
          <p className="text-sm text-danger" role="alert">
            {loadState.message}
          </p>
          <Button variant="outline" size="sm" onClick={load}>
            Retry
          </Button>
        </div>
      ) : mfa ? (
        <div className="divide-y divide-border-subtle">
          <SecurityRow
            title="Multi-factor authentication (TOTP)"
            description={
              mfaEnabled
                ? 'Enabled. You are required to enter a one-time code from your authenticator app when signing in.'
                : 'Add a second authentication factor to protect your account.'
            }
            badge={
              <Badge variant={mfaEnabled ? 'success' : 'secondary'}>
                {mfaEnabled ? (
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
            actions={
              mfaEnabled ? (
                <Button variant="outline" size="sm" onClick={() => setDisableOpen(true)}>
                  Disable
                </Button>
              ) : (
                <Button variant="primary" size="sm" onClick={() => setEnrollOpen(true)}>
                  Set up two-factor authentication
                </Button>
              )
            }
          />

          {mfaEnabled && (
            <SecurityRow
              title="Recovery codes"
              description={recoveryDescription()}
              actions={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openRecovery(recovery?.generated === true)}
                >
                  {!recovery || !recovery.generated ? 'Generate codes' : 'Regenerate codes'}
                </Button>
              }
            />
          )}

          <SecurityRow
            title="Password"
            description="Your password protects your account. Change it regularly to keep your account secure."
            actions={
              <Button variant="outline" size="sm" onClick={() => setPasswordOpen(true)}>
                <Key className="mr-1.5 h-3.5 w-3.5" />
                Change password
              </Button>
            }
          />

          <div className="py-3">
            <div className="flex items-center gap-2 mb-3">
              <MonitorSmartphone className="h-4 w-4 text-text-muted" />
              <h3 className="text-sm font-medium text-text-primary">Active sessions</h3>
            </div>
            <ActiveSessions sessionsState={sessionsState} onRefresh={refreshSessions} />
          </div>
        </div>
      ) : null}

      <MfaEnrollmentDialog
        open={enrollOpen}
        onOpenChange={closeEnrollment}
        onGenerateCodes={() => openRecovery(false)}
        onThrottled={handleThrottled}
      />
      <RecoveryCodesDialog
        open={recoveryOpen}
        onOpenChange={closeRecovery}
        regenerate={recoveryRegenerate}
        onThrottled={handleThrottled}
      />
      <DisableMfaDialog open={disableOpen} onOpenChange={closeDisable} onThrottled={handleThrottled} />
      <PasswordChangeDialog
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
        onPasswordChanged={refreshSessions}
        onThrottled={handleThrottled}
      />
    </GlassPanel>
  );
}
