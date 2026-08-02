'use client';

import { useState, useCallback, useEffect } from 'react';
import { cn, GlassPanel, Badge } from '@techfusion/ui';
import {
  Monitor,
  Plus,
  Play,
  Square,
  Loader2,
  Activity,
  CheckCircle,
  XCircle,
  Video,
  Shield,
  MousePointer,
  Keyboard,
  Eye,
  EyeOff,
  AlertTriangle,
  RefreshCw,
  Wifi,
  WifiOff,
  Clock,
} from 'lucide-react';
import { useRemoteSessions, useCreateSession, useEndSession, useRecordings, useAuditLogs, useRemoteWebSocket, useDevices, DeviceInfo } from '@/hooks/useRemoteSupport';

type Tab = 'sessions' | 'viewer' | 'recordings' | 'audit';

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

function isDeviceOnline(lastSeenAt: string): boolean {
  const lastSeen = new Date(lastSeenAt).getTime();
  const thirtyMinAgo = Date.now() - 30 * 60 * 1000;
  return lastSeen > thirtyMinAgo;
}

const ACTION_COLORS: Record<string, string> = {
  session_start: 'text-primary bg-primary-500/10',
  session_end: 'text-text-secondary bg-surface-subtle',
  consent_granted: 'text-success bg-green-500/10',
  consent_denied: 'text-danger bg-red-500/10',
  input_sent: 'text-cyan-400 bg-cyan-500/10',
  screen_shared: 'text-purple-400 bg-purple-500/10',
  recording_saved: 'text-warning bg-amber-500/10',
  recording_started: 'text-warning bg-amber-500/10',
  recording_stopped: 'text-text-secondary bg-surface-subtle',
  recording_downloaded: 'text-primary bg-primary-500/10',
  input_control_enabled: 'text-cyan-400 bg-cyan-500/10',
  input_control_disabled: 'text-text-secondary bg-surface-subtle',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'text-success bg-green-500/10',
  pending: 'text-warning bg-amber-500/10',
  awaiting_consent: 'text-cyan-400 bg-cyan-500/10',
  connecting: 'text-primary bg-primary-500/10',
  ended: 'text-text-secondary bg-surface-subtle',
  error: 'text-danger bg-red-500/10',
  rejected: 'text-danger bg-red-500/10',
  expired: 'text-text-disabled bg-surface-subtle',
  failed: 'text-danger bg-red-500/10',
};

export default function RemoteSupportPage() {
  const [activeTab, setActiveTab] = useState<Tab>('sessions');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [showNewSession, setShowNewSession] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [screenFrame, setScreenFrame] = useState<string | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const { devices, loading: devicesLoading } = useDevices();
  const { sessions, loading: sessionsLoading, refetch: refetchSessions } = useRemoteSessions();
  const { createSession, creating } = useCreateSession();
  const { endSession } = useEndSession();
  const { recordings, loading: recordingsLoading, refetch: refetchRecordings } = useRecordings();
  const { logs, loading: logsLoading, refetch: refetchLogs } = useAuditLogs(selectedSessionId || undefined);

  useRemoteWebSocket(selectedSessionId, {
    onSessionUpdate: useCallback((session: any) => {
      if (session.status === 'active') {
        setSessionActive(true);
        setSessionError(null);
      }
      if (session.status === 'ended' || session.status === 'error' || session.status === 'failed' || session.status === 'rejected') {
        setSessionActive(false);
        setScreenFrame(null);
        if (session.status === 'error' || session.status === 'failed' || session.status === 'rejected') {
          setSessionError(session.errorMessage || `Session ${session.status}`);
        }
      }
      refetchSessions();
    }, [refetchSessions]),
    onSessionEnded: useCallback(() => {
      setSessionActive(false);
      setScreenFrame(null);
      refetchSessions();
    }, [refetchSessions]),
    onScreenFrame: useCallback((data: any) => {
      if (data.data) {
        setScreenFrame(data.data);
      }
    }, []),
  });

  useEffect(() => {
    if (!selectedSessionId) {
      const activeSessions = sessions.filter(s => s.status === 'active' || s.status === 'connecting');
      if (activeSessions.length === 1) {
        setSelectedSessionId(activeSessions[0].id);
      }
    }
  }, [sessions, selectedSessionId]);

  const tabStyle = (t: Tab, disabled = false) =>
    cn(
      'px-4 py-2 rounded-lg text-sm font-medium transition-all',
      disabled && 'opacity-40 cursor-not-allowed',
      activeTab === t ? 'bg-primary-600/15 text-primary' : 'text-text-secondary hover:text-text-secondary hover:bg-surface-subtle',
    );

  const activeSessions = sessions.filter((s) => s.status === 'active');
  const pendingSessions = sessions.filter((s) => s.status === 'pending' || s.status === 'awaiting_consent');

  const connectSession = useCallback(async (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setActiveTab('viewer');
    setSessionActive(true);
  }, []);

  const disconnectSession = useCallback(async () => {
    if (selectedSessionId) {
      await endSession(selectedSessionId);
    }
    setSessionActive(false);
    setScreenFrame(null);
    setSelectedSessionId(null);
    refetchSessions();
  }, [selectedSessionId, endSession, refetchSessions]);

  const handleCreateSession = useCallback(async () => {
    if (!selectedDeviceId.trim()) return;
    setSessionError(null);
    try {
      const result = await createSession(selectedDeviceId);
      if (result) {
        setShowNewSession(false);
        setSelectedDeviceId('');
        setSelectedSessionId(result.id);
        refetchSessions();
      }
    } catch (e: any) {
      setSessionError(e.message || 'Failed to create session');
    }
  }, [selectedDeviceId, createSession, refetchSessions]);

  const onlineDevices = devices.filter(d => !d.inactive && isDeviceOnline(d.lastSeenAt));
  const offlineDevices = devices.filter(d => d.inactive || !isDeviceOnline(d.lastSeenAt));
  const hasActiveSession = (deviceId: string) => sessions.some(s => s.deviceId === deviceId && (s.status === 'pending' || s.status === 'active' || s.status === 'awaiting_consent'));

  const canViewViewer = sessions.some(s => s.status === 'active' || s.status === 'connecting');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary tracking-tight">Remote Support</h1>
          <p className="text-sm text-text-secondary mt-1">Remote desktop, session recording, and audit logging.</p>
        </div>
        <button
          onClick={() => { setShowNewSession(!showNewSession); setSessionError(null); }}
          className="h-10 px-4 rounded-xl bg-primary-600 hover:bg-primary-500 text-text-primary text-sm font-medium transition-colors flex items-center gap-2"
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
        <button
          onClick={() => {
            if (!canViewViewer) return;
            if (!selectedSessionId || !sessions.some(s => s.id === selectedSessionId && (s.status === 'active' || s.status === 'connecting'))) {
              const firstActive = sessions.find(s => s.status === 'active' || s.status === 'connecting');
              if (firstActive) setSelectedSessionId(firstActive.id);
            }
            setActiveTab('viewer');
          }}
          className={tabStyle('viewer', !canViewViewer)}
          disabled={!canViewViewer}
          title={!canViewViewer ? 'Viewer becomes available when a remote session is active' : undefined}
        >
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
          <span className="text-sm text-success">{activeSessions.length} active remote session(s)</span>
        </div>
      )}

      {pendingSessions.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-sm text-warning">{pendingSessions.length} pending session(s) awaiting response</span>
        </div>
      )}

      {sessionError && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertTriangle className="h-4 w-4 text-danger" />
          <span className="text-sm text-danger">{sessionError}</span>
          <button onClick={() => setSessionError(null)} className="ml-auto text-text-disabled hover:text-text-secondary">
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      )}

      {showNewSession && (
        <GlassPanel intensity="light" className="p-5">
          <h3 className="text-sm font-medium text-text-primary mb-3">Start New Remote Session</h3>

          {devicesLoading ? (
            <div className="flex items-center gap-2 text-sm text-text-disabled py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading devices...
            </div>
          ) : devices.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-text-disabled py-4">
              <Monitor className="h-4 w-4" />
              No registered devices found. Register a device first.
            </div>
          ) : (
            <>
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="w-full h-10 rounded-xl border border-border bg-surface-subtle px-3 text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary-500/40 mb-3"
              >
                <option value="">Select a device...</option>
                {onlineDevices.length > 0 && (
                  <optgroup label="Online">
                    {onlineDevices.map((d) => (
                      <option key={d.id} value={d.id} disabled={hasActiveSession(d.id)}>
                        {d.hostname} ({d.os || 'Unknown OS'}) - Online
                        {hasActiveSession(d.id) ? ' - Session active' : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
                {offlineDevices.length > 0 && (
                  <optgroup label="Offline">
                    {offlineDevices.map((d) => (
                      <option key={d.id} value={d.id} disabled>
                        {d.hostname} ({d.os || 'Unknown OS'}) - Offline
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>

              <div className="flex gap-3">
                <button
                  onClick={handleCreateSession}
                  disabled={creating || !selectedDeviceId}
                  className="h-10 px-4 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:opacity-40 text-text-primary text-sm font-medium transition-colors flex items-center gap-2"
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Connect
                </button>
                <button
                  onClick={() => { setShowNewSession(false); setSelectedDeviceId(''); setSessionError(null); }}
                  className="h-10 px-4 rounded-xl border border-border text-text-secondary hover:text-text-secondary text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </GlassPanel>
      )}

      {activeTab === 'sessions' && (
        <div className="space-y-4">
          {sessionsLoading && sessions.length === 0 ? (
            <GlassPanel intensity="light" className="p-12 text-center">
              <Loader2 className="h-6 w-6 text-text-disabled mx-auto animate-spin" />
            </GlassPanel>
          ) : sessions.length === 0 ? (
            <GlassPanel intensity="light" className="p-12 text-center">
              <Monitor className="h-8 w-8 text-text-disabled mx-auto mb-2" />
              <p className="text-sm text-text-disabled">No remote sessions yet</p>
              <p className="text-xs text-text-disabled mt-1">Click "New Session" to start a remote support session</p>
            </GlassPanel>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {sessions.map((s) => {
                const device = devices.find(d => d.id === s.deviceId);
                const deviceLabel = device ? device.hostname : s.deviceId.slice(0, 12) + '...';
                return (
                  <GlassPanel key={s.id} intensity="light" className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          'h-10 w-10 rounded-xl flex items-center justify-center shrink-0',
                          s.status === 'active' ? 'bg-green-500/10' :
                          s.status === 'pending' || s.status === 'awaiting_consent' ? 'bg-amber-500/10' :
                          s.status === 'error' || s.status === 'failed' || s.status === 'rejected' ? 'bg-red-500/10' :
                          s.status === 'expired' ? 'bg-surface-subtle' : 'bg-surface-subtle',
                        )}>
                          <Monitor className={cn(
                            'h-5 w-5',
                            s.status === 'active' ? 'text-success' :
                            s.status === 'pending' || s.status === 'awaiting_consent' ? 'text-warning' :
                            s.status === 'error' || s.status === 'failed' || s.status === 'rejected' ? 'text-danger' : 'text-text-disabled',
                          )} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-medium text-text-primary">{deviceLabel}</h3>
                            <span className={cn(
                              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium',
                              STATUS_COLORS[s.status] || STATUS_COLORS.ended,
                            )}>
                              {s.status === 'active' && <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />}
                              {(s.status === 'pending' || s.status === 'awaiting_consent') && <div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />}
                              {s.status}
                            </span>
                            {s.consentGranted && <Badge variant="success" className="text-[10px]">Consent</Badge>}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-text-secondary">
                            <span>Protocol: {s.protocol}</span>
                            <span>Created: {formatDate(s.createdAt)}</span>
                            {s.startedAt && <span>Started: {formatDate(s.startedAt)}</span>}
                            {s.endedAt && <span>Ended: {formatDate(s.endedAt)}</span>}
                            {s.recordingPath && <span>Recording saved</span>}
                            {s.errorMessage && <span className="text-danger">{s.errorMessage}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {(s.status === 'active' || s.status === 'connecting') && (
                          <button
                            onClick={() => connectSession(s.id)}
                            className="h-8 w-8 rounded-lg flex items-center justify-center text-text-secondary hover:text-success hover:bg-surface-subtle transition-all"
                            title="View Session"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        )}
                        {(s.status === 'active' || s.status === 'pending' || s.status === 'awaiting_consent' || s.status === 'connecting') && (
                          <button
                            onClick={() => { setSelectedSessionId(s.id); endSession(s.id).then(refetchSessions); }}
                            className="h-8 w-8 rounded-lg flex items-center justify-center text-text-secondary hover:text-danger hover:bg-surface-subtle transition-all"
                            title="End Session"
                          >
                            <Square className="h-4 w-4" />
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
      )}

      {activeTab === 'viewer' && (
        <div>
          {!selectedSessionId ? (
            <GlassPanel intensity="light" className="p-12 text-center">
              <EyeOff className="h-8 w-8 text-text-disabled mx-auto mb-2" />
              <p className="text-sm text-text-disabled">No active remote session. Start or join a session to use the Viewer.</p>
            </GlassPanel>
          ) : (
            <GlassPanel intensity="light" className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    'h-2 w-2 rounded-full',
                    sessionActive ? 'bg-green-400 animate-pulse' : 'bg-surface-muted',
                  )} />
                  <span className="text-sm font-medium text-text-primary">
                    Session {selectedSessionId.slice(0, 8)}... {sessionActive ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                <button
                  onClick={disconnectSession}
                  className="h-8 px-3 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-danger text-xs font-medium transition-colors"
                >
                  <Square className="h-3.5 w-3.5 inline mr-1" />
                  End Session
                </button>
              </div>

              <div className="relative rounded-xl bg-black/40 border border-border overflow-hidden" style={{ minHeight: 400 }}>
                {screenFrame ? (
                  <img src={screenFrame} alt="Remote screen" className="w-full h-auto" />
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Monitor className="h-12 w-12 text-text-disabled mb-3" />
                    <p className="text-sm text-text-disabled">
                      {sessionActive ? 'Waiting for screen frames...' : 'Screen streaming is not available in this build'}
                    </p>
                    {!sessionActive && (
                      <p className="text-xs text-text-disabled mt-2 max-w-md">
                        V1 agent does not implement screen capture. Session request, consent, and lifecycle management are functional.
                      </p>
                    )}
                  </div>
                )}

                {sessionActive && (
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                    <div className="flex gap-1.5">
                      <button className="h-8 w-8 rounded-lg bg-black/50 hover:bg-black/70 text-text-secondary hover:text-text-primary flex items-center justify-center" title="Mouse (not available in V1)">
                        <MousePointer className="h-4 w-4 opacity-50" />
                      </button>
                      <button className="h-8 w-8 rounded-lg bg-black/50 hover:bg-black/70 text-text-secondary hover:text-text-primary flex items-center justify-center" title="Keyboard (not available in V1)">
                        <Keyboard className="h-4 w-4 opacity-50" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-text-secondary">
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
          <GlassPanel intensity="light" className="p-6">
            <div className="flex items-center gap-3">
              <Video className="h-5 w-5 text-text-disabled" />
              <div>
                <p className="text-sm text-text-primary font-medium">Session recording is not available in this build</p>
                <p className="text-xs text-text-secondary mt-0.5">
                  The V1 agent does not implement screen capture or recording. Recording controls are disabled until a future version adds this capability.
                </p>
              </div>
            </div>
          </GlassPanel>

          {recordingsLoading && recordings.length === 0 ? (
            <GlassPanel intensity="light" className="p-12 text-center">
              <Loader2 className="h-6 w-6 text-text-disabled mx-auto animate-spin" />
            </GlassPanel>
          ) : recordings.length === 0 ? (
            <GlassPanel intensity="light" className="p-12 text-center">
              <Video className="h-8 w-8 text-text-disabled mx-auto mb-2" />
              <p className="text-sm text-text-disabled">No recordings available yet</p>
            </GlassPanel>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recordings.map((r) => (
                <GlassPanel key={r.id} intensity="light" className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                      <Video className="h-5 w-5 text-warning" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-text-primary truncate">Device: {r.deviceId.slice(0, 12)}...</h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-text-secondary">
                        <span>Duration: {formatDuration(r.recordingDuration)}</span>
                        <span>Size: {formatSize(r.recordingSize)}</span>
                        <span>Date: {formatDate(r.startedAt)}</span>
                      </div>
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
          <div className="flex gap-2 items-center">
            <span className="text-xs text-text-secondary">Filter:</span>
            <select
              value={selectedSessionId || ''}
              onChange={(e) => setSelectedSessionId(e.target.value || null)}
              className="h-9 rounded-xl border border-border bg-surface-subtle px-3 text-xs text-text-primary outline-none"
            >
              <option value="">All Remote Support Events</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>{s.id.slice(0, 8)}... - {s.deviceId.slice(0, 8)}...</option>
              ))}
            </select>
          </div>

          {logsLoading && logs.length === 0 ? (
            <GlassPanel intensity="light" className="p-12 text-center">
              <Loader2 className="h-6 w-6 text-text-disabled mx-auto animate-spin" />
            </GlassPanel>
          ) : logs.length === 0 ? (
            <GlassPanel intensity="light" className="p-12 text-center">
              <Shield className="h-8 w-8 text-text-disabled mx-auto mb-2" />
              <p className="text-sm text-text-disabled">No remote support audit events found</p>
            </GlassPanel>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <GlassPanel key={log.id} intensity="light" className="p-3">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
                      ACTION_COLORS[log.action] || 'bg-surface-subtle',
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
                        <span className="text-xs font-medium text-text-primary capitalize">{log.action.replace(/_/g, ' ')}</span>
                        <span className="text-[10px] text-text-disabled">{formatDate(log.createdAt)}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-[11px] text-text-disabled">
                        {log.actorId && <span>Actor: {log.actorId.slice(0, 8)}...</span>}
                        {log.targetId && <span>Target: {log.targetId.slice(0, 8)}...</span>}
                        {log.ipAddress && <span>IP: {log.ipAddress}</span>}
                      </div>
                      {log.details && (
                        <p className="text-[11px] text-text-disabled mt-0.5 truncate">{JSON.stringify(log.details).slice(0, 100)}</p>
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
