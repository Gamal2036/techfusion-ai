'use client';

import { useState, useEffect, useCallback } from 'react';
import { GlassPanel, Skeleton, StatCard } from '@techfusion/ui';
import { RefreshCw, Activity, CheckCircle, XCircle, AlertTriangle, Loader2, ChevronDown, BarChart3, Zap, Clock, DollarSign } from 'lucide-react';

import { apiFetch } from '@/lib/auth-client';
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
  free: 'text-success bg-green-400/10 border-green-400/20',
  low: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  medium: 'text-warning bg-amber-400/10 border-amber-400/20',
  high: 'text-danger bg-red-400/10 border-red-400/20',
}

const speedTierBadge: Record<string, string> = {
  ultrafast: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  fast: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  medium: 'text-warning bg-amber-400/10 border-amber-400/20',
  slow: 'text-text-secondary bg-surface-subtle border-border',
}

function getStatusIcon(configured: boolean, available: boolean, circuitOpen: boolean) {
  if (!configured) return <XCircle className="h-4 w-4 text-text-disabled" />
  if (circuitOpen) return <AlertTriangle className="h-4 w-4 text-danger" />
  if (available) return <CheckCircle className="h-4 w-4 text-success" />
  return <Loader2 className="h-4 w-4 text-warning animate-spin" />
}

function getStatusLabel(configured: boolean, available: boolean, circuitOpen: boolean) {
  if (!configured) return { label: 'No Key', color: 'text-text-disabled' }
  if (circuitOpen) return { label: 'Circuit Open', color: 'text-danger' }
  if (available) return { label: 'Online', color: 'text-success' }
  return { label: 'Checking...', color: 'text-warning' }
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
        apiFetch('/ai/providers/status'),
        apiFetch('/ai/router/stats'),
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
      const res = await apiFetch('/ai/router/strategy', {
        method: 'PUT',
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
          <h1 className="text-2xl font-semibold text-text-primary tracking-tight">Settings</h1>
          <p className="text-sm text-text-muted mt-1">Manage your TechFusion AI configuration</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 h-9 px-4 rounded-xl border border-border bg-surface-subtle hover:bg-surface-muted text-text-secondary hover:text-text-primary text-xs transition-all disabled:opacity-40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* AI Provider Status */}
      <GlassPanel intensity="light" className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-text-primary">AI Provider Status</h3>
          {loading && <Loader2 className="h-4 w-4 text-text-disabled animate-spin" />}
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
                <tr className="border-b border-border text-left">
                  <th className="pb-3 text-xs font-medium text-text-muted uppercase tracking-wider">Provider</th>
                  <th className="pb-3 text-xs font-medium text-text-muted uppercase tracking-wider">Status</th>
                  <th className="pb-3 text-xs font-medium text-text-muted uppercase tracking-wider">Latency</th>
                  <th className="pb-3 text-xs font-medium text-text-muted uppercase tracking-wider">Cost</th>
                  <th className="pb-3 text-xs font-medium text-text-muted uppercase tracking-wider">Speed</th>
                  <th className="pb-3 text-xs font-medium text-text-muted uppercase tracking-wider">Circuit</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((p) => {
                  const status = getStatusLabel(p.configured, p.available, p.circuitOpen)
                  return (
                    <tr key={p.name} className="border-b border-border-subtle">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(p.configured, p.available, p.circuitOpen)}
                          <span className="text-text-secondary font-medium">{p.name}</span>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
                      </td>
                      <td className="py-3">
                        <span className="text-xs text-text-secondary">
                          {p.latencyMs !== null ? `${p.latencyMs}ms` : '--'}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${costTierBadge[p.costTier] || 'text-text-secondary bg-surface-subtle border-border'}`}>
                          {p.costTier === 'ultrafast' ? 'Ultra' : p.costTier.charAt(0).toUpperCase() + p.costTier.slice(1)}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${speedTierBadge[p.speedTier] || 'text-text-secondary bg-surface-subtle border-border'}`}>
                          {p.speedTier === 'ultrafast' ? 'Ultra' : p.speedTier.charAt(0).toUpperCase() + p.speedTier.slice(1)}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${p.circuitOpen ? 'bg-red-400' : 'bg-green-400'}`} />
                          <span className={`text-xs ${p.circuitOpen ? 'text-danger' : 'text-success'}`}>
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
        <h3 className="text-sm font-medium text-text-primary mb-4">Router Statistics</h3>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard title="Total Requests" value={stats.totalRequests} icon={<BarChart3 className="h-5 w-5 text-primary" />} />
            <StatCard title="Success Rate" value={`${stats.successRate.toFixed(1)}%`} icon={<Zap className="h-5 w-5 text-success" />} tone="success" />
            <StatCard title="Avg Latency" value={`${Math.round(stats.averageLatencyMs)}ms`} icon={<Clock className="h-5 w-5 text-primary" />} />
            <StatCard title="Total Cost" value={`$${stats.totalCostUsd.toFixed(4)}`} icon={<DollarSign className="h-5 w-5 text-primary" />} />
          </div>
        ) : (
          <p className="text-sm text-text-disabled">No statistics available yet. Make some AI requests first.</p>
        )}
      </GlassPanel>

      {/* Router Strategy */}
      <GlassPanel intensity="light" className="p-5">
        <h3 className="text-sm font-medium text-text-primary mb-4">Router Strategy</h3>
        <p className="text-xs text-text-muted mb-3">Choose how the AI router selects providers for each request.</p>
        <div className="relative inline-block">
          <select
            value={strategy}
            onChange={(e) => handleStrategyChange(e.target.value)}
            disabled={updatingStrategy}
            className="appearance-none h-10 pl-4 pr-10 rounded-xl border border-border-strong bg-surface-subtle text-text-secondary text-sm hover:bg-surface-muted hover:border-border-strong focus:outline-none focus:border-primary-400/50 transition-all disabled:opacity-40 cursor-pointer"
          >
            {strategies.map((s) => (
              <option key={s.value} value={s.value} className="bg-surface-950 text-text-secondary">
                {s.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-disabled pointer-events-none" />
          {updatingStrategy && (
            <Loader2 className="absolute right-10 top-1/2 -translate-y-1/2 h-4 w-4 text-primary animate-spin" />
          )}
        </div>
        {stats && (
          <p className="text-xs text-text-disabled mt-2">
            Current: <span className="text-text-secondary font-medium">{strategies.find(s => s.value === strategy)?.label || strategy}</span>
            {' | '}Primary: <span className="text-text-secondary font-medium">{stats.primaryProvider}</span>
          </p>
        )}
      </GlassPanel>
    </div>
  );
}
