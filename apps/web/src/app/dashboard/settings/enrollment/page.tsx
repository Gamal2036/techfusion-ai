'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { GlassPanel, Badge } from '@techfusion/ui';
import {
  Key, Copy, Check, Trash2, RefreshCw, Loader2, Plus, Clock, Shield, AlertCircle,
  ChevronDown, ChevronUp, Terminal, Download, ExternalLink, Eye, EyeOff, User,
} from 'lucide-react';
import { apiFetch } from '@/lib/auth-client';
import { resolveAgentReleaseBaseUrl } from '@/lib/agent-download';
import { toast } from 'sonner';

interface EnrollmentToken {
  id: string;
  label: string;
  maxUses: number;
  useCount: number;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  createdByUserId: string | null;
  createdByName: string;
  status: 'active' | 'revoked' | 'expired' | 'exhausted';
}

interface AuditLog {
  id: string;
  action: string;
  actorId: string | null;
  targetId: string | null;
  details: any;
  ipAddress: string | null;
  createdAt: string;
}

export default function EnrollmentPage() {
  const [tokens, setTokens] = useState<EnrollmentToken[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newMaxUses, setNewMaxUses] = useState(5);
  const [newExpires, setNewExpires] = useState('');
  const [creating, setCreating] = useState(false);
  const [newTokenValue, setNewTokenValue] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchTokens = useCallback(async () => {
    try {
      const res = await apiFetch('/enrollment/tokens');
      if (res.ok) {
        setTokens(await res.json());
      }
    } catch (e) {
      console.error('Failed to fetch tokens:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    try {
      const res = await apiFetch('/enrollment/audit');
      if (res.ok) {
        setAuditLogs(await res.json());
      }
    } catch (e) {
      console.error('Failed to fetch audit logs:', e);
    }
  }, []);

  useEffect(() => { fetchTokens(); }, [fetchTokens]);
  useEffect(() => { if (showAudit) fetchAuditLogs(); }, [showAudit, fetchAuditLogs]);

  const createToken = async () => {
    setCreating(true);
    try {
      const res = await apiFetch('/enrollment/tokens', {
        method: 'POST',
        body: JSON.stringify({
          label: newLabel || `token-${Date.now()}`,
          maxUses: newMaxUses,
          expiresAt: newExpires || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewTokenValue(data.token);
        setNewLabel('');
        setNewMaxUses(5);
        setNewExpires('');
        setShowCreate(false);
        fetchTokens();
        toast.success('Enrollment token created');
      } else {
        toast.error('Failed to create token');
      }
    } catch (e: any) {
      toast.error(`Error: ${e.message}`);
    } finally {
      setCreating(false);
    }
  };

  const revokeToken = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await apiFetch(`/enrollment/tokens/${id}`, { method: 'DELETE' });
      if (res.ok || res.status === 204) {
        fetchTokens();
        toast.success('Token revoked');
      } else {
        toast.error('Failed to revoke token');
      }
    } catch (e: any) {
      toast.error(`Error: ${e.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const regenerateToken = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await apiFetch(`/enrollment/tokens/${id}/regenerate`, { method: 'PATCH' });
      if (res.ok) {
        const data = await res.json();
        setNewTokenValue(data.token);
        fetchTokens();
        toast.success('Token regenerated');
      } else {
        toast.error('Failed to regenerate token');
      }
    } catch (e: any) {
      toast.error(`Error: ${e.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const copyToken = (token: string, id: string) => {
    navigator.clipboard.writeText(token);
    setCopiedId(id);
    toast.success('Token copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'revoked': return 'destructive';
      case 'expired': return 'warning';
      case 'exhausted': return 'secondary';
      default: return 'secondary';
    }
  };

  const getCommand = (token: string) => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    return `export TF_API_URL="${apiBase}"\nexport TF_ORG_TOKEN="${token}"\ncargo run`;
  };

  const getLinuxCommand = (token: string) => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
    const releaseBase = resolveAgentReleaseBaseUrl();
    const urlArg = ` --release "${releaseBase}"`;
    return [
      `curl -fsSL -o /tmp/techfusion-install.sh "${origin}/install-linux.sh"`,
      `curl -fsSL -o /tmp/techfusion-install.sh.sha256 "${origin}/install-linux.sh.sha256"`,
      `(cd /tmp && sha256sum -c techfusion-install.sh.sha256)`,
      `sudo bash /tmp/techfusion-install.sh --api "${apiBase}" --enroll-token "${token}"${urlArg}`,
    ].join('\n');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary tracking-tight">Device Enrollment</h1>
          <p className="text-sm text-text-muted mt-1">Manage enrollment tokens for device registration.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowAudit(!showAudit); if (!showAudit) fetchAuditLogs(); }}
            className="h-9 px-4 rounded-xl border border-border bg-surface-subtle hover:bg-surface-muted text-text-secondary hover:text-text-secondary text-xs font-medium transition-all flex items-center gap-2"
          >
            <Shield className="h-3.5 w-3.5" /> Audit Log
          </button>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="h-9 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-text-primary text-xs font-medium transition-all flex items-center gap-2"
          >
            <Plus className="h-3.5 w-3.5" /> Generate Token
          </button>
        </div>
      </div>

      {/* New Token Display */}
      {newTokenValue && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <GlassPanel intensity="medium" className="p-5 border-green-500/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <Key className="h-4 w-4 text-success" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">Enrollment Token Generated</p>
                  <p className="text-xs text-text-muted">Copy this token now. It will not be shown again.</p>
                </div>
              </div>
              <button onClick={() => setNewTokenValue(null)} className="text-text-disabled hover:text-text-secondary">
                <EyeOff className="h-4 w-4" />
              </button>
            </div>
            <div className="relative rounded-xl border border-border bg-black/40 p-4 font-mono text-xs">
              <pre className="text-success/80 whitespace-pre-wrap break-all">{newTokenValue}</pre>
              <button
                onClick={() => copyToken(newTokenValue, 'new')}
                className="absolute top-3 right-3 h-7 w-7 rounded-lg bg-surface-muted hover:bg-surface-muted flex items-center justify-center transition-all"
              >
                {copiedId === 'new' ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5 text-text-secondary" />}
              </button>
            </div>
            <div className="mt-3 rounded-xl border border-border bg-black/40 p-4 font-mono text-xs">
              <p className="text-text-disabled text-[10px] uppercase tracking-wider mb-2">Linux / macOS</p>
              <pre className="text-success/80 whitespace-pre-wrap">{getCommand(newTokenValue)}</pre>
              <button
                onClick={() => { navigator.clipboard.writeText(getCommand(newTokenValue)); toast.success('Command copied'); }}
                className="mt-2 text-xs text-primary hover:text-primary-300 transition-colors flex items-center gap-1"
              >
                <Copy className="h-3 w-3" /> Copy command
              </button>
            </div>
            <div className="mt-3 rounded-xl border border-border bg-black/40 p-4 font-mono text-xs">
              <p className="text-text-disabled text-[10px] uppercase tracking-wider mb-2">Linux (bootstrap installer)</p>
              <pre className="text-success/80 whitespace-pre-wrap">{getLinuxCommand(newTokenValue)}</pre>
              <button
                onClick={() => { navigator.clipboard.writeText(getLinuxCommand(newTokenValue)); toast.success('Linux install command copied'); }}
                className="mt-2 text-xs text-primary hover:text-primary-300 transition-colors flex items-center gap-1"
              >
                <Copy className="h-3 w-3" /> Copy install command
              </button>
            </div>
          </GlassPanel>
        </motion.div>
      )}

      {/* Create Token Form */}
      {showCreate && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <GlassPanel intensity="medium" className="p-5">
            <h3 className="text-sm font-medium text-text-primary mb-4">New Enrollment Token</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-text-muted block mb-1.5">Label</label>
                <input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g. production-server"
                  className="w-full h-9 px-3 rounded-xl bg-surface-subtle border border-border text-sm text-text-primary placeholder:text-text-disabled outline-none focus:border-primary-500/40 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1.5">Max Uses</label>
                <input
                  type="number"
                  value={newMaxUses}
                  onChange={(e) => setNewMaxUses(parseInt(e.target.value) || 1)}
                  min={1}
                  max={100}
                  className="w-full h-9 px-3 rounded-xl bg-surface-subtle border border-border text-sm text-text-primary outline-none focus:border-primary-500/40 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1.5">Expires (optional)</label>
                <input
                  type="datetime-local"
                  value={newExpires}
                  onChange={(e) => setNewExpires(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl bg-surface-subtle border border-border text-sm text-text-primary outline-none focus:border-primary-500/40 transition-colors [color-scheme:dark]"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={createToken}
                disabled={creating}
                className="h-9 px-5 rounded-xl bg-primary-600 hover:bg-primary-500 text-text-primary text-xs font-medium transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Key className="h-3.5 w-3.5" />}
                Generate
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="h-9 px-4 rounded-xl border border-border bg-surface-subtle hover:bg-surface-muted text-text-secondary text-xs transition-all"
              >
                Cancel
              </button>
            </div>
          </GlassPanel>
        </motion.div>
      )}

      {/* Token List */}
      <GlassPanel intensity="light" className="p-5">
        <h3 className="text-sm font-medium text-text-primary mb-4">Enrollment Tokens</h3>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 text-text-disabled animate-spin" />
          </div>
        ) : tokens.length === 0 ? (
          <div className="text-center py-8">
            <Key className="h-10 w-10 text-text-disabled mx-auto mb-3" />
            <p className="text-sm text-text-disabled">No enrollment tokens yet</p>
            <p className="text-xs text-text-disabled mt-1">Generate a token to connect your first device</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tokens.map((token) => (
              <div
                key={token.id}
                className="flex items-center justify-between p-3 rounded-xl border border-border bg-surface hover:bg-surface-subtle transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                    token.status === 'active' ? 'bg-green-500/10' : 'bg-surface-subtle'
                  }`}>
                    <Key className={`h-4 w-4 ${token.status === 'active' ? 'text-success' : 'text-text-disabled'}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-text-secondary font-medium truncate">{token.label}</p>
                      <Badge variant={statusColor(token.status) as any} className="text-[10px]">
                        {token.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-text-disabled">
                        {token.useCount}/{token.maxUses} uses
                      </span>
                      <span className="text-xs text-text-disabled">
                        Created {new Date(token.createdAt).toLocaleDateString()}
                      </span>
                      {token.createdByName && (
                        <span className="text-xs text-text-disabled flex items-center gap-1">
                          <User className="h-3 w-3" /> {token.createdByName}
                        </span>
                      )}
                      {token.expiresAt && (
                        <span className="text-xs text-text-disabled flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Expires {new Date(token.expiresAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {token.status === 'active' && (
                    <>
                      <button
                        onClick={() => regenerateToken(token.id)}
                        disabled={actionLoading === token.id}
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-text-disabled hover:text-text-secondary hover:bg-surface-muted transition-all"
                        title="Regenerate token"
                      >
                        {actionLoading === token.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={() => revokeToken(token.id)}
                        disabled={actionLoading === token.id}
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-text-disabled hover:text-danger hover:bg-red-500/10 transition-all"
                        title="Revoke token"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassPanel>

      {/* Audit Log */}
      {showAudit && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <GlassPanel intensity="light" className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-text-primary flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" /> Enrollment Audit Log
              </h3>
              <button onClick={() => setShowAudit(false)} className="text-text-disabled hover:text-text-secondary text-xs">
                Close
              </button>
            </div>
            {auditLogs.length === 0 ? (
              <p className="text-xs text-text-disabled text-center py-4">No audit events recorded</p>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {auditLogs.map((log) => (
                  <div key={log.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-surface text-xs">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                      log.action.includes('created') ? 'bg-green-400' :
                      log.action.includes('revoked') ? 'bg-red-400' :
                      log.action.includes('used') ? 'bg-blue-400' :
                      'bg-amber-400'
                    }`} />
                    <span className="text-text-secondary flex-1">
                      {log.action.replace('enrollment_token_', '').replace(/_/g, ' ')}
                    </span>
                    <span className="text-text-disabled shrink-0">{new Date(log.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </GlassPanel>
        </motion.div>
      )}

      {/* Help Section */}
      <GlassPanel intensity="light" className="p-5">
        <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
          <Terminal className="h-4 w-4 text-primary" /> Quick Start Guide
        </h3>
        <div className="space-y-3 text-xs text-text-secondary">
          <div className="flex items-start gap-3">
            <span className="h-5 w-5 rounded-full bg-primary-600/20 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
            <p>Click <strong className="text-text-secondary">Generate Token</strong> above to create an enrollment token</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="h-5 w-5 rounded-full bg-primary-600/20 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
            <p>Copy the token or the full install command for your operating system</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="h-5 w-5 rounded-full bg-primary-600/20 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
            <p>
              <strong className="text-text-secondary">Linux:</strong> run the one-time install command. It installs the agent,
              registers your device, and enables auto-start on boot. The token is single-use and not needed after installation.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="h-5 w-5 rounded-full bg-primary-600/20 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">4</span>
            <p>The device will appear in your dashboard automatically within seconds</p>
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
