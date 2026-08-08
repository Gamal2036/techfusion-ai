'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { GlassPanel, Button } from '@techfusion/ui';
import {
  UserCog,
  Trash2,
  Loader2,
  AlertTriangle,
  Shield,
  Check,
} from 'lucide-react';
import {
  fetchDeletionPreview,
  deleteAccount,
  type DeletionPreview,
} from '@/lib/account-client';

const REQUIRED_CONFIRMATION = 'DELETE';

export default function AccountSettingsPage() {
  const router = useRouter();
  const [preview, setPreview] = useState<DeletionPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setPreview(await fetchDeletionPreview());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load account status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleConfirmDelete = async () => {
    if (confirmation !== REQUIRED_CONFIRMATION) return;
    setDeleting(true);
    setError('');
    try {
      await deleteAccount(REQUIRED_CONFIRMATION);
      // Backend success: the account, memberships, and sessions are gone.
      // Clear local auth state, disconnect sockets, and leave the dashboard.
      const { clearTokens } = await import('@/lib/auth-client');
      clearTokens();
      try {
        const { disconnectAll } = await import('@/lib/socket-client');
        disconnectAll();
      } catch {
        // socket-client may not be loaded yet
      }
      window.location.href = '/login';
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete account');
      setDeleting(false);
    }
  };

  const blocked = preview?.canDelete === false;
  const eligible = preview?.canDelete === true;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-semibold text-text-primary tracking-tight">Account</h1>
        <p className="text-sm text-text-secondary mt-1">
          Manage your personal account and session lifecycle.
        </p>
      </motion.div>

      {error && (
        <GlassPanel intensity="light" className="p-4 border-red-500/30">
          <div className="flex items-center gap-2 text-sm text-danger">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setError('')}>
              Dismiss
            </Button>
          </div>
        </GlassPanel>
      )}

      {/* Danger Zone */}
      <GlassPanel intensity="light" className="p-5 border-red-500/20">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="h-4 w-4 text-danger" />
          <h3 className="text-sm font-medium text-text-primary">Danger Zone</h3>
        </div>
        <p className="text-xs text-text-secondary mb-4">
          Deleting your account removes your personal account and organization memberships.
          Organization-owned devices and data are not automatically deleted.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-text-disabled">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking account status...
          </div>
        ) : blocked ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
            <p className="text-sm font-medium text-danger">Account cannot be deleted yet.</p>
            <p className="mt-2 text-sm text-text-secondary">Blocking organizations:</p>
            <ul className="mt-2 space-y-2">
              {preview?.blockers.map((blocker) => (
                <li key={blocker.organizationId} className="flex items-center gap-2 text-sm">
                  <Shield className="h-4 w-4 shrink-0 text-warning" />
                  <span className="font-medium text-text-primary">{blocker.organizationName}</span>
                  <span className="text-xs text-text-secondary">You are the only Owner.</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-warning flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Assign another Owner first, then return here to delete your account.
            </p>
          </div>
        ) : eligible ? (
          <div className="space-y-3">
            <p className="text-xs text-text-secondary">
              Your account is currently eligible for deletion.
              {preview && preview.emptyOrganizationsToRemove.length > 0
                ? ` ${preview.emptyOrganizationsToRemove.length} empty personal organization${
                    preview.emptyOrganizationsToRemove.length === 1 ? ' will' : 's will'
                  } be removed with your account.`
                : ''}
            </p>
            <div>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setConfirmOpen(true)}
                disabled={Boolean(deleting)}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete Account
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-text-disabled">Account status unavailable.</p>
        )}
      </GlassPanel>

      {/* Confirmation dialog */}
      {confirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-dialog p-6 shadow-dialog">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-danger" />
              <h2 id="delete-account-title" className="text-lg font-semibold text-text-primary">
                Delete your account?
              </h2>
            </div>
            <div className="mt-3 space-y-1 text-sm text-text-secondary">
              <p>This will:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>revoke your sessions</li>
                <li>remove your organization memberships</li>
                <li>delete your personal account</li>
              </ul>
              <p className="pt-1">
                This will <span className="font-medium text-text-primary">not</span> automatically
                delete organization devices or data.
              </p>
            </div>
            <label
              htmlFor="delete-confirmation"
              className="mt-4 block text-xs font-medium text-text-secondary"
            >
              Type DELETE to continue
            </label>
            <input
              id="delete-confirmation"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="off"
              className="mt-1.5 h-10 w-full rounded-lg border border-border bg-surface-subtle px-3 text-sm text-text-primary outline-none focus:border-danger/50"
            />
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setConfirmOpen(false);
                  setConfirmation('');
                }}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmDelete}
                disabled={confirmation !== REQUIRED_CONFIRMATION || deleting}
                loading={deleting}
              >
                {deleting ? undefined : <Check className="mr-1.5 h-3.5 w-3.5" />}
                Delete my account
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
