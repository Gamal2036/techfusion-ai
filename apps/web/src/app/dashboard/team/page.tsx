'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  GlassPanel,
  Badge,
  Button,
  Input,
  Label,
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from '@techfusion/ui';
import {
  Users,
  Shield,
  Trash2,
  Loader2,
  AlertTriangle,
  UserPlus,
  Mail,
  RefreshCw,
} from 'lucide-react';

import { getCurrentUser } from '@/lib/auth-client';
import { can, Permission } from '@/lib/permissions';
import {
  fetchMembers,
  updateMemberRole,
  removeMember,
  createInvitation,
  fetchInvitations,
  revokeInvitation,
  resendInvitation,
  type OrganizationMember,
  type OrganizationInvitation,
  type InvitationStatus,
  type OrgRole,
} from '@/lib/org-client';

const ROLE_OPTIONS: OrgRole[] = ['Owner', 'Admin', 'Technician', 'Viewer'];

// V1 role policy mirror (V1-TEAM-01): Owners may invite Admin/Technician/
// Viewer; Admins only Technician/Viewer. Backend remains authoritative.
const INVITE_ROLES_BY_ACTOR: Record<'Owner' | 'Admin', OrgRole[]> = {
  Owner: ['Admin', 'Technician', 'Viewer'],
  Admin: ['Technician', 'Viewer'],
};

function roleBadgeVariant(role: string): 'primary' | 'success' | 'warning' | 'secondary' {
  switch (role) {
    case 'Owner': return 'primary';
    case 'Admin': return 'success';
    case 'Technician': return 'warning';
    default: return 'secondary';
  }
}

function statusBadgeVariant(status: InvitationStatus): 'primary' | 'success' | 'warning' | 'secondary' {
  switch (status) {
    case 'PENDING': return 'warning';
    case 'ACCEPTED': return 'success';
    case 'REVOKED': return 'secondary';
    case 'EXPIRED': return 'secondary';
    default: return 'secondary';
  }
}

export default function TeamPage() {
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrgRole>('Viewer');
  const [inviting, setInviting] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [inviteNotice, setInviteNotice] = useState('');

  const currentUser = getCurrentUser();
  const orgId = currentUser?.orgId ?? null;
  const canRemove = can(currentUser, Permission.MEMBERS_REMOVE);
  const canChangeRoles = can(currentUser, Permission.MEMBERS_MANAGE);
  const canInvite = can(currentUser, Permission.MEMBERS_MANAGE);
  const inviteRoleOptions =
    currentUser?.role === 'Admin' ? INVITE_ROLES_BY_ACTOR.Admin : INVITE_ROLES_BY_ACTOR.Owner;

  const fetchTeam = useCallback(async () => {
    if (!orgId) {
      setLoading(false);
      setError('Authentication required. Please log in again.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [memberData, invitationData] = await Promise.all([
        fetchMembers(orgId),
        canInvite ? fetchInvitations(orgId) : Promise.resolve([] as OrganizationInvitation[]),
      ]);
      setMembers(memberData);
      setInvitations(invitationData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load team data.');
    } finally {
      setLoading(false);
    }
  }, [orgId, canInvite]);

  useEffect(() => { fetchTeam(); }, [fetchTeam]);

  const handleRoleChange = async (userId: string, newRole: OrgRole) => {
    if (!orgId) return;
    setActionLoading(userId);
    setError('');
    try {
      const updated = await updateMemberRole(orgId, userId, newRole);
      setMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, role: updated.role } : m)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update role.');
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
      setError(e instanceof Error ? e.message : 'Failed to remove member.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateInvite = async () => {
    if (!orgId) return;
    setInviting(true);
    setError('');
    setInviteNotice('');
    setDevLink(null);
    try {
      const created = await createInvitation(orgId, inviteEmail, inviteRole);
      setInviteEmail('');
      setInviteRole('Viewer');
      setInviteOpen(false);
      if (created.devInvitationUrl) {
        setDevLink(created.devInvitationUrl);
      } else {
        setInviteNotice(`Invitation sent to ${created.email}.`);
      }
      await fetchTeam();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send invitation.');
    } finally {
      setInviting(false);
    }
  };

  const handleRevoke = async (invitationId: string) => {
    if (!orgId) return;
    setActionLoading(invitationId);
    setError('');
    try {
      await revokeInvitation(orgId, invitationId);
      await fetchTeam();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to revoke invitation.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResend = async (invitationId: string) => {
    if (!orgId) return;
    setActionLoading(invitationId);
    setError('');
    setDevLink(null);
    try {
      const resent = await resendInvitation(orgId, invitationId);
      if (resent.devInvitationUrl) setDevLink(resent.devInvitationUrl);
      await fetchTeam();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to resend invitation.');
    } finally {
      setActionLoading(null);
    }
  };

  const getRoleBadge = (member: OrganizationMember) => {
    if (member.role === 'Owner') {
      return <Badge variant="primary" className="text-[10px]"><Shield className="h-3 w-3 mr-0.5 inline" />{member.role}</Badge>;
    }
    return <Badge variant={roleBadgeVariant(member.role)} className="text-[10px]">{member.role}</Badge>;
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary tracking-tight">Team</h1>
          <p className="text-sm text-text-secondary mt-1">Manage your team members and their roles.</p>
        </div>
        <div className="flex items-center gap-2">
          {canInvite && (
            <Button variant="primary" size="sm" onClick={() => { setInviteOpen(true); setDevLink(null); }}>
              <UserPlus className="h-4 w-4 mr-1.5" />
              Invite member
            </Button>
          )}
          {!canRemove && (
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <AlertTriangle className="h-4 w-4" />
              <span>Only Owners can remove members.</span>
            </div>
          )}
        </div>
      </motion.div>

      {error && (
        <GlassPanel intensity="light" className="p-4 border-red-500/30">
          <div className="flex items-center gap-2 text-sm text-danger">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setError('')}>Dismiss</Button>
          </div>
        </GlassPanel>
      )}

      {devLink && (
        <GlassPanel intensity="light" className="p-4 border-primary-500/30">
          <div className="text-sm">
            <p className="text-xs uppercase tracking-wide text-primary font-semibold">Development invite link</p>
            <p className="mt-1.5 text-text-secondary">
              Email delivery is deferred in this build. Share this link directly with the invitee:
            </p>
            <code className="mt-2 block break-all rounded-md bg-surface-subtle px-3 py-2 text-xs text-primary">
              {devLink}
            </code>
          </div>
        </GlassPanel>
      )}

      {inviteNotice && (
        <GlassPanel intensity="light" className="p-4 border-primary-500/30">
          <div className="flex items-center gap-2 text-sm text-text-primary">
            <Mail className="h-4 w-4 shrink-0" />
            <span>{inviteNotice}</span>
          </div>
        </GlassPanel>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-surface-subtle animate-pulse" />)}
        </div>
      ) : members.length === 0 ? (
        <GlassPanel intensity="light" className="p-12 flex flex-col items-center justify-center text-center">
          <Users className="h-12 w-12 text-text-disabled mb-4" />
          <h3 className="text-lg font-medium text-text-secondary">No team members</h3>
          <p className="text-sm text-text-secondary mt-1 max-w-md">
            {canChangeRoles
              ? 'Add members through your organization settings to get started.'
              : 'Contact your organization owner to add team members.'}
          </p>
        </GlassPanel>
      ) : (
        <div className="space-y-2">
          {members.map((member) => {
            const isSelf = member.isSelf;
            const isTargetOwner = member.role === 'Owner';
            const canChangeThisRole = canChangeRoles && !isTargetOwner;
            const canRemoveThis = canRemove && !isSelf && !isTargetOwner;

            return (
              <GlassPanel key={member.membershipId} intensity="light" className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary-600/20 border border-primary-500/30 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">
                        {(member.displayName || member.email).charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text-primary">
                          {member.displayName || member.email}
                          {isSelf && <span className="text-xs text-text-secondary ml-1">(you)</span>}
                        </span>
                        {getRoleBadge(member)}
                      </div>
                      <p className="text-xs text-text-secondary mt-0.5">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canChangeThisRole && (
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.userId, e.target.value as OrgRole)}
                        disabled={actionLoading === member.userId}
                        className="h-8 rounded-lg border border-border bg-surface-subtle px-2 text-xs text-text-primary outline-none focus:ring-2 focus:ring-primary-500/40 disabled:opacity-50"
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    )}
                    {canRemoveThis && (
                      confirmRemove === member.userId ? (
                        <div className="flex items-center gap-1">
                          <Button variant="danger" size="xs" onClick={() => handleRemove(member.userId)} loading={actionLoading === member.userId}>
                            Remove
                          </Button>
                          <Button variant="ghost" size="xs" onClick={() => setConfirmRemove(null)}>Cancel</Button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmRemove(member.userId)}
                          className="h-8 w-8 rounded-lg flex items-center justify-center text-text-secondary hover:text-danger hover:bg-surface-subtle transition-all"
                          title={`Remove ${member.displayName || member.email}`}
                          aria-label={`Remove ${member.displayName || member.email}`}
                        >
                          {actionLoading === member.userId ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      )
                    )}
                  </div>
                </div>
              </GlassPanel>
            );
          })}
        </div>
      )}

      {canInvite && invitations.length > 0 && (
        <section aria-label="Pending invitations">
          <div className="mb-3 flex items-center gap-2">
            <Mail className="h-4 w-4 text-text-secondary" />
            <h2 className="text-sm font-semibold text-text-primary tracking-tight">Pending invitations</h2>
            <Badge variant="secondary" className="text-[10px]">{invitations.length}</Badge>
          </div>
          <div className="space-y-2">
            {invitations.map((inv) => {
              const actionable = inv.status === 'PENDING' || inv.status === 'EXPIRED';
              return (
                <GlassPanel key={inv.id} intensity="light" className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-surface-subtle border border-border flex items-center justify-center">
                        <Mail className="h-4 w-4 text-text-secondary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-text-primary">{inv.email}</span>
                          <Badge variant={statusBadgeVariant(inv.status)} className="text-[10px]">{inv.status}</Badge>
                        </div>
                        <p className="text-xs text-text-secondary mt-0.5">
                          {inv.role} &middot; invited by {inv.invitedBy?.email || 'a member'} &middot; expires {new Date(inv.expiresAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {actionable && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => handleResend(inv.id)}
                          loading={actionLoading === inv.id}
                          disabled={actionLoading !== null && actionLoading !== inv.id}
                        >
                          <RefreshCw className="h-3.5 w-3.5 mr-1" />
                          Resend
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          className="text-danger hover:text-danger"
                          onClick={() => handleRevoke(inv.id)}
                          disabled={actionLoading !== null && actionLoading !== inv.id}
                        >
                          Revoke
                        </Button>
                      </div>
                    )}
                  </div>
                </GlassPanel>
              );
            })}
          </div>
        </section>
      )}

      <Modal open={inviteOpen} onOpenChange={setInviteOpen}>
        <ModalContent size="md">
          <ModalHeader>
            <ModalTitle>Invite a member</ModalTitle>
            <ModalDescription>
              They will receive a link to join with the selected role. Invitations expire after 7 days.
            </ModalDescription>
          </ModalHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email address</Label>
              <Input
                id="invite-email"
                name="email"
                type="email"
                autoComplete="off"
                placeholder="teammate@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                disabled={inviting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-role">Role</Label>
              <select
                id="invite-role"
                name="role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as OrgRole)}
                disabled={inviting}
                className="h-10 w-full rounded-lg border border-input-border bg-input-background px-3 text-sm text-text-primary outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              >
                {inviteRoleOptions.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          <ModalFooter>
            <Button variant="ghost" size="sm" onClick={() => setInviteOpen(false)} disabled={inviting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={inviting}
              loadingText="Sending…"
              disabled={!inviteEmail.trim()}
              onClick={handleCreateInvite}
            >
              Send invitation
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
