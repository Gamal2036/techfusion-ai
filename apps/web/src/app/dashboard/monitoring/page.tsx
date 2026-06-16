'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { GlassPanel, Badge, Button, Dialog, DialogContent, DialogTitle, DialogHeader, DialogClose } from '@techfusion/ui';
import { Monitor, AlertTriangle, Bell, Plus, Settings, X, CheckCircle, Activity, Server, Wifi, HardDrive, Thermometer } from 'lucide-react';
import { useDeviceList, Device, DeviceMetric, DeviceScore } from '@/hooks/useDevices';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAlerts, useAlertRules, useAlertWebSocket, Alert, AlertRule } from '@/hooks/useAlerts';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getAuthHeaders() {
  const token = localStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function severityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'text-red-400 bg-red-400/10 border-red-400/20';
    case 'warning': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
    case 'info': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
    default: return 'text-white/40 bg-white/5 border-white/10';
  }
}

function severityBadgeVariant(severity: string): 'destructive' | 'warning' | 'primary' | 'default' {
  switch (severity) {
    case 'critical': return 'destructive';
    case 'warning': return 'warning';
    case 'info': return 'primary';
    default: return 'default';
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'active': return 'text-green-400';
    case 'inactive': case 'dead': return 'text-red-400';
    case 'unknown': return 'text-yellow-400';
    default: return 'text-white/40';
  }
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

interface DeviceTileData {
  device: Device;
  metric: DeviceMetric | null;
  score: DeviceScore | null;
}

function DeviceStatusTile({ data }: { data: DeviceTileData }) {
  const { device, metric, score } = data;
  const health = score?.healthScore ?? null;
  const isOnline = device.lastSeenAt && Date.now() - new Date(device.lastSeenAt).getTime() < 120_000;

  return (
    <GlassPanel intensity="light" className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isOnline ? 'bg-green-400' : 'bg-red-400'}`} />
          <span className="text-sm font-medium text-white truncate">{device.name}</span>
        </div>
        {health !== null && (
          <span className={`text-xs font-mono ${
            health >= 80 ? 'text-green-400' : health >= 50 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {health}/100
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="text-white/40">CPU</div>
        <div className="text-white/80 text-right font-mono">
          {metric?.cpuUsage != null ? `${metric.cpuUsage.toFixed(1)}%` : '-'}
        </div>
        <div className="text-white/40">RAM</div>
        <div className="text-white/80 text-right font-mono">
          {metric?.ramPercent != null ? `${metric.ramPercent.toFixed(1)}%` : '-'}
        </div>
        <div className="text-white/40">Disk</div>
        <div className="text-white/80 text-right font-mono">
          {metric?.diskTotal != null && metric?.diskUsed != null
            ? `${((metric.diskUsed / metric.diskTotal) * 100).toFixed(1)}%`
            : '-'}
        </div>
        <div className="text-white/40">Temp</div>
        <div className="text-white/80 text-right font-mono">
          {metric?.tempCpu != null ? `${metric.tempCpu.toFixed(0)}°C` : '-'}
        </div>
        <div className="text-white/40">Network</div>
        <div className="text-white/40 text-right font-mono text-[10px]">
          {metric?.networkRxBytes != null && metric?.networkTxBytes != null
            ? `Rx ${formatBytes(metric.networkRxBytes)}`
            : '-'}
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-white/5 flex items-center gap-1 text-[10px] text-white/30">
        <Server className="w-3 h-3" />
        <span className="truncate">{device.hostname ?? device.name}</span>
        <span className="ml-auto">{device.os ?? ''}</span>
      </div>
    </GlassPanel>
  );
}

function AlertFeed({ alerts, onAcknowledge }: { alerts: Alert[]; onAcknowledge: (id: string) => void }) {
  return (
    <div className="space-y-2">
      {alerts.length === 0 ? (
        <div className="text-center py-8 text-white/30 text-sm">
          <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-400/50" />
          No active alerts
        </div>
      ) : (
        alerts.slice(0, 20).map((alert) => (
          <div
            key={alert.id}
            className={`flex items-start gap-3 p-3 rounded-lg border ${severityColor(alert.severity)}`}
          >
            <div className="mt-0.5">
              {alert.severity === 'critical' ? (
                <AlertTriangle className="h-4 w-4 text-red-400" />
              ) : alert.severity === 'warning' ? (
                <AlertTriangle className="h-4 w-4 text-yellow-400" />
              ) : (
                <Bell className="h-4 w-4 text-blue-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-white/80">{alert.alertRule?.name ?? 'Alert'}</span>
                <Badge variant={severityBadgeVariant(alert.severity)}>
                  {alert.severity}
                </Badge>
              </div>
              <p className="text-xs text-white/60 mt-0.5">{alert.message}</p>
              <div className="flex items-center gap-2 mt-1 text-[10px] text-white/30">
                <span>{alert.device?.name ?? alert.deviceId}</span>
                <span>{new Date(alert.createdAt).toLocaleString()}</span>
              </div>
            </div>
            {!alert.acknowledgedAt && (
              <button
                onClick={() => onAcknowledge(alert.id)}
                className="text-white/30 hover:text-white/60 transition-colors"
                title="Acknowledge"
              >
                <CheckCircle className="h-4 w-4" />
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function RuleDialog({
  open, onClose, onSubmit, initial,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<AlertRule>) => void;
  initial?: AlertRule | null;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [metricName, setMetricName] = useState(initial?.metricName ?? 'cpuUsage');
  const [threshold, setThreshold] = useState(initial?.threshold?.toString() ?? '90');
  const [operator, setOperator] = useState(initial?.operator ?? 'gt');
  const [severity, setSeverity] = useState(initial?.severity ?? 'warning');
  const [debounce, setDebounce] = useState(initial?.debounceSeconds?.toString() ?? '300');
  const [webhookUrl, setWebhookUrl] = useState(initial?.webhookUrl ?? '');

  useEffect(() => {
    if (initial) {
      setName(initial.name);
      setDescription(initial.description ?? '');
      setMetricName(initial.metricName);
      setThreshold(initial.threshold.toString());
      setOperator(initial.operator);
      setSeverity(initial.severity);
      setDebounce(initial.debounceSeconds.toString());
      setWebhookUrl(initial.webhookUrl ?? '');
    }
  }, [initial]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      description: description || undefined,
      metricName,
      threshold: parseFloat(threshold),
      operator,
      severity,
      debounceSeconds: parseInt(debounce, 10) || 300,
      webhookUrl: webhookUrl || undefined,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o: boolean) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit Alert Rule' : 'New Alert Rule'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-white/60 mb-1">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white"
            required
          />
        </div>
        <div>
          <label className="block text-xs text-white/60 mb-1">Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-white/60 mb-1">Metric</label>
            <select
              value={metricName}
              onChange={(e) => setMetricName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white"
            >
              <option value="cpuUsage">CPU Usage</option>
              <option value="ramPercent">RAM Percent</option>
              <option value="diskPercent">Disk Percent</option>
              <option value="tempCpu">CPU Temperature</option>
              <option value="loadAverage1Min">Load Average (1m)</option>
              <option value="processes">Process Count</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1">Operator</label>
            <select
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white"
            >
              <option value="gt">&gt; (greater than)</option>
              <option value="lt">&lt; (less than)</option>
              <option value="gte">&gt;= (greater or equal)</option>
              <option value="lte">&lt;= (less or equal)</option>
              <option value="eq">= (equals)</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-white/60 mb-1">Threshold</label>
            <input
              type="number"
              step="0.1"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1">Severity</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white"
            >
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-white/60 mb-1">Debounce (seconds)</label>
            <input
              type="number"
              value={debounce}
              onChange={(e) => setDebounce(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1">Webhook URL</label>
            <input
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white"
              placeholder="https://hooks.example.com/alert"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button type="submit">{initial ? 'Update' : 'Create'}</Button>
        </div>
      </form>
      </DialogContent>
    </Dialog>
  );
}

export default function MonitoringPage() {
  const { devices, loading: devicesLoading } = useDeviceList();
  const { alerts, loading: alertsLoading, refetch: refetchAlerts, acknowledgeAlert } = useAlerts();
  const { rules, loading: rulesLoading, createRule, updateRule, deleteRule, refetch: refetchRules } = useAlertRules();
  const [deviceMetrics, setDeviceMetrics] = useState<Map<string, DeviceMetric>>(new Map());
  const [deviceScores, setDeviceScores] = useState<Map<string, DeviceScore>>(new Map());
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'alerts' | 'rules'>('overview');
  const [liveAlerts, setLiveAlerts] = useState<Alert[]>([]);

  const orgId = typeof window !== 'undefined' ? localStorage.getItem('orgId') ?? undefined : undefined;

  const onMetrics = useCallback((data: any) => {
    if (data.metric) {
      setDeviceMetrics((prev) => new Map(prev).set(data.deviceId, data.metric));
    }
    if (data.score) {
      setDeviceScores((prev) => new Map(prev).set(data.deviceId, data.score));
    }
  }, []);

  const onAlert = useCallback((alert: Alert) => {
    setLiveAlerts((prev) => [alert, ...prev].slice(0, 50));
    refetchAlerts();
  }, [refetchAlerts]);

  useWebSocket(orgId, onMetrics);
  useAlertWebSocket(orgId, onAlert);

  useEffect(() => {
    const fetchLatest = async () => {
      for (const device of devices) {
        try {
          const res = await fetch(`${API_URL}/devices/${device.id}/latest`, {
            headers: getAuthHeaders(),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.metrics) setDeviceMetrics((prev) => new Map(prev).set(device.id, data.metrics));
            if (data.scores) setDeviceScores((prev) => new Map(prev).set(device.id, data.scores));
          }
        } catch {}
      }
    };
    if (devices.length > 0) fetchLatest();
  }, [devices]);

  const filteredAlerts = [...liveAlerts, ...alerts].filter(
    (alert, i, arr) => arr.findIndex((a) => a.id === alert.id) === i,
  ).slice(0, 20);

  const handleCreateRule = async (data: Partial<AlertRule>) => {
    try {
      await createRule(data);
      refetchRules();
    } catch (e) {
      console.error('Failed to create rule:', e);
    }
  };

  const handleUpdateRule = async (data: Partial<AlertRule>) => {
    if (!editingRule) return;
    try {
      await updateRule(editingRule.id, data);
      refetchRules();
    } catch (e) {
      console.error('Failed to update rule:', e);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Monitoring Center</h1>
          <p className="text-sm text-white/40 mt-1">Real-time device monitoring and alert management.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => { setEditingRule(null); setShowRuleDialog(true); }}>
            <Plus className="w-4 h-4 mr-1" /> New Rule
          </Button>
        </div>
      </div>

      <div className="flex gap-1 bg-white/5 rounded-lg p-1 w-fit">
        {(['overview', 'alerts', 'rules'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm rounded-md transition-colors ${
              activeTab === tab
                ? 'bg-white/10 text-white'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            {tab === 'overview' && <><Activity className="w-4 h-4 inline mr-1.5" />Overview</>}
            {tab === 'alerts' && <><Bell className="w-4 h-4 inline mr-1.5" />Alerts</>}
            {tab === 'rules' && <><Settings className="w-4 h-4 inline mr-1.5" />Rules</>}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <>
          {filteredAlerts.length > 0 && (
            <GlassPanel intensity="light" className="p-4">
              <h2 className="text-sm font-medium text-white/80 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                Recent Alerts
              </h2>
              <AlertFeed alerts={filteredAlerts} onAcknowledge={acknowledgeAlert} />
            </GlassPanel>
          )}

          <div>
            <h2 className="text-sm font-medium text-white/80 mb-3 flex items-center gap-2">
              <Monitor className="w-4 h-4" />
              Devices ({devices.length})
            </h2>
            {devicesLoading ? (
              <div className="text-white/40 text-sm py-8 text-center">Loading devices...</div>
            ) : devices.length === 0 ? (
              <GlassPanel intensity="light" className="p-12 flex flex-col items-center justify-center text-center">
                <Server className="h-12 w-12 text-white/20 mb-4" />
                <h3 className="text-lg font-medium text-white/50">No devices registered</h3>
                <p className="text-sm text-white/30 mt-1 max-w-md">
                  Deploy the TechFusion agent to start monitoring devices in real-time.
                </p>
              </GlassPanel>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {devices.map((device) => (
                  <DeviceStatusTile
                    key={device.id}
                    data={{
                      device,
                      metric: deviceMetrics.get(device.id) ?? null,
                      score: deviceScores.get(device.id) ?? null,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'alerts' && (
        <GlassPanel intensity="light" className="p-4">
          <h2 className="text-sm font-medium text-white/80 mb-3 flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Alert Feed
          </h2>
          {alertsLoading ? (
            <div className="text-white/40 text-sm py-8 text-center">Loading alerts...</div>
          ) : (
            <AlertFeed alerts={filteredAlerts} onAcknowledge={acknowledgeAlert} />
          )}
        </GlassPanel>
      )}

      {activeTab === 'rules' && (
        <GlassPanel intensity="light" className="p-4">
          <h2 className="text-sm font-medium text-white/80 mb-3 flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Alert Rules
          </h2>
          {rulesLoading ? (
            <div className="text-white/40 text-sm py-8 text-center">Loading rules...</div>
          ) : rules.length === 0 ? (
            <div className="text-center py-8 text-white/30 text-sm">
              <Settings className="h-8 w-8 mx-auto mb-2 text-white/20" />
              No alert rules configured
              <div className="mt-2">
                <Button variant="secondary" size="sm" onClick={() => setShowRuleDialog(true)}>
                  <Plus className="w-4 h-4 mr-1" /> Create Rule
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {rules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${rule.enabled ? 'bg-green-400' : 'bg-white/20'}`} />
                      <span className="text-sm font-medium text-white/80">{rule.name}</span>
                      <Badge variant={severityBadgeVariant(rule.severity)}>
                        {rule.severity}
                      </Badge>
                      <span className="text-[10px] font-mono text-white/40">
                        {rule.metricName} {rule.operator} {rule.threshold}
                      </span>
                    </div>
                    {rule.description && (
                      <p className="text-xs text-white/40 mt-0.5">{rule.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => { setEditingRule(rule); setShowRuleDialog(true); }}
                      className="text-white/30 hover:text-white/60 transition-colors"
                      title="Edit"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteRule(rule.id)}
                      className="text-white/30 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassPanel>
      )}

      <RuleDialog
        open={showRuleDialog}
        onClose={() => { setShowRuleDialog(false); setEditingRule(null); }}
        onSubmit={editingRule ? handleUpdateRule : handleCreateRule}
        initial={editingRule}
      />
    </div>
  );
}
