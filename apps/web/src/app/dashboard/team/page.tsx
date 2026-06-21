'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { GlassPanel, Badge, Button } from '@techfusion/ui';
import { Users, Plus, Mail, Shield, UserCog, Trash2, Loader2, CheckCircle, XCircle } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getAuthHeaders() {
  const token = localStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

interface TeamMember {
  id: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
  createdAt: string;
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [inviting, setInviting] = useState(false);

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/team/members`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setMembers(Array.isArray(data) ? data : data.data || data.members || []);
      }
    } catch (e) {
      console.error('Failed to fetch team members:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const handleInvite = async () => {
    if (!email.trim()) return;
    setInviting(true);
    try {
      const res = await fetch(`${API_URL}/team/members`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ email: email.trim(), role }),
      });
      if (res.ok) {
        setShowInvite(false);
        setEmail('');
        fetchMembers();
      }
    } catch (e) {
      console.error('Failed to invite member:', e);
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/team/members/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) fetchMembers();
    } catch (e) {
      console.error('Failed to remove member:', e);
    }
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Team</h1>
          <p className="text-sm text-white/40 mt-1">Manage your team members and their roles.</p>
        </div>
        <Button variant="glass" size="sm" onClick={() => setShowInvite(!showInvite)}>
          <Plus className="h-4 w-4 mr-1" /> Invite Member
        </Button>
      </motion.div>

      {showInvite && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <GlassPanel intensity="light" className="p-5">
            <h3 className="text-sm font-medium text-white mb-4">Invite Team Member</h3>
            <div className="flex gap-3">
              <input value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="flex-1 h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-white outline-none focus:ring-2 focus:ring-primary-500/40" />
              <select value={role} onChange={(e) => setRole(e.target.value)}
                className="h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-white outline-none focus:ring-2 focus:ring-primary-500/40">
                <option value="viewer">Viewer</option>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <Button variant="glass" size="sm" onClick={handleInvite} disabled={!email.trim() || inviting}>
                {inviting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Mail className="h-4 w-4 mr-1" />}
                Invite
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowInvite(false)}>Cancel</Button>
            </div>
          </GlassPanel>
        </motion.div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-white/[0.04] animate-pulse" />)}
        </div>
      ) : members.length === 0 ? (
        <GlassPanel intensity="light" className="p-12 flex flex-col items-center justify-center text-center">
          <Users className="h-12 w-12 text-white/20 mb-4" />
          <h3 className="text-lg font-medium text-white/50">No team members</h3>
          <p className="text-sm text-white/30 mt-1 max-w-md">
            Invite team members to collaborate on managing your devices and infrastructure.
          </p>
          <Button variant="glass" size="sm" className="mt-4" onClick={() => setShowInvite(true)}>
            <Plus className="h-4 w-4 mr-1" /> Invite Member
          </Button>
        </GlassPanel>
      ) : (
        <div className="space-y-2">
          {members.map((member) => (
            <GlassPanel key={member.id} intensity="light" className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary-600/20 border border-primary-500/30 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary-400">
                      {(member.displayName || member.email).charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{member.displayName || member.email}</span>
                      <Badge variant={member.role === 'admin' ? 'primary' : member.role === 'member' ? 'success' : 'secondary'} className="text-[10px]">
                        {member.role}
                      </Badge>
                    </div>
                    <p className="text-xs text-white/40 mt-0.5">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={member.status === 'active' ? 'success' : 'warning'} className="text-[10px]">
                    {member.status}
                  </Badge>
                  {member.role !== 'admin' && (
                    <button onClick={() => handleRemove(member.id)}
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-white/[0.04] transition-all">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </GlassPanel>
          ))}
        </div>
      )}
    </div>
  );
}
