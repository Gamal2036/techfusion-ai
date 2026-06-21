'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { GlassPanel, Badge } from '@techfusion/ui';
import {
  Activity, Monitor, AlertTriangle, Shield, Network, HardDrive, TrendingUp, Users,
  ArrowUpRight, ArrowDownRight, Cpu, Wifi, ChevronRight, Download, CheckCircle, Loader2,
} from 'lucide-react';
import { useDeviceList, Device } from '@/hooks/useDevices';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getAuthHeaders() {
  const token = localStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef(0);
  const frameRef = useRef<number>();

  useEffect(() => {
    startRef.current = 0;
    const duration = 800;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * value);
      setDisplay(current);
      if (progress < 1) frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [value]);

  return <>{display}{suffix}</>;
}

function CountCard({ label, value, change, trend, icon: Icon, color }: {
  label: string; value: number; change?: string; trend?: 'up' | 'down'; icon: any; color: string;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <GlassPanel intensity="light" className="p-5 glass-card-hover">
        <div className="flex items-start justify-between">
          <div className="h-10 w-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
          {change && (
            <Badge variant={trend === 'up' ? 'success' : 'warning'} className="text-[10px]">
              {change}
              {trend === 'up' ? <ArrowUpRight className="h-3 w-3 ml-0.5" /> : <ArrowDownRight className="h-3 w-3 ml-0.5" />}
            </Badge>
          )}
        </div>
        <div className="mt-4">
          <p className="text-2xl font-bold text-white">
            <AnimatedNumber value={value} />
          </p>
          <p className="text-xs text-white/40 mt-0.5">{label}</p>
        </div>
      </GlassPanel>
    </motion.div>
  );
}

function OnboardingFlow({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const [os, setOs] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-2xl mx-auto">
      <GlassPanel intensity="medium" className="p-8 text-center">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/20">
          <Monitor className="h-8 w-8 text-white" />
        </div>

        {step === 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h2 className="text-2xl font-bold text-white">Welcome to TechFusion AI</h2>
            <p className="text-white/50 mt-2 max-w-md mx-auto">
              Your intelligent device management platform. Let's get your first device connected.
            </p>
            <button onClick={() => setStep(2)} className="mt-8 h-11 px-8 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium shadow-lg shadow-blue-600/20 transition-all">
              Get Started
            </button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h2 className="text-xl font-bold text-white">Download the Agent</h2>
            <p className="text-white/50 mt-2 text-sm">Choose your operating system to download the TechFusion agent.</p>
            <div className="grid grid-cols-3 gap-3 mt-6 max-w-md mx-auto">
              {[
                { id: 'windows', label: 'Windows', icon: '🪟' },
                { id: 'mac', label: 'macOS', icon: '🍎' },
                { id: 'linux', label: 'Linux', icon: '🐧' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => { setOs(opt.id); setStep(3); }}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.10] transition-all"
                >
                  <span className="text-3xl">{opt.icon}</span>
                  <span className="text-xs text-white/70 font-medium">{opt.label}</span>
                  <Download className="h-3.5 w-3.5 text-primary-400" />
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h2 className="text-xl font-bold text-white">Connect Your Device</h2>
            <div className="mt-6 text-left max-w-md mx-auto space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <span className="h-6 w-6 rounded-full bg-primary-600/20 text-primary-400 flex items-center justify-center text-xs font-bold shrink-0">1</span>
                <p className="text-xs text-white/60">Download and run the TechFusion agent installer for <span className="text-white/80 font-medium capitalize">{os}</span></p>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <span className="h-6 w-6 rounded-full bg-primary-600/20 text-primary-400 flex items-center justify-center text-xs font-bold shrink-0">2</span>
                <p className="text-xs text-white/60">Launch the agent and enter your organization token when prompted</p>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <span className="h-6 w-6 rounded-full bg-primary-600/20 text-primary-400 flex items-center justify-center text-xs font-bold shrink-0">3</span>
                <p className="text-xs text-white/60">Your device will appear here automatically within a few seconds</p>
              </div>
            </div>
            <button onClick={() => { setDetecting(true); setStep(4); }} className="mt-6 h-11 px-8 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium transition-all">
              I've installed the agent
            </button>
          </motion.div>
        )}

        {step === 4 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="relative">
                <Loader2 className="h-12 w-12 text-primary-400 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-3 w-3 rounded-full bg-primary-400 animate-ping" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-white">Detecting your device...</h2>
              <p className="text-white/50 text-sm">Waiting for the agent to connect to your organization.</p>
              <button
                onClick={() => { setDetecting(false); onComplete(); }}
                className="mt-4 text-xs text-primary-400 hover:text-primary-300 transition-colors"
              >
                Skip (I'll do this later)
              </button>
            </div>
          </motion.div>
        )}
      </GlassPanel>
    </motion.div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`rounded-xl bg-white/[0.04] animate-pulse ${className || ''}`} />;
}

export default function DashboardPage() {
  const { devices, loading: devicesLoading, refetch } = useDeviceList();
  const [alertsCount, setAlertsCount] = useState(0);
  const [orgStats, setOrgStats] = useState<{ teamMembers?: number }>({});
  const [loadingStats, setLoadingStats] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const onlineCount = devices.filter((d) => {
    const last = new Date(d.lastSeenAt).getTime();
    return Date.now() - last < 120_000;
  }).length;

  useEffect(() => {
    if (!devicesLoading && devices.length === 0) {
      setShowOnboarding(true);
    }
  }, [devicesLoading, devices.length]);

  const fetchStats = useCallback(async () => {
    try {
      const [alertsRes, adminRes] = await Promise.all([
        fetch(`${API_URL}/alerts/latest`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/admin/dashboard`, { headers: getAuthHeaders() }),
      ]);
      if (alertsRes.ok) {
        const data = await alertsRes.json();
        setAlertsCount(Array.isArray(data) ? data.filter((a: any) => !a.acknowledgedAt).length : 0);
      }
      if (adminRes.ok) {
        setOrgStats(await adminRes.json());
      }
    } catch (e) {
      console.error('Failed to fetch stats:', e);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const skeleton = loadingStats || devicesLoading;

  if (showOnboarding) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Fleet Overview</h1>
          <p className="text-sm text-white/40 mt-1">Real-time status of your managed devices and infrastructure.</p>
        </div>
        <OnboardingFlow onComplete={() => {
          setShowOnboarding(false);
          refetch();
        }} />
      </div>
    );
  }

  const recentDevices = devices.slice(0, 8);

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-semibold text-white tracking-tight">Fleet Overview</h1>
        <p className="text-sm text-white/40 mt-1">Real-time status of your managed devices and infrastructure.</p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {skeleton ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)
        ) : (
          <>
            <CountCard label="Total Devices" value={devices.length} change={`+${devices.length > 0 ? Math.min(devices.length, 10) : 0}`} trend="up" icon={Monitor} color="text-primary-400" />
            <CountCard label="Online Agents" value={onlineCount} change={`+${onlineCount}`} trend="up" icon={Activity} color="text-green-400" />
            <CountCard label="Active Alerts" value={alertsCount} change={alertsCount > 0 ? `${alertsCount}` : '0'} trend={alertsCount > 0 ? 'down' : 'up'} icon={AlertTriangle} color="text-amber-400" />
            <CountCard label="Team Members" value={orgStats.teamMembers || 1} icon={Users} color="text-accent-400" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassPanel intensity="light" className="p-5">
          <h3 className="text-sm font-medium text-white mb-4">Device Fleet Scores</h3>
          {skeleton ? (
            <div className="space-y-3"><Skeleton className="h-8" /><Skeleton className="h-8" /><Skeleton className="h-8" /></div>
          ) : (
            <div className="space-y-3">
              {[
                { label: 'Device Health', value: devices.length > 0 ? Math.round(devices.reduce((a, d) => a + (d.lastSeenAt ? 85 : 0), 0) / devices.length) : 0, variant: 'health' as const },
                { label: 'Risk Assessment', value: 23, variant: 'risk' as const },
                { label: 'Security Posture', value: 76, variant: 'security' as const },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-xs text-white/50">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 rounded-full bg-white/10 overflow-hidden">
                      <div className={`h-full rounded-full ${item.value >= 80 ? 'bg-green-500' : item.value >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${item.value}%` }} />
                    </div>
                    <span className="text-xs text-white/70 w-8 text-right">{item.value}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassPanel>

        <GlassPanel intensity="light" className="p-5">
          <h3 className="text-sm font-medium text-white mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Run Health Check', icon: Activity, desc: devices.length > 0 ? `${devices.length} devices` : 'No devices' },
              { label: 'View Alerts', icon: AlertTriangle, desc: alertsCount > 0 ? `${alertsCount} unresolved` : 'All clear' },
              { label: 'Network Map', icon: Network, desc: 'Topology view' },
              { label: 'Backup Status', icon: HardDrive, desc: 'Last: N/A' },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <button key={action.label}
                  className="flex flex-col items-start gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 text-left hover:bg-white/[0.04] transition-all">
                  <Icon className="h-4 w-4 text-primary-400" />
                  <span className="text-sm font-medium text-white/80">{action.label}</span>
                  <span className="text-xs text-white/30">{action.desc}</span>
                </button>
              );
            })}
          </div>
        </GlassPanel>
      </div>

      <GlassPanel intensity="light" className="p-5">
        <h3 className="text-sm font-medium text-white mb-4">
          {devices.length > 0 ? 'Recently Active Devices' : 'No devices connected'}
        </h3>
        {skeleton ? (
          <div className="space-y-3"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
        ) : devices.length === 0 ? (
          <div className="text-center py-8">
            <Monitor className="h-10 w-10 text-white/20 mx-auto mb-3" />
            <p className="text-sm text-white/30">Connect your first device to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left">
                  <th className="pb-3 text-xs font-medium text-white/40 uppercase tracking-wider">Device</th>
                  <th className="pb-3 text-xs font-medium text-white/40 uppercase tracking-wider">Status</th>
                  <th className="pb-3 text-xs font-medium text-white/40 uppercase tracking-wider">OS</th>
                  <th className="pb-3 text-xs font-medium text-white/40 uppercase tracking-wider">Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {recentDevices.map((device) => {
                  const lastSeen = new Date(device.lastSeenAt);
                  const isOnline = Date.now() - lastSeen.getTime() < 120_000;
                  return (
                    <tr key={device.id} className="border-b border-white/[0.03]">
                      <td className="py-3 text-white/80 font-mono text-xs">{device.name}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-green-400 animate-pulse' : 'bg-white/20'}`} />
                          <Badge variant={isOnline ? 'success' : 'secondary'} className="text-[10px]">
                            {isOnline ? 'Online' : 'Offline'}
                          </Badge>
                        </div>
                      </td>
                      <td className="py-3 text-xs text-white/50">{device.os || '-'}</td>
                      <td className="py-3 text-xs text-white/40">{lastSeen.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
