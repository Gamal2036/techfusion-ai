import React from 'react';
import { render, screen } from '@testing-library/react';
import DeviceDetailPage from '@/app/dashboard/device-health/[id]/page';

const mockUseParams = jest.fn();
const mockUseDevice = jest.fn();
const mockUseWebSocket = jest.fn();

jest.mock('next/navigation', () => ({
  useParams: (...args: any[]) => mockUseParams(...args),
}));

jest.mock('next/link', () => {
  return ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  );
});

jest.mock('@/hooks/useDevices', () => ({
  useDevice: (...args: any[]) => mockUseDevice(...args),
}));

jest.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: (...args: any[]) => mockUseWebSocket(...args),
}));

jest.mock('@/components/ScoreGauge', () => ({
  ScoreGauge: ({ value, variant }: any) => (
    <div data-testid="score-gauge" data-value={value} data-variant={variant} />
  ),
}));

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  Area: () => null,
  LineChart: ({ children }: any) => <div>{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

jest.mock('@techfusion/ui', () => ({
  GlassPanel: ({ children, ...props }: any) => <div data-testid="glass-panel" {...props}>{children}</div>,
  Badge: ({ children, ...props }: any) => <span data-testid="badge" {...props}>{children}</span>,
  ScorePill: ({ label, value }: any) => <div data-testid="score-pill">{label}: {value}</div>,
  Card: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('lucide-react', () => {
  const MockIcon = (props: any) => <svg data-testid="icon" {...props} />;
  return {
    ArrowLeft: MockIcon,
    Monitor: MockIcon,
    Cpu: MockIcon,
    HardDrive: MockIcon,
    Activity: MockIcon,
    Thermometer: MockIcon,
    Clock: MockIcon,
    Wifi: MockIcon,
    Zap: MockIcon,
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUseWebSocket.mockReturnValue(undefined);
});

describe('DeviceDetailPage', () => {
  describe('route param handling', () => {
    it('valid route ID is read correctly from useParams', () => {
      mockUseParams.mockReturnValue({ id: 'device-abc-123' });
      mockUseDevice.mockReturnValue({
        device: null,
        metrics: [],
        scores: null,
        loading: true,
        addLiveMetric: jest.fn(),
      });

      render(<DeviceDetailPage />);

      expect(mockUseParams).toHaveBeenCalled();
      expect(mockUseDevice).toHaveBeenCalledWith('device-abc-123');
    });

    it('useDevice receives the correct ID string', () => {
      mockUseParams.mockReturnValue({ id: 'specific-device-id' });
      mockUseDevice.mockReturnValue({
        device: null,
        metrics: [],
        scores: null,
        loading: true,
        addLiveMetric: jest.fn(),
      });

      render(<DeviceDetailPage />);

      expect(mockUseDevice).toHaveBeenCalledTimes(1);
      expect(mockUseDevice.mock.calls[0][0]).toBe('specific-device-id');
    });

    it('page does not call React.use()', () => {
      expect((React as any).use).toBeUndefined();
    });

    it('missing route ID does not crash the page', () => {
      mockUseParams.mockReturnValue({});
      mockUseDevice.mockReturnValue({
        device: null,
        metrics: [],
        scores: null,
        loading: true,
        addLiveMetric: jest.fn(),
      });

      expect(() => render(<DeviceDetailPage />)).not.toThrow();
      expect(mockUseDevice).toHaveBeenCalledWith('');
    });

    it('undefined route ID does not crash the page', () => {
      mockUseParams.mockReturnValue({ id: undefined });
      mockUseDevice.mockReturnValue({
        device: null,
        metrics: [],
        scores: null,
        loading: true,
        addLiveMetric: jest.fn(),
      });

      expect(() => render(<DeviceDetailPage />)).not.toThrow();
      expect(mockUseDevice).toHaveBeenCalledWith('');
    });

    it('null route ID does not crash the page', () => {
      mockUseParams.mockReturnValue({ id: null });
      mockUseDevice.mockReturnValue({
        device: null,
        metrics: [],
        scores: null,
        loading: true,
        addLiveMetric: jest.fn(),
      });

      expect(() => render(<DeviceDetailPage />)).not.toThrow();
      expect(mockUseDevice).toHaveBeenCalledWith('');
    });

    it('non-string param does not crash the page', () => {
      mockUseParams.mockReturnValue({ id: 12345 });
      mockUseDevice.mockReturnValue({
        device: null,
        metrics: [],
        scores: null,
        loading: true,
        addLiveMetric: jest.fn(),
      });

      expect(() => render(<DeviceDetailPage />)).not.toThrow();
      expect(mockUseDevice).toHaveBeenCalledWith('');
    });
  });

  describe('loading state', () => {
    it('renders loading state when loading and no device', () => {
      mockUseParams.mockReturnValue({ id: 'dev-1' });
      mockUseDevice.mockReturnValue({
        device: null,
        metrics: [],
        scores: null,
        loading: true,
        addLiveMetric: jest.fn(),
      });

      render(<DeviceDetailPage />);

      expect(screen.getByText('Loading device data...')).toBeTruthy();
    });
  });

  describe('not found state', () => {
    it('renders device not found when loading is false and device is null', () => {
      mockUseParams.mockReturnValue({ id: 'dev-1' });
      mockUseDevice.mockReturnValue({
        device: null,
        metrics: [],
        scores: null,
        loading: false,
        addLiveMetric: jest.fn(),
      });

      render(<DeviceDetailPage />);

      expect(screen.getByText('Device not found')).toBeTruthy();
      expect(screen.getByText('Back to Device Health Center')).toBeTruthy();
    });
  });

  describe('device content rendering', () => {
    it('renders device name and online status', () => {
      mockUseParams.mockReturnValue({ id: 'dev-1' });
      mockUseDevice.mockReturnValue({
        device: {
          id: 'dev-1',
          orgId: 'org-1',
          name: 'Test Workstation',
          hostname: 'ws-001',
          os: 'Windows',
          osVersion: '11',
          cpuModel: 'Intel i7',
          cpuCores: 8,
          cpuLogical: 16,
          ramTotal: 17179869184,
          gpuInfo: null,
          diskTotal: 500000000000,
          isLaptop: false,
          registeredAt: new Date(Date.now() - 86400000).toISOString(),
          lastSeenAt: new Date().toISOString(),
        },
        metrics: [
          {
            id: 'm1',
            deviceId: 'dev-1',
            recordedAt: new Date().toISOString(),
            cpuUsage: 45,
            ramPercent: 62,
            ramUsed: 10000000000,
            ramTotal: 17179869184,
            diskUsed: null,
            diskTotal: null,
            tempCpu: 65,
            loadAverage1Min: 1.2,
            processes: 120,
            uptime: 86400,
            networkRxBytes: null,
            networkTxBytes: null,
          },
        ],
        scores: {
          id: 's1',
          deviceId: 'dev-1',
          calculatedAt: new Date().toISOString(),
          healthScore: 85,
          performanceScore: 72,
          riskScore: 30,
        },
        loading: false,
        addLiveMetric: jest.fn(),
      });

      render(<DeviceDetailPage />);

      expect(screen.getByText('Test Workstation')).toBeTruthy();
      expect(screen.getByText('Online')).toBeTruthy();
      expect(screen.getAllByText('ws-001').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Windows 11')).toBeTruthy();
    });

    it('renders score gauges and pills', () => {
      mockUseParams.mockReturnValue({ id: 'dev-1' });
      mockUseDevice.mockReturnValue({
        device: {
          id: 'dev-1',
          orgId: 'org-1',
          name: 'Device A',
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
          registeredAt: '2024-01-01T00:00:00.000Z',
          lastSeenAt: new Date(Date.now() - 60000).toISOString(),
        },
        metrics: [],
        scores: {
          id: 's1',
          deviceId: 'dev-1',
          calculatedAt: new Date().toISOString(),
          healthScore: 90,
          performanceScore: 80,
          riskScore: 20,
        },
        loading: false,
        addLiveMetric: jest.fn(),
      });

      render(<DeviceDetailPage />);

      const gauges = screen.getAllByTestId('score-gauge');
      expect(gauges.length).toBe(3);

      const pills = screen.getAllByTestId('score-pill');
      expect(pills.length).toBe(3);
    });

    it('renders metrics chart area', () => {
      mockUseParams.mockReturnValue({ id: 'dev-1' });
      mockUseDevice.mockReturnValue({
        device: {
          id: 'dev-1',
          orgId: 'org-1',
          name: 'Chart Device',
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
          registeredAt: '2024-01-01T00:00:00.000Z',
          lastSeenAt: new Date(Date.now() - 60000).toISOString(),
        },
        metrics: [
          {
            id: 'm1',
            deviceId: 'dev-1',
            recordedAt: new Date().toISOString(),
            cpuUsage: 50,
            ramPercent: 70,
            ramUsed: 8000000000,
            ramTotal: 16000000000,
            diskUsed: null,
            diskTotal: null,
            tempCpu: null,
            loadAverage1Min: null,
            processes: null,
            uptime: null,
            networkRxBytes: null,
            networkTxBytes: null,
          },
        ],
        scores: null,
        loading: false,
        addLiveMetric: jest.fn(),
      });

      render(<DeviceDetailPage />);

      expect(screen.getByText('Metrics History')).toBeTruthy();
      expect(screen.getByTestId('area-chart')).toBeTruthy();
    });

    it('renders no-data message when metrics array is empty', () => {
      mockUseParams.mockReturnValue({ id: 'dev-1' });
      mockUseDevice.mockReturnValue({
        device: {
          id: 'dev-1',
          orgId: 'org-1',
          name: 'Empty Device',
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
          registeredAt: '2024-01-01T00:00:00.000Z',
          lastSeenAt: new Date(Date.now() - 60000).toISOString(),
        },
        metrics: [],
        scores: null,
        loading: false,
        addLiveMetric: jest.fn(),
      });

      render(<DeviceDetailPage />);

      expect(screen.getByText(/No metrics data available yet/)).toBeTruthy();
    });
  });

  describe('WebSocket integration', () => {
    it('passes callback to useWebSocket', () => {
      mockUseParams.mockReturnValue({ id: 'dev-1' });
      mockUseDevice.mockReturnValue({
        device: {
          id: 'dev-1',
          orgId: 'org-1',
          name: 'WS Device',
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
          registeredAt: '2024-01-01T00:00:00.000Z',
          lastSeenAt: new Date(Date.now() - 60000).toISOString(),
        },
        metrics: [],
        scores: null,
        loading: false,
        addLiveMetric: jest.fn(),
      });

      render(<DeviceDetailPage />);

      expect(mockUseWebSocket).toHaveBeenCalled();
      expect(typeof mockUseWebSocket.mock.calls[0][0]).toBe('function');
    });
  });

  describe('no backend contract changes', () => {
    it('useDevice is called with exactly one string argument', () => {
      mockUseParams.mockReturnValue({ id: 'contract-test-id' });
      mockUseDevice.mockReturnValue({
        device: null,
        metrics: [],
        scores: null,
        loading: true,
        addLiveMetric: jest.fn(),
      });

      render(<DeviceDetailPage />);

      expect(mockUseDevice).toHaveBeenCalledTimes(1);
      expect(mockUseDevice.mock.calls[0]).toHaveLength(1);
      expect(typeof mockUseDevice.mock.calls[0][0]).toBe('string');
    });
  });

  describe('CPU model display', () => {
    it('renders real cpuModel when present', () => {
      mockUseParams.mockReturnValue({ id: 'dev-1' });
      mockUseDevice.mockReturnValue({
        device: {
          id: 'dev-1',
          orgId: 'org-1',
          name: 'Test Device',
          hostname: 'ws-001',
          os: 'Linux',
          osVersion: '6.8.0',
          cpuModel: 'AMD Athlon Silver 3050U with Radeon Graphics',
          cpuCores: 1,
          cpuLogical: 2,
          ramTotal: 6442450944,
          gpuInfo: null,
          diskTotal: 256000000000,
          isLaptop: false,
          registeredAt: new Date(Date.now() - 86400000).toISOString(),
          lastSeenAt: new Date().toISOString(),
        },
        metrics: [],
        scores: null,
        loading: false,
        addLiveMetric: jest.fn(),
      });

      render(<DeviceDetailPage />);

      expect(screen.getByText('AMD Athlon Silver 3050U with Radeon Graphics')).toBeTruthy();
    });

    it('renders fallback when cpuModel is null', () => {
      mockUseParams.mockReturnValue({ id: 'dev-1' });
      mockUseDevice.mockReturnValue({
        device: {
          id: 'dev-1',
          orgId: 'org-1',
          name: 'Test Device',
          hostname: 'ws-001',
          os: 'Linux',
          osVersion: '6.8.0',
          cpuModel: null,
          cpuCores: 2,
          cpuLogical: 4,
          ramTotal: 8589934592,
          gpuInfo: null,
          diskTotal: 256000000000,
          isLaptop: false,
          registeredAt: new Date(Date.now() - 86400000).toISOString(),
          lastSeenAt: new Date().toISOString(),
        },
        metrics: [],
        scores: null,
        loading: false,
        addLiveMetric: jest.fn(),
      });

      render(<DeviceDetailPage />);

      expect(screen.getByText('CPU information unavailable')).toBeTruthy();
    });

    it('renders cores correctly alongside CPU model', () => {
      mockUseParams.mockReturnValue({ id: 'dev-1' });
      mockUseDevice.mockReturnValue({
        device: {
          id: 'dev-1',
          orgId: 'org-1',
          name: 'Test Device',
          hostname: 'ws-001',
          os: 'Linux',
          osVersion: '6.8.0',
          cpuModel: 'Intel Core i7-12700K',
          cpuCores: 8,
          cpuLogical: 16,
          ramTotal: 34359738368,
          gpuInfo: null,
          diskTotal: 1000000000000,
          isLaptop: false,
          registeredAt: new Date(Date.now() - 86400000).toISOString(),
          lastSeenAt: new Date().toISOString(),
        },
        metrics: [],
        scores: null,
        loading: false,
        addLiveMetric: jest.fn(),
      });

      render(<DeviceDetailPage />);

      expect(screen.getByText('Intel Core i7-12700K')).toBeTruthy();
      expect(screen.getByText('8 physical / 16 logical')).toBeTruthy();
    });
  });
});
