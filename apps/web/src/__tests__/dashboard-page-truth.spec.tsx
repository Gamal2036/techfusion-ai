import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import DashboardPage from '@/app/dashboard/page';
import type { DashboardSummary } from '@/hooks/useDashboardSummary';

const mockUseCommandCenterData = jest.fn();
const mockUseDeviceList = jest.fn();
const mockRouterPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: (...args: any[]) => mockRouterPush(...args) }),
}));

jest.mock('@/hooks/useCommandCenterData', () => ({
  useCommandCenterData: (...args: any[]) => mockUseCommandCenterData(...args),
}));

jest.mock('@/hooks/useDevices', () => ({
  useDeviceList: (...args: any[]) => mockUseDeviceList(...args),
}));

jest.mock('@/lib/auth-client', () => ({
  apiFetch: jest.fn(),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn() },
}));

jest.mock('@techfusion/ui', () => ({
  GlassPanel: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Skeleton: ({ className }: any) => <div data-testid="skeleton" className={className} />,
  StatusBadge: ({ status, size, dot }: any) => (
    <span data-testid="status-badge" data-status={status} data-size={size} data-dot={dot} />
  ),
}));

jest.mock('lucide-react', () => {
  const MockIcon = (props: any) => <svg data-testid="icon" {...props} />;
  return {
    Activity: MockIcon,
    Monitor: MockIcon,
    AlertTriangle: MockIcon,
    Network: MockIcon,
    HardDrive: MockIcon,
    Users: MockIcon,
    Loader2: MockIcon,
    Copy: MockIcon,
    Check: MockIcon,
    CheckCircle: MockIcon,
    Key: MockIcon,
    ChevronRight: MockIcon,
  };
});

function nowIso(secondsAgo: number): string {
  return new Date(Date.now() - secondsAgo * 1000).toISOString();
}

const devices = [
  { id: 'd1', orgId: 'org-1', name: 'host-a', hostname: 'host-a', os: 'Linux', osVersion: null, cpuModel: null, cpuCores: null, cpuLogical: null, ramTotal: null, gpuInfo: null, diskTotal: null, isLaptop: false, registeredAt: nowIso(3600), lastSeenAt: nowIso(0) },
  { id: 'd2', orgId: 'org-1', name: 'host-b', hostname: 'host-b', os: 'Linux', osVersion: null, cpuModel: null, cpuCores: null, cpuLogical: null, ramTotal: null, gpuInfo: null, diskTotal: null, isLaptop: false, registeredAt: nowIso(3600), lastSeenAt: nowIso(60) },
  { id: 'd3', orgId: 'org-1', name: 'host-c', hostname: 'host-c', os: 'Linux', osVersion: null, cpuModel: null, cpuCores: null, cpuLogical: null, ramTotal: null, gpuInfo: null, diskTotal: null, isLaptop: false, registeredAt: nowIso(3600), lastSeenAt: nowIso(600) },
];

function baseSummary(): DashboardSummary {
  return {
    generatedAt: nowIso(0),
    fleet: {
      total: 3,
      online: 2,
      degraded: 0,
      offline: 1,
      unknown: 0,
      freshness: { live: 1, recent: 1, stale: 1, unavailable: 0 },
      deviceHealth: 85,
      recentDevices: [],
    },
    alerts: {
      unacknowledged: 14,
      bySeverity: { critical: 0, high: 0, medium: 0, low: 0, warning: 14, unknown: 0 },
    },
    security: {
      openFindings: { critical: 0, high: 2, medium: 0, low: 0, total: 2 },
      worstRiskLevel: 'high',
      scanCoverage: { scannedDevices: 1, onlineDevices: 2, coveragePercent: 75, lastScanAt: nowIso(86400) },
      unscannedOnlineDevices: 1,
      latestScanAgesDays: 1,
    },
    operations: {
      backups: {
        running: 1,
        pending: 0,
        failedLast24h: 0,
        completedLast24h: 0,
        lastCompletedAt: null,
        lastCompletedJobName: null,
        nextScheduledAt: null,
      },
      scans: { running: 0, pending: 0, failedLast24h: 0, completedLast24h: 0 },
      reports: { generating: 0, failed: 0, completed: 0, generatedLast30d: 0 },
    },
    team: { total: 5 },
  };
}

function ccData(summary: DashboardSummary | null, opts: { error?: boolean } = {}) {
  return {
    summary,
    summaryLoading: false,
    summaryError: opts.error ? new Error('unavailable') : null,
    refetchSummary: jest.fn(),
    status: summary ? 'ATTENTION' : 'UNKNOWN',
    reasons: summary ? [] : [],
    stale: false,
    liveAlerts: [],
    activeBackupRuns: [],
  };
}

describe('DashboardPage truth patch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDeviceList.mockReturnValue({
      devices,
      loading: false,
      error: null,
      refetch: jest.fn(),
      startFastPolling: jest.fn(),
      fastPolling: false,
    });
  });

  it('renders authoritative counts and no fabricated deltas or fallbacks', async () => {
    jest.useFakeTimers();
    mockUseCommandCenterData.mockReturnValue(ccData(baseSummary()));

    render(<DashboardPage />);
    act(() => { jest.advanceTimersByTime(1000); });

    expect(screen.getByText('Total Devices')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('14')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();

    expect(screen.getByText('high · 2 open')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('scan 1d ago')).toBeInTheDocument();
    expect(screen.getByText('1 running')).toBeInTheDocument();
    expect(screen.getByText('14 unresolved')).toBeInTheDocument();

    // Fleet presence breakdown exposes online / degraded / offline / unknown.
    expect(screen.getByText('Degraded')).toBeInTheDocument();
    expect(screen.getByText('Offline')).toBeInTheDocument();
    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(2);

    expect(screen.queryByText('No Data Yet')).toBeNull();
    expect(screen.queryByText(/\+/)).toBeNull();
    jest.useRealTimers();
  });

  it('shows honest empty states instead of "No Data Yet"', async () => {
    jest.useFakeTimers();
    const summary = baseSummary();
    summary.fleet.deviceHealth = null;
    summary.alerts.unacknowledged = 0;
    summary.security.worstRiskLevel = null;
    summary.security.openFindings.total = 0;
    summary.security.scanCoverage.coveragePercent = null;
    summary.security.latestScanAgesDays = null;
    summary.operations.backups = {
      running: 0,
      pending: 0,
      failedLast24h: 0,
      completedLast24h: 0,
      lastCompletedAt: null,
      lastCompletedJobName: null,
      nextScheduledAt: null,
    };
    summary.team.total = 0;
    mockUseCommandCenterData.mockReturnValue(ccData(summary));

    render(<DashboardPage />);
    act(() => { jest.advanceTimersByTime(1000); });

    expect(screen.getByText('No health scores yet')).toBeInTheDocument();
    expect(screen.getAllByText('No scans yet').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('No backups yet')).toBeInTheDocument();
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('No Data Yet')).toBeNull();
    jest.useRealTimers();
  });

  it('does not fabricate zeros or a team of one when the summary is unavailable', async () => {
    jest.useFakeTimers();
    mockUseCommandCenterData.mockReturnValue(ccData(null, { error: true }));

    render(<DashboardPage />);
    act(() => { jest.advanceTimersByTime(1000); });

    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Status unavailable').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Summary is temporarily unavailable. Try again in a moment.')).toBeInTheDocument();
    expect(screen.queryByText('No Data Yet')).toBeNull();
    jest.useRealTimers();
  });

  it('shows onboarding when the fleet is empty and never fabricates a device table', async () => {
    jest.useFakeTimers();
    const summary = baseSummary();
    summary.fleet.total = 0;
    summary.fleet.online = 0;
    summary.fleet.offline = 0;
    summary.fleet.recentDevices = [];
    mockUseCommandCenterData.mockReturnValue(ccData(summary));

    render(<DashboardPage />);
    act(() => { jest.advanceTimersByTime(1000); });

    expect(screen.getByText('Welcome to TechFusion AI')).toBeInTheDocument();
    expect(screen.getByText('Choose Operating System')).toBeInTheDocument();
    expect(screen.queryByText('Recently Active Devices')).toBeNull();
    expect(screen.queryByText('No devices connected')).toBeNull();
    jest.useRealTimers();
  });

  it('renders recent devices from the summary contract with real presence', async () => {
    jest.useFakeTimers();
    const summary = baseSummary();
    summary.fleet.recentDevices = [
      { id: 'd1', name: 'host-a', hostname: 'host-a', os: 'Linux', lastSeenAt: nowIso(0) },
      { id: 'd2', name: 'host-b', hostname: 'host-b', os: 'Windows', lastSeenAt: nowIso(60) },
      { id: 'd3', name: 'host-c', hostname: 'host-c', os: null, lastSeenAt: nowIso(600) },
    ];
    mockUseCommandCenterData.mockReturnValue(ccData(summary));

    render(<DashboardPage />);
    act(() => { jest.advanceTimersByTime(1000); });

    expect(screen.getByText('Recently Active Devices')).toBeInTheDocument();
    expect(screen.getByText('host-a')).toBeInTheDocument();
    expect(screen.getByText('host-b')).toBeInTheDocument();
    expect(screen.getByText('host-c')).toBeInTheDocument();
    const badges = screen.getAllByTestId('status-badge');
    expect(badges.length).toBe(3);
    expect(badges[0]).toHaveAttribute('data-status', 'presence-online');
    expect(badges[1]).toHaveAttribute('data-status', 'presence-online');
    expect(badges[2]).toHaveAttribute('data-status', 'presence-degraded');
    jest.useRealTimers();
  });
});
