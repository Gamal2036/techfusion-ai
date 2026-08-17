import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MonitoringPage from '@/app/dashboard/monitoring/page';
import type { Device } from '@/hooks/useDevices';
import type { Alert, AlertStatus } from '@/hooks/useAlerts';

const mockUseDeviceList = jest.fn();
const mockUseWebSocket = jest.fn();
const mockUseAlerts = jest.fn();
const mockUseAlertRules = jest.fn();
const mockUseAlertWebSocket = jest.fn();
const mockApiFetch = jest.fn();

jest.mock('@techfusion/ui', () => ({
  GlassPanel: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Badge: ({ children, variant }: any) => <span data-testid="badge" data-variant={variant}>{children}</span>,
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  Dialog: ({ open, children }: any) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogClose: ({ children }: any) => <>{children}</>,
}));

jest.mock('lucide-react', () => {
  const mockIcon = (name: string) => () => <svg data-testid={`icon-${name}`} />;
  return {
    Monitor: mockIcon('monitor'),
    AlertTriangle: mockIcon('alert-triangle'),
    Bell: mockIcon('bell'),
    Plus: mockIcon('plus'),
    Settings: mockIcon('settings'),
    X: mockIcon('x'),
    CheckCircle: mockIcon('check-circle'),
    Flag: mockIcon('flag'),
    Activity: mockIcon('activity'),
    Server: mockIcon('server'),
  };
});

jest.mock('@/hooks/useDevices', () => ({
  useDeviceList: (...args: any[]) => mockUseDeviceList(...args),
}));

jest.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: (...args: any[]) => mockUseWebSocket(...args),
}));

jest.mock('@/hooks/useAlerts', () => ({
  useAlerts: (...args: any[]) => mockUseAlerts(...args),
  useAlertRules: (...args: any[]) => mockUseAlertRules(...args),
  useAlertWebSocket: (...args: any[]) => mockUseAlertWebSocket(...args),
}));

jest.mock('@/lib/auth-client', () => ({
  ...jest.requireActual('@/lib/auth-client'),
  apiFetch: (...args: any[]) => mockApiFetch(...args),
  isLoggingOut: jest.fn().mockReturnValue(false),
}));

jest.mock('@/lib/socket-client', () => ({
  subscribe: jest.fn(() => () => {}),
}));

function makeDevice(id: string, name: string, lastSeenAt: string): Device {
  return {
    id,
    orgId: 'org-1',
    name,
    hostname: null,
    os: null,
    osVersion: null,
    cpuModel: null,
    cpuCores: null,
    cpuLogical: null,
    ramTotal: null,
    gpuInfo: null,
    diskTotal: null,
    isLaptop: false,
    registeredAt: '2026-08-01T00:00:00.000Z',
    lastSeenAt,
  };
}

function makeAlert(id: string, status: AlertStatus, message = 'alert message'): Alert {
  return {
    id,
    orgId: 'org-1',
    alertRuleId: 'rule-1',
    deviceId: 'dev-1',
    metricValue: 95,
    threshold: 90,
    severity: 'critical',
    message,
    status,
    source: 'metric',
    lastDetectedAt: '2026-08-06T00:00:00.000Z',
    acknowledgedAt: status === 'ACKNOWLEDGED' ? '2026-08-06T01:00:00.000Z' : null,
    resolvedAt: status === 'RESOLVED' ? '2026-08-06T02:00:00.000Z' : null,
    createdAt: '2026-08-06T00:00:00.000Z',
  };
}

function emptyAlerts() {
  return {
    alerts: [] as Alert[],
    total: 0,
    loading: false,
    error: null,
    refetch: jest.fn(),
    acknowledgeAlert: jest.fn(),
    resolveAlert: jest.fn(),
  };
}

function emptyRules() {
  return {
    rules: [] as never[],
    loading: false,
    createRule: jest.fn(),
    updateRule: jest.fn(),
    deleteRule: jest.fn(),
    refetch: jest.fn(),
  };
}

function renderPage() {
  mockUseWebSocket.mockReturnValue(undefined);
  mockUseAlertWebSocket.mockReturnValue(undefined);
  mockApiFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
  return render(<MonitoringPage />);
}

describe('MonitoringPage device presence tiles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('derives Online/Degraded/Offline/Unknown presence states from lastSeenAt', () => {
    const now = Date.now();
    const devices = [
      makeDevice('d-online', 'host-a', new Date().toISOString()),
      makeDevice('d-degraded', 'host-b', new Date(now - 10 * 60 * 1000).toISOString()),
      makeDevice('d-offline', 'host-c', new Date(now - 2 * 3600 * 1000).toISOString()),
      makeDevice('d-unknown', 'host-d', 'not-a-date'),
    ];
    mockUseDeviceList.mockReturnValue({ devices, loading: false, refetch: jest.fn() });
    mockUseAlerts.mockReturnValue(emptyAlerts());
    mockUseAlertRules.mockReturnValue(emptyRules());

    renderPage();

    expect(screen.getByLabelText('host-a: Online')).toBeTruthy();
    expect(screen.getByLabelText('host-b: Degraded')).toBeTruthy();
    expect(screen.getByLabelText('host-c: Offline')).toBeTruthy();
    expect(screen.getByLabelText('host-d: Unknown')).toBeTruthy();
  });

  it('renders an empty state when no devices are registered', () => {
    mockUseDeviceList.mockReturnValue({ devices: [], loading: false, refetch: jest.fn() });
    mockUseAlerts.mockReturnValue(emptyAlerts());
    mockUseAlertRules.mockReturnValue(emptyRules());

    renderPage();

    expect(screen.getByText('No devices registered')).toBeTruthy();
  });
});

describe('MonitoringPage alert feed lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDeviceList.mockReturnValue({ devices: [], loading: false, refetch: jest.fn() });
    mockUseAlertRules.mockReturnValue(emptyRules());
  });

  it('switches the feed scope and re-invokes useAlerts with the selected status', () => {
    const refetch = jest.fn();
    const openAlert = makeAlert('a1', 'OPEN', 'CPU critical');
    const acknowledgedAlert = makeAlert('a2', 'ACKNOWLEDGED', 'Disk full');
    mockUseAlerts.mockImplementation((opts?: { status?: AlertStatus }) => {
      if (opts?.status === 'ACKNOWLEDGED') {
        return { ...emptyAlerts(), alerts: [acknowledgedAlert], total: 1, refetch };
      }
      return { ...emptyAlerts(), alerts: [openAlert], total: 1, refetch };
    });

    renderPage();
    expect(mockUseAlerts).toHaveBeenCalledWith({ status: 'OPEN' });
    expect(screen.getByText('CPU critical')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Acknowledged' }));

    expect(mockUseAlerts).toHaveBeenCalledWith({ status: 'ACKNOWLEDGED' });
    expect(screen.getByText('Disk full')).toBeTruthy();
  });

  it('acknowledges an open alert and refetches the scoped feed', async () => {
    const acknowledgeAlert = jest.fn().mockResolvedValue(makeAlert('a1', 'ACKNOWLEDGED'));
    const resolveAlert = jest.fn();
    const refetch = jest.fn();
    mockUseAlerts.mockReturnValue({
      ...emptyAlerts(),
      alerts: [makeAlert('a1', 'OPEN')],
      total: 1,
      acknowledgeAlert,
      resolveAlert,
      refetch,
    });

    renderPage();
    fireEvent.click(screen.getByTitle('Acknowledge'));

    await waitFor(() => expect(acknowledgeAlert).toHaveBeenCalledWith('a1'));
    await waitFor(() => expect(refetch).toHaveBeenCalled());
  });

  it('resolves an open alert and refetches the scoped feed', async () => {
    const resolveAlert = jest.fn().mockResolvedValue(makeAlert('a1', 'RESOLVED'));
    const refetch = jest.fn();
    mockUseAlerts.mockReturnValue({
      ...emptyAlerts(),
      alerts: [makeAlert('a1', 'OPEN')],
      total: 1,
      resolveAlert,
      refetch,
    });

    renderPage();
    fireEvent.click(screen.getByTitle('Resolve'));

    await waitFor(() => expect(resolveAlert).toHaveBeenCalledWith('a1'));
    await waitFor(() => expect(refetch).toHaveBeenCalled());
  });
});

describe('MonitoringPage alert rule type selector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDeviceList.mockReturnValue({ devices: [], loading: false, refetch: jest.fn() });
    mockUseAlerts.mockReturnValue(emptyAlerts());
  });

  it('creates a metric rule with kind set to "metric"', () => {
    const createRule = jest.fn().mockResolvedValue({ id: 'r1' });
    const refetch = jest.fn();
    mockUseAlertRules.mockReturnValue({ ...emptyRules(), createRule, refetch });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Rules' }));
    fireEvent.click(screen.getByRole('button', { name: /create rule/i }));

    expect(screen.getByTestId('dialog')).toBeTruthy();
    expect((screen.getByDisplayValue('Metric threshold') as HTMLSelectElement).value).toBe('metric');

    fireEvent.change(screen.getAllByRole('textbox')[0], {
      target: { value: 'High CPU' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(createRule).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'metric', name: 'High CPU', threshold: 90, debounceSeconds: 300 }),
    );
  });

  it('switches to a presence rule and submits kind "presence" without a metric', () => {
    const createRule = jest.fn().mockResolvedValue({ id: 'r2' });
    const refetch = jest.fn();
    mockUseAlertRules.mockReturnValue({ ...emptyRules(), createRule, refetch });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Rules' }));
    fireEvent.click(screen.getByRole('button', { name: /create rule/i }));

    fireEvent.change(screen.getByDisplayValue('Metric threshold'), { target: { value: 'presence' } });

    expect(screen.queryByDisplayValue('cpuUsage')).toBeNull();
    expect(screen.getByText('Heartbeat (no metric)')).toBeTruthy();

    fireEvent.change(screen.getAllByRole('textbox')[0], {
      target: { value: 'Offline detector' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(createRule).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'presence', name: 'Offline detector' }),
    );
  });

  it('shows the presence source tag on presence alerts in the feed', () => {
    const presenceAlert = makeAlert('a3', 'OPEN', 'Device went offline');
    presenceAlert.source = 'presence';
    presenceAlert.alertRule = { id: 'r2', name: 'Offline detector', metricName: '', kind: 'presence' };
    mockUseAlerts.mockReturnValue({ ...emptyAlerts(), alerts: [presenceAlert], total: 1 });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Alerts' }));

    expect(screen.getByText('Device went offline')).toBeTruthy();
    expect(screen.getAllByText('presence').length).toBeGreaterThan(0);
  });
});
