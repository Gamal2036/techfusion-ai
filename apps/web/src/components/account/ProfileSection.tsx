'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Avatar,
  AvatarFallback,
  Button,
  GlassPanel,
  Input,
  getInitials,
} from '@techfusion/ui';
import { Copy, Check, Loader2, Pencil, X, UserCog } from 'lucide-react';
import { updateDisplayName, type AccountSummary } from '@/lib/account-client';

interface ProfileSectionProps {
  summary: AccountSummary | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onUpdated: (summary: AccountSummary) => void;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function ProfileRow({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-xs text-text-muted">{label}</span>
      <span className="flex items-center gap-2 text-sm text-text-primary">
        {children ?? value}
      </span>
    </div>
  );
}

export function ProfileSection({
  summary,
  loading,
  error,
  onRetry,
  onUpdated,
}: ProfileSectionProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (editing && summary) setName(summary.displayName);
  }, [editing, summary]);

  const beginEdit = useCallback(() => {
    setEditError('');
    setSaved(false);
    setEditing(true);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditError('');
    setSaved(false);
    setEditing(false);
  }, []);

  const saveName = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setEditError('Display name cannot be empty.');
      return;
    }
    setSaving(true);
    setEditError('');
    setSaved(false);
    try {
      const updated = await updateDisplayName(trimmed);
      onUpdated(updated);
      setEditing(false);
      setSaved(true);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Failed to update display name.');
    } finally {
      setSaving(false);
    }
  }, [name, onUpdated]);

  const copyAccountId = useCallback(async () => {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summary.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (non-secure context): no action, no false success.
    }
  }, [summary]);

  return (
    <GlassPanel intensity="light" className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <UserCog className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-medium text-text-primary">Profile Information</h2>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-text-disabled" role="status">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading profile...
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
      ) : summary ? (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar size="lg">
              <AvatarFallback>{getInitials(summary.displayName || summary.email)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-base font-medium text-text-primary">{summary.displayName}</p>
              <p className="text-xs text-text-secondary">{summary.email}</p>
            </div>
          </div>

          <div className="divide-y divide-border-subtle">
            <div className="py-3">
              {editing ? (
                <div className="flex flex-col gap-3">
                  <Input
                    id="display-name"
                    label="Display name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={100}
                    disabled={saving}
                    error={editError || undefined}
                    aria-describedby="display-name-hint"
                  />
                  <p id="display-name-hint" className="text-xs text-text-muted">
                    This name is shown to members of your organization.
                  </p>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={saveName} loading={saving} disabled={saving}>
                      {saving ? undefined : <Check className="mr-1.5 h-3.5 w-3.5" />}
                      Save name
                    </Button>
                    <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={saving}>
                      <X className="mr-1.5 h-3.5 w-3.5" /> Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs text-text-muted">Display name</p>
                    <p className="text-sm text-text-primary">{summary.displayName}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={beginEdit}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                  </Button>
                </div>
              )}
              {saved && (
                <p className="mt-2 text-xs text-success" role="status">
                  Display name saved.
                </p>
              )}
            </div>

            <ProfileRow label="Email address">{summary.email}</ProfileRow>

            <div className="py-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-text-muted">Account ID</span>
              <div className="flex items-center gap-2">
                <code className="rounded border border-border bg-surface-subtle px-2 py-0.5 text-xs text-text-secondary">
                  {summary.id}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyAccountId}
                  aria-label="Copy account ID"
                  className="gap-1"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>

            <ProfileRow label="Account created" value={formatDate(summary.createdAt)} />
            <ProfileRow label="Last updated" value={formatDate(summary.updatedAt)} />
          </div>
        </div>
      ) : null}
    </GlassPanel>
  );
}
