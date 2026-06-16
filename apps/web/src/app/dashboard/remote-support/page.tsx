'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { GlassPanel, Badge } from '@techfusion/ui';
import {
  Monitor,
  Plus,
  Play,
  Square,
  RefreshCw,
  Clock,
  FileText,
  Activity,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronRight,
  AlertTriangle,
  Users,
  Video,
  History,
  Shield,
  MousePointer,
  Keyboard,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useRemoteSessions, useCreateSession, useEndSession, useRecordings, useAuditLogs, RemoteSession, AuditLog } from '@/hooks/useRemoteSupport';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

type Tab = 'sessions' | 'viewer' | 'recordings' | 'audit';

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}

function formatDate(d: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleString();
}

function formatDuration(seconds: number | null) {
  if (!seconds) return '-';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '-';
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(0) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return bytes + ' B';
}

const ACTION_COLORS: Record<string, string> = {
  session_start: 'text-primary-400 bg-primary-500/10',
  session_end: 'text-white/60 bg-white/[0.04]',
  consent_granted: 'text-green-400 bg-green-500/10',
  consent_denied: 'text-red-400 bg-red-500/10',
  input_sent: 'text-cyan-400 bg-cyan-500/10',
  screen_shared: 'text-purple-400 bg-purple-500/10',
  recording_saved: 'text-amber-400 bg-amber-500/10',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'text-green-400 bg-green-500/10',
  pending: 'text-amber-400 bg-amber-500/10',
  ended: 'text-white/40 bg-white/[0.04]',
  error: 'text-red-400 bg-red-500/10',
};

export default function RemoteSupportPage() {
  const [activeTab, setActiveTab] = useState<Tab>('sessions');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [showNewSession, setShowNewSession] = useState(false);
  const [deviceIdInput, setDeviceIdInput] = useState('');
  const [screenFrame, setScreenFrame] = useState<string | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const { sessions, loading: sessionsLoading, refetch: refetchSessions } = useRemoteSessions();
  const { createSession, creating } = useCreateSession();
  const { endSession } = useEndSession();
  const { recordings, loading: recordingsLoading, refetch: refetchRecordings } = useRecordings();
  const { logs, loading: logsLoading, refetch: refetchLogs } = useAuditLogs(selectedSessionId || undefined);

  const tabStyle = (t: Tab) =>
    cn(
      'px-4 py-2 rounded-lg text-sm font-medium transition-all',
      activeTab === t ? 'bg-primary-600/15 text-primary-400' : 'text-white/40 hover:text-white/60 hover:bg-white/[0.04]',
    );

  const activeSessions = sessions.filter((s) => s.status === 'active');
  const pendingSessions = sessions.filter((s) => s.status === 'pending');

  const connectSession = useCallback(async (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setActiveTab('viewer');

    const orgId = 'demo';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${WS_URL.replace(/^https?:\/\//, '')}/remote?orgId=${orgId}&sessionId=${sessionId}&role=technician`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setSessionActive(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'screen-frame' || msg.event === 'screen-frame') {
            setScreenFrame(msg.data || event.data);
          }
        } catch {
          setScreenFrame(event.data);
        }
      };

      ws.onclose = () => {
        setSessionActive(false);
      };

      return () => {
        ws.close();
        wsRef.current = null;
      };
    } catch (e) {
      console.error('Failed to connect to session:', e);
    }
  }, []);

  const disconnectSession = useCallback(async () => {
    if (selectedSessionId) {
      await endSession(selectedSessionId);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setSessionActive(false);
    setScreenFrame(null);
    setSelectedSessionId(null);
    refetchSessions();
  }, [selectedSessionId, endSession, refetchSessions]);

  const handleCreateSession = useCallback(async () => {
    if (!deviceIdInput.trim()) return;
    const result = await createSession(deviceIdInput.trim());
    if (result) {
      setShowNewSession(false);
      setDeviceIdInput('');
      refetchSessions();
    }
  }, [deviceIdInput, createSession, refetchSessions]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Remote Support</h1>
          <p className="text-sm text-white/40 mt-1">Remote desktop, session recording, and audit logging.</p>
        </div>
        <button
          onClick={() => setShowNewSession(!showNewSession)}
          className="h-10 px-4 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New Session
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setActiveTab('sessions')} className={tabStyle('sessions')}>
          <Monitor className="h-4 w-4 inline mr-1.5" />
          Sessions ({sessions.length})
        </button>
        <button onClick={() => setActiveTab('viewer')} className={tabStyle('viewer')} disabled={!selectedSessionId}>
          <Eye className="h-4 w-4 inline mr-1.5" />
          Viewer
        </button>
        <button onClick={() => setActiveTab('recordings')} className={tabStyle('recordings')}>
          <Video className="h-4 w-4 inline mr-1.5" />
          Recordings ({recordings.length})
        </button>
        <button onClick={() => setActiveTab('audit')} className={tabStyle('audit')}>
          <Shield className="h-4 w-4 inline mr-1.5" />
          Audit Log ({logs.length})
        </button>
      </div>

      {activeSessions.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500/10 border border-green-500/20">
          <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-sm text-green-400">{activeSessions.length} active remote session(s)</span>
        </div>
      )}

      {showNewSession && (
        <GlassPanel intensity="light" className="p-5">
          <h3 className="text-sm font-medium text-white mb-3">Start New Remote Session</h3>
          <div className="flex gap-3">
            <input
              value={deviceIdInput}
              onChange={(e) => setDeviceIdInput(e.target.value)}
              placeholder="Enter Device ID"
              className="flex-1 h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-white placeholder:text-white/20 outline-none focus:ring-2 focus:ring-primary-500/40"
            />
            <button
              onClick={handleCreateSession}
              disabled={creating || !deviceIdInput.trim()}
              className="h-10 px-4 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:opacity-40 text-white text-sm font-medium transition-colors flex items-center gap-2"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Connect
            </button>
            <button
              onClick={() => setShowNewSession(false)}
              className="h-10 px-4 rounded-xl border border-white/[0.06] text-white/50 hover:text-white/70 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </GlassPanel>
      )}

      {activeTab === 'sessions' && (
        <div className="space-y-4">
          {sessionsLoading && sessions.length === 0 ? (
            <GlassPanel intensity="light" className="p-12 text-center">
              <Loader2 className="h-6 w-6 text-white/20 mx-auto animate-spin" />
            </GlassPanel>
          ) : sessions.length === 0 ? (
            <GlassPanel intensity="light" className="p-12 text-center">
              <Monitor className="h-8 w-8 text-white/20 mx-auto mb-2" />
              <p className="text-sm text-white/30">No remote sessions yet</p>
            </GlassPanel>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {sessions.map((s) => (
                <GlassPanel key={s.id} intensity="light" className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'h-10 w-10 rounded-xl flex items-center justify-center shrink-0',
                        s.status === 'active' ? 'bg-green-500/10' :
                        s.status === 'pending' ? 'bg-amber-500/10' :
                        s.status === 'error' ? 'bg-red-500/10' : 'bg-white/[0.04]',
                      )}>
                        <Monitor className={cn(
                          'h-5 w-5',
                          s.status === 'active' ? 'text-green-400' :
                          s.status === 'pending' ? 'text-amber-400' :
                          s.status === 'error' ? 'text-red-400' : 'text-white/30',
                        )} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-medium text-white">Device: {s.deviceId.slice(0, 12)}...</h3>
                          <span className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium',
                            STATUS_COLORS[s.status] || STATUS_COLORS.ended,
                          )}>
                            {s.status === 'active' && <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />}
                            {s.status}
                          </span>
                          {s.consentGranted && <Badge variant="success" className="text-[10px]">Consent</Badge>}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-white/40">
                          <span>Protocol: {s.protocol}</span>
                          <span>Started: {formatDate(s.startedAt)}</span>
                          {s.endedAt && <span>Ended: {formatDate(s.endedAt)}</span>}
                          {s.recordingPath && <span>Recording saved</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {s.status === 'active' && (
                        <button
                          onClick={() => connectSession(s.id)}
                          className="h-8 w-8 rounded-lg flex items-center justify-center text-white/40 hover:text-green-400 hover:bg-white/[0.04] transition-all"
                          title="View Session"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      )}
                      {s.status === 'active' && (
                        <button
                          onClick={() => { setSelectedSessionId(s.id); endSession(s.id).then(refetchSessions); }}
                          className="h-8 w-8 rounded-lg flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-white/[0.04] transition-all"
                          title="End Session"
                        >
                          <Square className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </GlassPanel>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'viewer' && (
        <div>
          {!selectedSessionId ? (
            <GlassPanel intensity="light" className="p-12 text-center">
              <EyeOff className="h-8 w-8 text-white/20 mx-auto mb-2" />
              <p className="text-sm text-white/30">Select an active session to view</p>
            </GlassPanel>
          ) : (
            <GlassPanel intensity="light" className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    'h-2 w-2 rounded-full',
                    sessionActive ? 'bg-green-400 animate-pulse' : 'bg-white/20',
                  )} />
                  <span className="text-sm font-medium text-white">
                    Session {selectedSessionId.slice(0, 8)}... {sessionActive ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                <button
                  onClick={disconnectSession}
                  className="h-8 px-3 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs font-medium transition-colors"
                >
                  <Square className="h-3.5 w-3.5 inline mr-1" />
                  End Session
                </button>
              </div>

              <div className="relative rounded-xl bg-black/40 border border-white/[0.06] overflow-hidden" style={{ minHeight: 400 }}>
                {screenFrame ? (
                  <img src={screenFrame} alt="Remote screen" className="w-full h-auto" />
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Monitor className="h-12 w-12 text-white/20 mb-3" />
                    <p className="text-sm text-white/30">
                      {sessionActive ? 'Waiting for screen frames...' : 'Click Connect to start viewing'}
                    </p>
                    {!sessionActive && (
                      <button
                        onClick={() => connectSession(selectedSessionId)}
                        className="mt-4 h-9 px-4 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5"
                      >
                        <Play className="h-3.5 w-3.5" /> Connect
                      </button>
                    )}
                  </div>
                )}

                {sessionActive && (
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                    <div className="flex gap-1.5">
                      <button className="h-8 w-8 rounded-lg bg-black/50 hover:bg-black/70 text-white/50 hover:text-white flex items-center justify-center" title="Mouse">
                        <MousePointer className="h-4 w-4" />
                      </button>
                      <button className="h-8 w-8 rounded-lg bg-black/50 hover:bg-black/70 text-white/50 hover:text-white flex items-center justify-center" title="Keyboard">
                        <Keyboard className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-white/40">
                      <div className="h-2 w-2 rounded-full bg-green-400" />
                      Live
                    </div>
                  </div>
                )}
              </div>
            </GlassPanel>
          )}
        </div>
      )}

      {activeTab === 'recordings' && (
        <div className="space-y-4">
          {recordingsLoading && recordings.length === 0 ? (
            <GlassPanel intensity="light" className="p-12 text-center">
              <Loader2 className="h-6 w-6 text-white/20 mx-auto animate-spin" />
            </GlassPanel>
          ) : recordings.length === 0 ? (
            <GlassPanel intensity="light" className="p-12 text-center">
              <Video className="h-8 w-8 text-white/20 mx-auto mb-2" />
              <p className="text-sm text-white/30">No recordings available yet</p>
            </GlassPanel>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recordings.map((r) => (
                <GlassPanel key={r.id} intensity="light" className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                      <Video className="h-5 w-5 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-white truncate">Device: {r.deviceId.slice(0, 12)}...</h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-white/40">
                        <span>Duration: {formatDuration(r.recordingDuration)}</span>
                        <span>Size: {formatSize(r.recordingSize)}</span>
                        <span>Date: {formatDate(r.startedAt)}</span>
                      </div>
                      {r.recordingPath && (
                        <div className="mt-3">
                          <button className="h-8 px-3 rounded-lg bg-primary-600/20 hover:bg-primary-600/30 text-primary-400 text-xs font-medium transition-colors flex items-center gap-1.5">
                            <Play className="h-3.5 w-3.5" /> Play Recording
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </GlassPanel>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <select
              value={selectedSessionId || ''}
              onChange={(e) => setSelectedSessionId(e.target.value || null)}
              className="h-9 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 text-xs text-white outline-none"
            >
              <option value="">All Sessions</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>{s.id.slice(0, 8)}... - {s.deviceId.slice(0, 8)}...</option>
              ))}
            </select>
          </div>

          {logsLoading && logs.length === 0 ? (
            <GlassPanel intensity="light" className="p-12 text-center">
              <Loader2 className="h-6 w-6 text-white/20 mx-auto animate-spin" />
            </GlassPanel>
          ) : logs.length === 0 ? (
            <GlassPanel intensity="light" className="p-12 text-center">
              <Shield className="h-8 w-8 text-white/20 mx-auto mb-2" />
              <p className="text-sm text-white/30">No audit logs found</p>
            </GlassPanel>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <GlassPanel key={log.id} intensity="light" className="p-3">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
                      ACTION_COLORS[log.action] || 'bg-white/[0.04]',
                    )}>
                      {log.action === 'session_start' && <Play className="h-4 w-4" />}
                      {log.action === 'session_end' && <Square className="h-4 w-4" />}
                      {log.action === 'consent_granted' && <CheckCircle className="h-4 w-4" />}
                      {log.action === 'consent_denied' && <XCircle className="h-4 w-4" />}
                      {log.action === 'input_sent' && <MousePointer className="h-4 w-4" />}
                      {log.action === 'screen_shared' && <Monitor className="h-4 w-4" />}
                      {log.action === 'recording_saved' && <Video className="h-4 w-4" />}
                      {!['session_start', 'session_end', 'consent_granted', 'consent_denied', 'input_sent', 'screen_shared', 'recording_saved'].includes(log.action) && <Activity className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-white capitalize">{log.action.replace(/_/g, ' ')}</span>
                        <span className="text-[10px] text-white/30">{formatDate(log.createdAt)}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-[11px] text-white/30">
                        {log.actorId && <span>Actor: {log.actorId.slice(0, 8)}...</span>}
                        {log.targetId && <span>Target: {log.targetId.slice(0, 8)}...</span>}
                        {log.ipAddress && <span>IP: {log.ipAddress}</span>}
                      </div>
                      {log.details && (
                        <p className="text-[11px] text-white/20 mt-0.5 truncate">{JSON.stringify(log.details).slice(0, 100)}</p>
                      )}
                    </div>
                  </div>
                </GlassPanel>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
