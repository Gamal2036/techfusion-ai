'use client';

import { useCallback, useState } from 'react';
import {
  Button,
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  StatusMessage,
  Badge,
  Skeleton,
} from '@techfusion/ui';
import { Loader2, Monitor, Smartphone, Globe, LogOut, RefreshCw } from 'lucide-react';
import {
  revokeSession,
  revokeOtherSessions,
  revokeCurrentSession,
  type SessionInfo,
  type SecurityError,
} from '@/lib/security-client';
import { clearTokens } from '@/lib/auth-client';
import type { SessionsLoadState } from '@/hooks/useAccountSecurity';

function maskIpAddress(ip: string | null): string | null {
  if (!ip) return null;
  const v4 = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) return `${v4[1]}.${v4[2]}.xxx.xxx`;
  const v6 = ip.split(':');
  if (v6.length === 8) return `${v6[0]}:${v6[1]}:xxxx:xxxx:xxxx:xxxx:xxxx:xxxx`;
  return ip;
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Unknown';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return 'Unknown';
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function summarizeUserAgent(ua: string | null): string {
  if (!ua) return 'Unknown device';
  const lower = ua.toLowerCase();
  if (lower.includes('iphone')) return 'iPhone';
  if (lower.includes('ipad')) return 'iPad';
  if (lower.includes('mobile') || lower.includes('android'))
    return lower.includes('android')
      ? 'Android device'
      : 'Mobile browser';
  if (lower.includes('windows')) return 'Windows';
  if (lower.includes('mac os') || lower.includes('macintosh'))
    return lower.includes('safari') && !lower.includes('chrome') ? 'macOS (Safari)' : 'macOS';
  if (lower.includes('linux')) return 'Linux';
  if (lower.includes('chrome os')) return 'ChromeOS';
  return 'Desktop browser';
}

function deviceIcon(session: SessionInfo) {
  const ua = session.userAgent?.toLowerCase() || '';
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('mobile') || ua.includes('android'))
    return <Smartphone className="h-4 w-4 text-text-muted" aria-hidden="true" />;
  return <Monitor className="h-4 w-4 text-text-muted" aria-hidden="true" />;
}

function RevokeOneDialog({
  open,
  session,
  onConfirm,
  onCancel,
  revoking,
}: {
  open: boolean;
  session: SessionInfo | null;
  onConfirm: () => void;
  onCancel: () => void;
  revoking: boolean;
}) {
  if (!session) return null;

  return (
    <Modal open={open} onOpenChange={(o) => !o && onCancel()}>
      <ModalContent size="md">
        <ModalHeader>
          <ModalTitle>Revoke this session?</ModalTitle>
          <ModalDescription>
            This will immediately sign out the session on{' '}
            <span className="font-medium text-text-primary">
              {summarizeUserAgent(session.userAgent)}
            </span>
            {session.ipAddress && (
              <span className="text-text-muted"> ({maskIpAddress(session.ipAddress)})</span>
            )}
            . That device will need to sign in again.
          </ModalDescription>
        </ModalHeader>

        <ModalFooter>
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={revoking}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={onConfirm}
            loading={revoking}
            disabled={revoking}
          >
            Revoke session
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function RevokeOthersDialog({
  open,
  otherCount,
  onConfirm,
  onCancel,
  revoking,
}: {
  open: boolean;
  otherCount: number;
  onConfirm: () => void;
  onCancel: () => void;
  revoking: boolean;
}) {
  return (
    <Modal open={open} onOpenChange={(o) => !o && onCancel()}>
      <ModalContent size="md">
        <ModalHeader>
          <ModalTitle>Sign out all other sessions?</ModalTitle>
          <ModalDescription>
            This will immediately sign out {otherCount} other session
            {otherCount !== 1 ? 's' : ''}. Your current session will remain
            active. Those devices will need to sign in again.
          </ModalDescription>
        </ModalHeader>

        <ModalFooter>
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={revoking}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={onConfirm}
            loading={revoking}
            disabled={revoking}
          >
            Sign out other sessions
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function RevokeCurrentDialog({
  open,
  onConfirm,
  onCancel,
  revoking,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  revoking: boolean;
}) {
  return (
    <Modal open={open} onOpenChange={(o) => !o && onCancel()}>
      <ModalContent size="md">
        <ModalHeader>
          <ModalTitle>Sign out of this session?</ModalTitle>
          <ModalDescription>
            You will be signed out of your current session and redirected to the
            sign-in page.
          </ModalDescription>
        </ModalHeader>

        <ModalFooter>
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={revoking}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={onConfirm}
            loading={revoking}
            disabled={revoking}
          >
            Sign out
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

interface ActiveSessionsProps {
  sessionsState: SessionsLoadState;
  onRefresh: () => void;
}

export function ActiveSessions({ sessionsState, onRefresh }: ActiveSessionsProps) {
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeOneTarget, setRevokeOneTarget] = useState<SessionInfo | null>(null);
  const [revokeOthersOpen, setRevokeOthersOpen] = useState(false);
  const [revokeCurrentOpen, setRevokeCurrentOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const dismissError = useCallback(() => setActionError(null), []);

  const handleRevokeOne = useCallback(async () => {
    if (!revokeOneTarget || revokingId) return;
    setRevokingId(revokeOneTarget.sessionId);
    setActionError(null);
    try {
      await revokeSession(revokeOneTarget.sessionId);
      setRevokeOneTarget(null);
      onRefresh();
    } catch (e) {
      const err = e as SecurityError;
      if (err.status === 404) {
        setRevokeOneTarget(null);
        onRefresh();
        return;
      }
      if (err.status === 429) {
        setRevokeOneTarget(null);
        setActionError('Too many attempts. Wait a moment before trying again.');
        return;
      }
      setRevokeOneTarget(null);
      setActionError('Could not revoke this session. Please try again.');
    } finally {
      setRevokingId(null);
    }
  }, [revokeOneTarget, revokingId, onRefresh]);

  const handleRevokeOthers = useCallback(async () => {
    if (revokingId) return;
    setRevokingId('__others__');
    setActionError(null);
    try {
      await revokeOtherSessions();
      setRevokeOthersOpen(false);
      onRefresh();
    } catch (e) {
      const err = e as SecurityError;
      if (err.status === 429) {
        setRevokeOthersOpen(false);
        setActionError('Too many attempts. Wait a moment before trying again.');
        return;
      }
      setRevokeOthersOpen(false);
      setActionError('Could not sign out other sessions. Please try again.');
    } finally {
      setRevokingId(null);
    }
  }, [revokingId, onRefresh]);

  const handleRevokeCurrent = useCallback(async () => {
    if (revokingId) return;
    setRevokingId('__current__');
    setActionError(null);
    try {
      await revokeCurrentSession();
      clearTokens();
      try {
        const { disconnectAll } = await import('@/lib/socket-client');
        disconnectAll();
      } catch {
        // socket-client may not be loaded
      }
      window.location.href = '/login';
    } catch (e) {
      const err = e as SecurityError;
      if (err.status === 429) {
        setRevokeCurrentOpen(false);
        setActionError('Too many attempts. Wait a moment before trying again.');
      } else {
        setRevokeCurrentOpen(false);
        setActionError('Could not sign out of this session. Please try again.');
      }
      setRevokingId(null);
    }
  }, [revokingId]);

  const isRevoking = (sessionId: string) => revokingId === sessionId;
  const isBusy = revokingId !== null;

  if (sessionsState.status === 'loading') {
    return (
      <div className="space-y-3" role="status" aria-label="Loading sessions">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (sessionsState.status === 'failed') {
    return (
      <div className="space-y-3">
        <StatusMessage variant="error" layout="block">
          {sessionsState.message}
        </StatusMessage>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Retry
        </Button>
      </div>
    );
  }

  const sessions = sessionsState.sessions;
  const currentSession = sessions.find((s) => s.current);
  const otherSessions = sessions
    .filter((s) => !s.current)
    .sort((a, b) => {
      const aTime = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
      const bTime = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
      return bTime - aTime;
    });

  return (
    <div className="space-y-3">
      {actionError && (
        <StatusMessage variant="error" layout="block">
          {actionError}
          <Button variant="ghost" size="xs" onClick={dismissError} className="ml-auto">
            Dismiss
          </Button>
        </StatusMessage>
      )}

      {sessions.length === 0 && (
        <div className="rounded-lg border border-border-subtle bg-surface-subtle p-4 text-center">
          <p className="text-sm text-text-muted">No active sessions found.</p>
        </div>
      )}

      {currentSession && (
        <div className="rounded-lg border border-border bg-surface-subtle p-4 transition-colors duration-150">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 min-w-0">
              {deviceIcon(currentSession)}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-text-primary">
                    {summarizeUserAgent(currentSession.userAgent)}
                  </span>
                  <Badge variant="success">This device</Badge>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-text-muted">
                  {maskIpAddress(currentSession.ipAddress) && (
                    <span className="flex items-center gap-1">
                      <Globe className="h-3 w-3" aria-hidden="true" />
                      {maskIpAddress(currentSession.ipAddress)}
                    </span>
                  )}
                  {currentSession.lastUsedAt && (
                    <span>Active {formatRelativeTime(currentSession.lastUsedAt)}</span>
                  )}
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRevokeCurrentOpen(true)}
              disabled={isBusy}
              aria-label="Sign out this session"
            >
              <LogOut className="mr-1.5 h-3.5 w-3.5" />
              Sign out
            </Button>
          </div>
        </div>
      )}

      {otherSessions.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">
              Other sessions ({otherSessions.length})
            </p>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setRevokeOthersOpen(true)}
              disabled={isBusy}
            >
              Sign out all others
            </Button>
          </div>

          {otherSessions.map((session) => (
            <div
              key={session.sessionId}
              className="rounded-lg border border-border-subtle bg-surface-subtle p-4 transition-colors duration-150 hover:border-border"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3 min-w-0">
                  {deviceIcon(session)}
                  <div className="min-w-0">
                    <span className="text-sm text-text-primary">
                      {summarizeUserAgent(session.userAgent)}
                    </span>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-text-muted">
                      {maskIpAddress(session.ipAddress) && (
                        <span className="flex items-center gap-1">
                          <Globe className="h-3 w-3" aria-hidden="true" />
                          {maskIpAddress(session.ipAddress)}
                        </span>
                      )}
                      {session.lastUsedAt && (
                        <span>Active {formatRelativeTime(session.lastUsedAt)}</span>
                      )}
                      {session.createdAt && (
                        <span>Created {formatRelativeTime(session.createdAt)}</span>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRevokeOneTarget(session)}
                  disabled={isBusy}
                  loading={isRevoking(session.sessionId)}
                  aria-label={`Revoke session on ${summarizeUserAgent(session.userAgent)}`}
                >
                  Revoke
                </Button>
              </div>
            </div>
          ))}
        </>
      )}

      {sessions.length > 0 && otherSessions.length === 0 && (
        <p className="text-xs text-text-muted text-center py-2">
          No other active sessions found.
        </p>
      )}

      <RevokeOneDialog
        open={revokeOneTarget !== null}
        session={revokeOneTarget}
        onConfirm={handleRevokeOne}
        onCancel={() => setRevokeOneTarget(null)}
        revoking={revokingId === revokeOneTarget?.sessionId}
      />

      <RevokeOthersDialog
        open={revokeOthersOpen}
        otherCount={otherSessions.length}
        onConfirm={handleRevokeOthers}
        onCancel={() => setRevokeOthersOpen(false)}
        revoking={revokingId === '__others__'}
      />

      <RevokeCurrentDialog
        open={revokeCurrentOpen}
        onConfirm={handleRevokeCurrent}
        onCancel={() => setRevokeCurrentOpen(false)}
        revoking={revokingId === '__current__'}
      />
    </div>
  );
}
