'use client';

import { useState, useEffect, useCallback } from 'react';
import { GlassPanel, Badge, Card, CardHeader, CardTitle, CardContent } from '@techfusion/ui';
import {
  Network,
  Activity,
  Wifi,
  Globe,
  Search,
  Zap,
  BarChart3,
  Clock,
  Server,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import { NetworkMap } from '@/components/NetworkMap';
import {
  useNetworkDevices,
  useNetworkTopology,
  useNetworkScans,
  useLatencyCheck,
  useDnsResolution,
  useTraceroute,
  useConnectivityCheck,
  TopologyNode,
  NetworkDevice,
} from '@/hooks/useNetwork';

type Tab = 'map' | 'devices' | 'diagnostics' | 'scans';
type DiagTab = 'latency' | 'dns' | 'traceroute' | 'connectivity';

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}

const TAB_STYLE = (active: boolean) =>
  cn(
    'px-4 py-2 rounded-lg text-sm font-medium transition-all',
    active
      ? 'bg-primary-600/15 text-primary-400'
      : 'text-white/40 hover:text-white/60 hover:bg-white/[0.04]',
  );

export default function NetworkPage() {
  const [activeTab, setActiveTab] = useState<Tab>('map');
  const [diagTab, setDiagTab] = useState<DiagTab>('latency');
  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null);
  const [deviceSearch, setDeviceSearch] = useState('');

  const { devices, loading: devicesLoading, refetch: refetchDevices } = useNetworkDevices();
  const { topology, loading: topoLoading, refetch: refetchTopology } = useNetworkTopology();
  const { scans, loading: scansLoading } = useNetworkScans();
  const latency = useLatencyCheck();
  const dns = useDnsResolution();
  const traceroute = useTraceroute();
  const connectivity = useConnectivityCheck();

  const [latencyTarget, setLatencyTarget] = useState('8.8.8.8');
  const [dnsHostname, setDnsHostname] = useState('google.com');
  const [traceTarget, setTraceTarget] = useState('google.com');

  const handleNodeClick = useCallback((node: TopologyNode) => {
    setSelectedNode(node);
    setActiveTab('diagnostics');
    setLatencyTarget(node.ip);
    setDiagTab('latency');
  }, []);

  useEffect(() => {
    if (activeTab === 'diagnostics' && diagTab === 'connectivity' && !connectivity.result) {
      connectivity.run();
    }
  }, [activeTab, diagTab]);

  const connectedCount = devices.filter((d) => d.reachable).length;
  const offlineCount = devices.filter((d) => !d.reachable).length;

  const renderTopologyTab = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <GlassPanel intensity="light" className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary-500/10 flex items-center justify-center">
              <Wifi className="h-5 w-5 text-primary-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{topology?.nodes.length ?? 0}</p>
              <p className="text-xs text-white/40">Discovered Nodes</p>
            </div>
          </div>
        </GlassPanel>
        <GlassPanel intensity="light" className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
              <Activity className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-400">{connectedCount}</p>
              <p className="text-xs text-white/40">Reachable</p>
            </div>
          </div>
        </GlassPanel>
        <GlassPanel intensity="light" className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <Activity className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-400">{offlineCount}</p>
              <p className="text-xs text-white/40">Offline</p>
            </div>
          </div>
        </GlassPanel>
        <GlassPanel intensity="light" className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
              <Server className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-cyan-400">
                {topology?.scan?.subnet || 'N/A'}
              </p>
              <p className="text-xs text-white/40">Subnet</p>
            </div>
          </div>
        </GlassPanel>
      </div>

      <GlassPanel intensity="light" className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-white">Network Topology</h3>
          <button
            onClick={() => refetchTopology()}
            className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
          >
            Refresh
          </button>
        </div>
        {topoLoading && !topology ? (
          <div className="h-[500px] flex items-center justify-center text-white/30 text-sm">
            Loading topology...
          </div>
        ) : topology && topology.nodes.length > 0 ? (
          <NetworkMap topology={topology} onNodeClick={handleNodeClick} />
        ) : (
          <div className="h-[500px] flex flex-col items-center justify-center text-center">
            <Network className="h-10 w-10 text-white/20 mb-3" />
            <p className="text-white/30 text-sm">No topology data available.</p>
            <button
              onClick={() => refetchTopology()}
              className="mt-4 h-9 px-4 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-medium transition-colors"
            >
              Start Discovery
            </button>
          </div>
        )}
      </GlassPanel>
    </div>
  );

  const renderDevicesTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/40">{devices.length} devices</p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            type="text"
            placeholder="Search by IP, hostname, vendor..."
            value={deviceSearch}
            onChange={(e) => setDeviceSearch(e.target.value)}
            className="h-10 w-72 rounded-xl border border-white/[0.06] bg-white/[0.03] pl-10 pr-4 text-sm text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-primary-500/40 transition-all"
          />
        </div>
      </div>

      {devicesLoading && devices.length === 0 ? (
        <GlassPanel intensity="light" className="p-12 text-center">
          <Activity className="h-8 w-8 text-white/20 mx-auto mb-3 animate-pulse" />
          <p className="text-sm text-white/30">Loading devices...</p>
        </GlassPanel>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                <th className="text-left px-4 py-3 text-xs text-white/30 font-medium uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs text-white/30 font-medium uppercase tracking-wider">IP</th>
                <th className="text-left px-4 py-3 text-xs text-white/30 font-medium uppercase tracking-wider">Hostname</th>
                <th className="text-left px-4 py-3 text-xs text-white/30 font-medium uppercase tracking-wider">MAC</th>
                <th className="text-left px-4 py-3 text-xs text-white/30 font-medium uppercase tracking-wider">Vendor</th>
                <th className="text-left px-4 py-3 text-xs text-white/30 font-medium uppercase tracking-wider">Latency</th>
                <th className="text-left px-4 py-3 text-xs text-white/30 font-medium uppercase tracking-wider">Source</th>
                <th className="text-left px-4 py-3 text-xs text-white/30 font-medium uppercase tracking-wider">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {devices
                .filter(
                  (d) =>
                    !deviceSearch ||
                    d.ip.includes(deviceSearch) ||
                    (d.hostname && d.hostname.toLowerCase().includes(deviceSearch.toLowerCase())) ||
                    (d.vendor && d.vendor.toLowerCase().includes(deviceSearch.toLowerCase())),
                )
                .map((d) => (
                  <tr key={d.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <div className={cn('h-2.5 w-2.5 rounded-full', d.reachable ? 'bg-green-400' : 'bg-gray-500')} />
                    </td>
                    <td className="px-4 py-3 text-white font-mono text-xs">{d.ip}</td>
                    <td className="px-4 py-3 text-white/70">{d.hostname || '-'}</td>
                    <td className="px-4 py-3 text-white/50 font-mono text-xs">{d.mac || '-'}</td>
                    <td className="px-4 py-3">
                      {d.vendor ? (
                        <Badge variant="primary" className="text-[10px]">{d.vendor}</Badge>
                      ) : (
                        <span className="text-white/30">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white/70">
                      {d.latencyMs != null ? `${d.latencyMs.toFixed(1)}ms` : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-[10px]">{d.source}</Badge>
                    </td>
                    <td className="px-4 py-3 text-white/40 text-xs">
                      {new Date(d.lastSeenAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderDiagnosticsTab = () => (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['latency', 'dns', 'traceroute', 'connectivity'] as DiagTab[]).map((t) => (
          <button key={t} onClick={() => setDiagTab(t)} className={TAB_STYLE(diagTab === t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {diagTab === 'latency' && (
        <GlassPanel intensity="light" className="p-5">
          <h3 className="text-sm font-medium text-white mb-4">Latency Check</h3>
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              value={latencyTarget}
              onChange={(e) => setLatencyTarget(e.target.value)}
              placeholder="Target IP..."
              className="h-10 flex-1 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 text-sm text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-primary-500/40"
            />
            <button
              onClick={() => latency.run(latencyTarget, 4)}
              disabled={latency.running}
              className="h-10 px-5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {latency.running ? 'Running...' : 'Run'}
            </button>
          </div>
          {latency.result && (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-3">
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 text-center">
                  <p className="text-xs text-white/40">Avg</p>
                  <p className="text-lg font-bold text-white">
                    {latency.result.avg != null ? `${latency.result.avg.toFixed(1)}ms` : 'N/A'}
                  </p>
                </div>
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 text-center">
                  <p className="text-xs text-white/40">Min</p>
                  <p className="text-lg font-bold text-green-400">
                    {latency.result.min != null ? `${latency.result.min.toFixed(1)}ms` : 'N/A'}
                  </p>
                </div>
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 text-center">
                  <p className="text-xs text-white/40">Max</p>
                  <p className="text-lg font-bold text-red-400">
                    {latency.result.max != null ? `${latency.result.max.toFixed(1)}ms` : 'N/A'}
                  </p>
                </div>
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 text-center">
                  <p className="text-xs text-white/40">Packet Loss</p>
                  <p className={cn('text-lg font-bold', latency.result.packetLoss > 0 ? 'text-red-400' : 'text-green-400')}>
                    {latency.result.packetLoss.toFixed(0)}%
                  </p>
                </div>
              </div>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={latency.result.results.map((r) => ({
                      name: `#${r.seq}`,
                      latency: r.latencyMs ?? 0,
                      error: r.error || null,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(10,10,10,0.95)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '12px',
                        color: '#fff',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="latency" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </GlassPanel>
      )}

      {diagTab === 'dns' && (
        <GlassPanel intensity="light" className="p-5">
          <h3 className="text-sm font-medium text-white mb-4">DNS Resolution</h3>
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              value={dnsHostname}
              onChange={(e) => setDnsHostname(e.target.value)}
              placeholder="Hostname..."
              className="h-10 flex-1 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 text-sm text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-primary-500/40"
            />
            <button
              onClick={() => dns.run(dnsHostname)}
              disabled={dns.running}
              className="h-10 px-5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {dns.running ? 'Resolving...' : 'Resolve'}
            </button>
          </div>
          {dns.result && (
            <div className="space-y-3">
              {dns.result.results.map((r, i) => (
                <div key={i} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white">{r.resolver}</span>
                    <span className="text-xs text-white/40">{r.timeMs}ms</span>
                  </div>
                  {r.error ? (
                    <p className="text-xs text-red-400">{r.error}</p>
                  ) : r.addresses.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {r.addresses.map((addr, j) => (
                        <Badge key={j} variant="primary" className="text-[10px]">{addr}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-white/30">No records found</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </GlassPanel>
      )}

      {diagTab === 'traceroute' && (
        <GlassPanel intensity="light" className="p-5">
          <h3 className="text-sm font-medium text-white mb-4">Traceroute</h3>
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              value={traceTarget}
              onChange={(e) => setTraceTarget(e.target.value)}
              placeholder="Target hostname or IP..."
              className="h-10 flex-1 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 text-sm text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-primary-500/40"
            />
            <button
              onClick={() => traceroute.run(traceTarget)}
              disabled={traceroute.running}
              className="h-10 px-5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {traceroute.running ? 'Running...' : 'Trace'}
            </button>
          </div>
          {traceroute.result && (
            <div className="space-y-1">
              <div className="flex items-center gap-4 px-3 py-2 text-xs text-white/30 font-medium">
                <span className="w-8">Hop</span>
                <span className="flex-1">IP</span>
                <span className="w-20 text-right">Latency</span>
              </div>
              {traceroute.result.hops.map((hop) => (
                <div
                  key={hop.hop}
                  className="flex items-center gap-4 px-3 py-2 rounded-lg hover:bg-white/[0.03] transition-colors"
                >
                  <span className="w-8 text-xs text-white/40 font-mono">{hop.hop}</span>
                  <span className="flex-1 text-sm text-white font-mono text-xs">{hop.ip}</span>
                  <span className="w-20 text-right text-xs text-white/60">
                    {hop.latencyMs != null ? `${hop.latencyMs.toFixed(1)}ms` : '*'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </GlassPanel>
      )}

      {diagTab === 'connectivity' && (
        <GlassPanel intensity="light" className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-white">Connectivity Check</h3>
            <button
              onClick={() => connectivity.run()}
              disabled={connectivity.running}
              className="h-9 px-4 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
            >
              {connectivity.running ? 'Running...' : 'Run Check'}
            </button>
          </div>
          {connectivity.result && (
            <div className="space-y-3">
              {connectivity.result.results.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.06] p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn('h-3 w-3 rounded-full', r.reachable ? 'bg-green-400' : 'bg-red-400')} />
                    <span className="text-sm text-white font-medium">{r.name}</span>
                  </div>
                  <span className="text-xs text-white/50">
                    {r.reachable ? `${r.latencyMs?.toFixed(0)}ms` : r.error || 'Unreachable'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </GlassPanel>
      )}
    </div>
  );

  const renderScansTab = () => (
    <GlassPanel intensity="light" className="p-5">
      <h3 className="text-sm font-medium text-white mb-4">Scan History</h3>
      {scansLoading && scans.length === 0 ? (
        <p className="text-sm text-white/30 text-center py-8">Loading...</p>
      ) : scans.length === 0 ? (
        <p className="text-sm text-white/30 text-center py-8">No scans recorded yet</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                <th className="text-left px-4 py-3 text-xs text-white/30 font-medium uppercase tracking-wider">Time</th>
                <th className="text-left px-4 py-3 text-xs text-white/30 font-medium uppercase tracking-wider">Subnet</th>
                <th className="text-left px-4 py-3 text-xs text-white/30 font-medium uppercase tracking-wider">Devices</th>
                <th className="text-left px-4 py-3 text-xs text-white/30 font-medium uppercase tracking-wider">Gateway</th>
                <th className="text-left px-4 py-3 text-xs text-white/30 font-medium uppercase tracking-wider">Duration</th>
              </tr>
            </thead>
            <tbody>
              {scans.map((s) => (
                <tr key={s.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 text-white/70 text-xs">{new Date(s.startedAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-white font-mono text-xs">{s.subnet || '-'}</td>
                  <td className="px-4 py-3 text-white font-mono text-xs">{s.deviceCount}</td>
                  <td className="px-4 py-3 text-white/50 font-mono text-xs">{s.gatewayIp || '-'}</td>
                  <td className="px-4 py-3 text-white/70 text-xs">{s.scanDurationMs ? `${s.scanDurationMs}ms` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassPanel>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-white tracking-tight">Network Center</h1>
        <p className="text-sm text-white/40 mt-1">
          Local network discovery, topology mapping, and connectivity diagnostics.
        </p>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setActiveTab('map')} className={TAB_STYLE(activeTab === 'map')}>
          <BarChart3 className="h-4 w-4 inline mr-1.5" />
          Topology Map
        </button>
        <button onClick={() => setActiveTab('devices')} className={TAB_STYLE(activeTab === 'devices')}>
          <Wifi className="h-4 w-4 inline mr-1.5" />
          Devices
        </button>
        <button onClick={() => setActiveTab('diagnostics')} className={TAB_STYLE(activeTab === 'diagnostics')}>
          <Activity className="h-4 w-4 inline mr-1.5" />
          Diagnostics
        </button>
        <button onClick={() => setActiveTab('scans')} className={TAB_STYLE(activeTab === 'scans')}>
          <Clock className="h-4 w-4 inline mr-1.5" />
          Scan History
        </button>
      </div>

      {activeTab === 'map' && renderTopologyTab()}
      {activeTab === 'devices' && renderDevicesTab()}
      {activeTab === 'diagnostics' && renderDiagnosticsTab()}
      {activeTab === 'scans' && renderScansTab()}
    </div>
  );
}
