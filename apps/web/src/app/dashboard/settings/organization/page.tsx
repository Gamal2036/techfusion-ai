'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { GlassPanel, Badge, Button } from '@techfusion/ui';
import {
  Building2,
  Users,
  Monitor,
  Calendar,
  Fingerprint,
  Shield,
  AlertTriangle,
  Loader2,
  Pencil,
  Trash2,
  LogOut,
  Check,
  X,
} from 'lucide-react';
import { getCurrentUser, logout } from '@/lib/auth-client';
import { can, Permission } from '@/lib/permissions';
import {
  fetchOrganizationDetail,
  fetchMembers,
  renameOrganization,
  updateMemberRole,
  removeMember,
  leaveOrganization,
  ORG_SWITCH_EVENT,
  type OrganizationDetail,
  type OrganizationMember,
  type OrgRole,
} from '@/lib/org-client';

const ROLE_OPTIONS: OrgRole[] = ['Owner', 'Admin', 'Technician', 'Viewer'];

function roleBadgeVariant(role: string): 'primary' | 'success' | 'warning' | 'secondary' {
  switch (role) {
    case 'Owner': return 'primary';
    case 'Admin': return 'success';
    case 'Technician': return 'warning';
    default: return 'secondary';
  }
}

export default function OrganizationSettingsPage() {
  const router = useRouter();
  const currentUser = getCurrentUser();
  const orgId = currentUser?.orgId ?? null;

  const [detail, setDetail] = useState<OrganizationDetail | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const currentRole = detail?.membershipRole ?? currentUser?.role ?? 'Viewer';
  const canRename = can(currentUser, Permission.ORGANIZATION_UPDATE);
  const canRemoveMembers = can(currentUser, Permission.MEMBERS_REMOVE);
  const canChangeRoles = can(currentUser, Permission.MEMBERS_MANAGE);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError('');
    try {
      const [d, m] = await Promise.all([
        fetchOrganizationDetail(orgId),
        fetchMembers(orgId),
      ]);
      setDetail(d);
      setMembers(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load organization');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRename = async () => {
    const trimmed = newName.trim();
    if (!trimmed || !orgId || !detail) return;
    setActionLoading('rename');
    setError('');
    try {
      const updated = await renameOrganization(orgId, trimmed);
      setDetail({ ...detail, name: updated.name });
      setNewName('');
      setRenaming(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to rename organization');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRoleChange = async (userId: string, role: OrgRole) => {
    if (!orgId) return;
    setActionLoading(userId);
    setError('');
    try {
      const updated = await updateMemberRole(orgId, userId, role);
      setMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, role: updated.role } : m)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update role');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!orgId) return;
    setActionLoading(userId);
    setError('');
    try {
      await removeMember(orgId, userId);
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
      setConfirmRemove(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove member');
    } finally {
      setActionLoading(null);
    }
  };

  const handleLeave = async () => {
    if (!orgId) return;
    setActionLoading('leave');
    setError('');
    try {
      const res = await leaveOrganization(orgId);
      // If a fresh token pair was returned (active-org leave), persist it so
      // the fallback organization remains the authenticated context, and notify
      // the shell so org-scoped UI refreshes for the new active org.
      if ('accessToken' in res && res.accessToken) {
        const { setTokens } = await import('@/lib/auth-client');
        setTokens(res.accessToken, res.refreshToken);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent(ORG_SWITCH_EVENT, { detail: { orgId: res.user.orgId } }),
          );
        }
      }
      router.push('/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to leave organization');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteAttempt = () => {
    setError(
      'Organization deletion is not available in this V1 build. Your organization data is preserved.',
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-text-disabled" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-text-primary tracking-tight">Organization</h1>
        {error && (
          <GlassPanel intensity="light" className="p-4 border-red-500/30">
            <div className="flex items-center gap-2 text-sm text-danger">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          </GlassPanel>
        )}
      </div>
    );
  }

  const myMember = members.find((m) => m.isSelf);
  const isSoleOwner =
    currentRole === 'Owner' && members.filter((m) => m.role === 'Owner').length <= 1;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-semibold text-text-primary tracking-tight">Organization</h1>
        <p className="text-sm text-text-secondary mt-1">
          Manage this organization&apos;s identity, members, and lifecycle.
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

      {/* Organization Info */}
      <GlassPanel intensity="light" className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-medium text-text-primary">Organization</h3>
            <div className="mt-2 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600/20 border border-primary-500/30">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              {renaming ? (
                <div className="flex items-center gap-2">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && actionLoading !== 'rename') handleRename();
                      if (e.key === 'Escape') setRenaming(false);
                    }}
                    maxLength={100}
                    autoFocus
                    className="h-9 w-64 rounded-lg border border-border bg-surface-subtle px-3 text-sm text-text-primary outline-none focus:border-primary-500/40"
                  />
                  <Button size="sm" onClick={handleRename} loading={actionLoading === 'rename'} disabled={!newName.trim()}>
                    <Check className="mr-1 h-3.5 w-3.5" /> Save
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setRenaming(false)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-medium text-text-primary">{detail.name}</span>
                    <Badge variant={roleBadgeVariant(currentRole)} className="text-[10px]">
                      You: {currentRole}
                    </Badge>
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5">/{detail.slug}</p>
                </div>
              )}
            </div>
          </div>
          {canRename && !renaming && (
            <Button variant="outline" size="sm" onClick={() => setRenaming(true)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Rename
            </Button>
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <Monitor className="h-3.5 w-3.5 text-primary" /> Devices
            </div>
            <p className="mt-1 text-xl font-semibold text-text-primary tabular-nums">{detail.deviceCount}</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <Users className="h-3.5 w-3.5 text-primary" /> Members
            </div>
            <p className="mt-1 text-xl font-semibold text-text-primary tabular-nums">{detail.memberCount}</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <Calendar className="h-3.5 w-3.5 text-primary" /> Created
            </div>
            <p className="mt-1 text-sm font-medium text-text-primary">
              {new Date(detail.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <Fingerprint className="h-3.5 w-3.5 text-primary" /> Organization ID
            </div>
            <p className="mt-1 font-mono text-xs text-text-secondary break-all">{detail.id}</p>
          </div>
        </div>
      </GlassPanel>

      {/* Members */}
      <GlassPanel intensity="light" className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-text-primary">Members</h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Roles come from this organization&apos;s membership. Removing a member revokes access
              immediately.
            </p>
          </div>
        </div>

        {members.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-disabled">No members found.</p>
        ) : (
          <div className="space-y-2">
            {members.map((member) => {
              const isTargetOwner = member.role === 'Owner';
              const canChangeThisRole = canChangeRoles && !isTargetOwner;
              const canRemoveThis = canRemoveMembers && !member.isSelf && !isTargetOwner;
              return (
                <div
                  key={member.membershipId}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-600/20 border border-primary-500/30">
                      <span className="text-xs font-medium text-primary">
                        {(member.displayName || member.email).charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-text-primary">
                          {member.displayName || member.email}
                          {member.isSelf && <span className="text-xs text-text-secondary ml-1">(you)</span>}
                        </span>
                        {isTargetOwner && (
                          <Shield className="h-3.5 w-3.5 text-primary" aria-label="Owner" />
                        )}
                      </div>
                      <p className="truncate text-xs text-text-secondary mt-0.5">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {canChangeThisRole ? (
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.userId, e.target.value as OrgRole)}
                        disabled={actionLoading === member.userId}
                        aria-label={`Change role for ${member.displayName || member.email}`}
                        className="h-8 rounded-lg border border-border bg-surface-subtle px-2 text-xs text-text-primary outline-none focus:ring-2 focus:ring-primary-500/40 disabled:opacity-50"
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    ) : (
                      <Badge variant={roleBadgeVariant(member.role)} className="text-[10px]">
                        {member.role}
                      </Badge>
                    )}
                    {canRemoveThis &&
                      (confirmRemove === member.userId ? (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="danger"
                            size="xs"
                            onClick={() => handleRemove(member.userId)}
                            loading={actionLoading === member.userId}
                          >
                            Remove
                          </Button>
                          <Button variant="ghost" size="xs" onClick={() => setConfirmRemove(null)}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setConfirmRemove(member.userId)}
                          aria-label={`Remove ${member.displayName || member.email}`}
                          className="text-text-secondary hover:text-danger"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!canChangeRoles && (
          <p className="mt-3 text-xs text-text-disabled flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            You have {currentRole.toLowerCase()} access. Ask an Owner to manage members.
          </p>
        )}
      </GlassPanel>

      {/* Lifecycle */}
      <GlassPanel intensity="light" className="p-5">
        <h3 className="text-sm font-medium text-text-primary mb-1">Leave Organization</h3>
        <p className="text-xs text-text-secondary mb-3">
          Leaving removes your membership and access. You cannot leave if you are the last member or
          the only Owner of your last organization.
        </p>
        {confirmLeave ? (
          <div className="flex items-center gap-2">
            <Button
              variant="danger"
              size="sm"
              onClick={handleLeave}
              loading={actionLoading === 'leave'}
            >
              Confirm Leave
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmLeave(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmLeave(true)}
            disabled={Boolean(actionLoading)}
          >
            <LogOut className="mr-1.5 h-3.5 w-3.5" /> Leave Organization
          </Button>
        )}
        {isSoleOwner && (
          <p className="mt-2 text-xs text-warning flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            You are the only Owner. Transfer ownership before leaving.
          </p>
        )}

        {canRemoveMembers && (
          <>
            <div className="mt-5 border-t border-border pt-4">
              <h3 className="text-sm font-medium text-text-primary mb-1">Delete Organization</h3>
              <p className="text-xs text-text-secondary mb-3">
                Not available in this build to protect your data.
              </p>
              <Button variant="outline" size="sm" onClick={handleDeleteAttempt}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete Organization
              </Button>
            </div>
          </>
        )}

        {myMember && (
          <p className="mt-4 text-xs text-text-disabled">
            Joined {new Date(myMember.createdAt).toLocaleDateString()} ·{' '}
            <button
              type="button"
              className="text-text-secondary underline underline-offset-2 hover:text-text-primary"
              onClick={() => logout()}
            >
              Sign out
            </button>
          </p>
        )}
      </GlassPanel>
    </div>
  );
}
