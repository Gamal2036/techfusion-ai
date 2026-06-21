'use client';

import { useState, useEffect, useCallback } from 'react';
import { GlassPanel } from '@techfusion/ui';
import { RefreshCw, Activity, CheckCircle, XCircle, AlertTriangle, Loader2, ChevronDown } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getAuthHeaders() {
  const token = localStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

interface ProviderStatus {
  name: string
  configured: boolean
  available: boolean
  latencyMs: number | null
  costTier: string
  speedTier: string
  circuitOpen: boolean
  failureCount: number
  lastError: string | null
}

interface RouterStats {
  totalRequests: number
  successRate: number
  averageLatencyMs: number
  providerUsage: Record<string, number>
  totalCostUsd: number
  activeStrategy: string
  primaryProvider: string
}

const costTierBadge: Record<string, string> = {
  free: 'text-green-400 bg-green-400/10 border-green-400/20',
  low: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  medium: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  high: 'text-red-400 bg-red-400/10 border-red-400/20',
}

const speedTierBadge: Record<string, string> = {
  ultrafast: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  fast: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  medium: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  slow: 'text-white/50 bg-white/[0.04] border-white/[0.06]',
}

function getProviderIcon(name: string) {
  const status: ProviderStatus | undefined = undefined as any
  return null
}

function getStatusIcon(configured: boolean, available: boolean, circuitOpen: boolean) {
  if (!configured) return <XCircle className="h-4 w-4 text-white/20" />
  if (circuitOpen) return <AlertTriangle className="h-4 w-4 text-red-400" />
  if (available) return <CheckCircle className="h-4 w-4 text-green-400" />
  return <Loader2 className="h-4 w-4 text-amber-400 animate-spin" />
}

function getStatusLabel(configured: boolean, available: boolean, circuitOpen: boolean) {
  if (!configured) return { label: 'No Key', color: 'text-white/30' }
  if (circuitOpen) return { label: 'Circuit Open', color: 'text-red-400' }
  if (available) return { label: 'Online', color: 'text-green-400' }
  return { label: 'Checking...', color: 'text-amber-400' }
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`rounded-xl bg-white/[0.04] animate-pulse ${className || ''}`} />
}

const strategies = [
  { value: 'smart', label: 'Smart (Priority + Availability)' },
  { value: 'cost-first', label: 'Cost First (Free providers first)' },
  { value: 'speed-first', label: 'Speed First (Fastest providers first)' },
  { value: 'round-robin', label: 'Round Robin (Rotate equally)' },
]

export default function SettingsPage() {
  const [providers, setProviders] = useState<ProviderStatus[]>([])
  const [stats, setStats] = useState<RouterStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatingStrategy, setUpdatingStrategy] = useState(false)
  const [strategy, setStrategy] = useState('smart')

  const fetchData = useCallback(async () => {
    try {
      const [providersRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/ai/providers/status`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/ai/router/stats`, { headers: getAuthHeaders() }),
      ])
      if (providersRes.ok) {
        const data = await providersRes.json()
        setProviders(data)
      }
      if (statsRes.ok) {
        const data = await statsRes.json()
        setStats(data)
        setStrategy(data.activeStrategy)
      }
    } catch (e) {
      console.error('Failed to fetch AI provider data:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleStrategyChange = async (newStrategy: string) => {
    setUpdatingStrategy(true)
    try {
      const res = await fetch(`${API_URL}/ai/router/strategy`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ strategy: newStrategy }),
      })
      if (res.ok) {
        setStrategy(newStrategy)
      }
    } catch (e) {
      console.error('Failed to update strategy:', e)
    } finally {
      setUpdatingStrategy(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Settings</h1>
          <p className="text-sm text-white/40 mt-1">Manage your TechFusion AI configuration</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 h-9 px-4 rounded-xl border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] text-white/70 hover:text-white text-xs transition-all disabled:opacity-40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* AI Provider Status */}
      <GlassPanel intensity="light" className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-white">AI Provider Status</h3>
          {loading && <Loader2 className="h-4 w-4 text-white/30 animate-spin" />}
        </div>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left">
                  <th className="pb-3 text-xs font-medium text-white/40 uppercase tracking-wider">Provider</th>
                  <th className="pb-3 text-xs font-medium text-white/40 uppercase tracking-wider">Status</th>
                  <th className="pb-3 text-xs font-medium text-white/40 uppercase tracking-wider">Latency</th>
                  <th className="pb-3 text-xs font-medium text-white/40 uppercase tracking-wider">Cost</th>
                  <th className="pb-3 text-xs font-medium text-white/40 uppercase tracking-wider">Speed</th>
                  <th className="pb-3 text-xs font-medium text-white/40 uppercase tracking-wider">Circuit</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((p) => {
                  const status = getStatusLabel(p.configured, p.available, p.circuitOpen)
                  return (
                    <tr key={p.name} className="border-b border-white/[0.03]">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(p.configured, p.available, p.circuitOpen)}
                          <span className="text-white/80 font-medium">{p.name}</span>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
                      </td>
                      <td className="py-3">
                        <span className="text-xs text-white/50">
                          {p.latencyMs !== null ? `${p.latencyMs}ms` : '--'}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${costTierBadge[p.costTier] || 'text-white/50 bg-white/[0.04] border-white/[0.06]'}`}>
                          {p.costTier === 'ultrafast' ? 'Ultra' : p.costTier.charAt(0).toUpperCase() + p.costTier.slice(1)}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${speedTierBadge[p.speedTier] || 'text-white/50 bg-white/[0.04] border-white/[0.06]'}`}>
                          {p.speedTier === 'ultrafast' ? 'Ultra' : p.speedTier.charAt(0).toUpperCase() + p.speedTier.slice(1)}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${p.circuitOpen ? 'bg-red-400' : 'bg-green-400'}`} />
                          <span className={`text-xs ${p.circuitOpen ? 'text-red-400' : 'text-green-400'}`}>
                            {p.circuitOpen ? 'Open' : 'Closed'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassPanel>

      {/* Router Stats */}
      <GlassPanel intensity="light" className="p-5">
        <h3 className="text-sm font-medium text-white mb-4">Router Statistics</h3>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3">
              <p className="text-2xl font-bold text-white">{stats.totalRequests}</p>
              <p className="text-[10px] text-white/40 mt-0.5">Total Requests</p>
            </div>
            <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3">
              <p className="text-2xl font-bold text-green-400">{stats.successRate.toFixed(1)}%</p>
              <p className="text-[10px] text-white/40 mt-0.5">Success Rate</p>
            </div>
            <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3">
              <p className="text-2xl font-bold text-white">{Math.round(stats.averageLatencyMs)}ms</p>
              <p className="text-[10px] text-white/40 mt-0.5">Avg Latency</p>
            </div>
            <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3">
              <p className="text-2xl font-bold text-white">${stats.totalCostUsd.toFixed(4)}</p>
              <p className="text-[10px] text-white/40 mt-0.5">Total Cost</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-white/30">No statistics available yet. Make some AI requests first.</p>
        )}
      </GlassPanel>

      {/* Router Strategy */}
      <GlassPanel intensity="light" className="p-5">
        <h3 className="text-sm font-medium text-white mb-4">Router Strategy</h3>
        <p className="text-xs text-white/40 mb-3">Choose how the AI router selects providers for each request.</p>
        <div className="relative inline-block">
          <select
            value={strategy}
            onChange={(e) => handleStrategyChange(e.target.value)}
            disabled={updatingStrategy}
            className="appearance-none h-10 pl-4 pr-10 rounded-xl border border-white/[0.08] bg-white/[0.03] text-white/80 text-sm hover:bg-white/[0.06] hover:border-white/[0.12] focus:outline-none focus:border-primary-400/50 transition-all disabled:opacity-40 cursor-pointer"
          >
            {strategies.map((s) => (
              <option key={s.value} value={s.value} className="bg-[#0a0a0a] text-white/80">
                {s.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
          {updatingStrategy && (
            <Loader2 className="absolute right-10 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-400 animate-spin" />
          )}
        </div>
        {stats && (
          <p className="text-xs text-white/30 mt-2">
            Current: <span className="text-white/60 font-medium">{strategies.find(s => s.value === strategy)?.label || strategy}</span>
            {' | '}Primary: <span className="text-white/60 font-medium">{stats.primaryProvider}</span>
          </p>
        )}
      </GlassPanel>
    </div>
  );
}
