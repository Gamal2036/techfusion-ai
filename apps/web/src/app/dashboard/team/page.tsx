'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { GlassPanel, Badge, Button } from '@techfusion/ui';
import { Users, Shield, UserCog, Trash2, Loader2, AlertTriangle } from 'lucide-react';

import { apiFetch, getCurrentUser, isAdminOrAbove, isOwner } from '@/lib/auth-client';
import type { TeamMember, TeamRole } from '@techfusion/types';

const ROLE_OPTIONS: TeamRole[] = ['Owner', 'Admin', 'Technician', 'Viewer'];

function roleBadgeVariant(role: string): 'primary' | 'success' | 'warning' | 'secondary' {
  switch (role) {
    case 'Owner': return 'primary';
    case 'Admin': return 'success';
    case 'Technician': return 'warning';
    default: return 'secondary';
  }
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const currentUser = getCurrentUser();
  const canManage = isAdminOrAbove(currentUser);
  const canChangeRoles = isOwner(currentUser);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/admin/users');
      if (res.ok) {
        const data = await res.json();
        setMembers(Array.isArray(data) ? data : data.data || []);
      } else if (res.status === 403) {
        setError('You do not have permission to view team members.');
      } else if (res.status === 401) {
        setError('Authentication required. Please log in again.');
      } else {
        const body = await res.json().catch(() => null);
        setError(body?.message || `Failed to load team members (${res.status}).`);
      }
    } catch {
      setError('Network error. Could not load team members.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const handleRoleChange = async (userId: string, newRole: TeamRole) => {
    setActionLoading(userId);
    try {
      const res = await apiFetch(`/admin/users/${userId}/role`, {
        method: 'POST',
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        fetchMembers();
      } else {
        const body = await res.json().catch(() => null);
        setError(body?.message || `Failed to update role (${res.status}).`);
      }
    } catch {
      setError('Network error. Could not update role.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async (userId: string) => {
    setActionLoading(userId);
    try {
      const res = await apiFetch(`/admin/users/${userId}/remove`, {
        method: 'POST',
      });
      if (res.ok) {
        fetchMembers();
      } else {
        const body = await res.json().catch(() => null);
        setError(body?.message || `Failed to remove member (${res.status}).`);
      }
    } catch {
      setError('Network error. Could not remove member.');
    } finally {
      setActionLoading(null);
    }
  };

  const getRoleBadge = (member: TeamMember) => {
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
        {!canManage && (
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <AlertTriangle className="h-4 w-4" />
            <span>Invite members through your organization admin.</span>
          </div>
        )}
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

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-surface-subtle animate-pulse" />)}
        </div>
      ) : members.length === 0 ? (
        <GlassPanel intensity="light" className="p-12 flex flex-col items-center justify-center text-center">
          <Users className="h-12 w-12 text-text-disabled mb-4" />
          <h3 className="text-lg font-medium text-text-secondary">No team members</h3>
          <p className="text-sm text-text-secondary mt-1 max-w-md">
            {canManage
              ? 'Add team members through your organization settings to get started.'
              : 'Contact your organization owner to add team members.'}
          </p>
        </GlassPanel>
      ) : (
        <div className="space-y-2">
          {members.map((member) => {
            const isSelf = member.id === currentUser?.sub;
            const isTargetOwner = member.role === 'Owner';
            const canRemoveThis = canManage && !isSelf && !isTargetOwner;
            const canChangeThisRole = canChangeRoles && !isTargetOwner;

            return (
              <GlassPanel key={member.id} intensity="light" className="p-4">
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
                        onChange={(e) => handleRoleChange(member.id, e.target.value as TeamRole)}
                        disabled={actionLoading === member.id}
                        className="h-8 rounded-lg border border-border bg-surface-subtle px-2 text-xs text-text-primary outline-none focus:ring-2 focus:ring-primary-500/40 disabled:opacity-50"
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    )}
                    {canRemoveThis && (
                      <button
                        onClick={() => handleRemove(member.id)}
                        disabled={actionLoading === member.id}
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-text-secondary hover:text-danger hover:bg-surface-subtle transition-all disabled:opacity-50"
                        title={`Remove ${member.displayName || member.email}`}
                      >
                        {actionLoading === member.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </GlassPanel>
            );
          })}
        </div>
      )}
    </div>
  );
}
