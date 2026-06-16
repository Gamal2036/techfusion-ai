import { Test, TestingModule } from '@nestjs/testing';
import { NetworkService } from './network.service';
import { PrismaService } from '../prisma/prisma.service';

describe('NetworkService', () => {
  let service: NetworkService;
  let mockPrisma: any;

  const mockDevices = [
    { id: 'n1', orgId: 'org-1', ip: '192.168.1.1', mac: '00:11:22:33:44:01', hostname: 'gateway', vendor: 'Cisco', source: 'arp', reachable: true, latencyMs: 1.2, lastSeenAt: new Date(), interface: 'eth0' },
    { id: 'n2', orgId: 'org-1', ip: '192.168.1.100', mac: '00:11:22:33:44:02', hostname: 'server-01', vendor: 'Dell', source: 'arp', reachable: true, latencyMs: 0.5, lastSeenAt: new Date(), interface: 'eth0' },
    { id: 'n3', orgId: 'org-1', ip: '192.168.1.101', mac: '00:11:22:33:44:03', hostname: null, vendor: null, source: 'icmp', reachable: true, latencyMs: 2.1, lastSeenAt: new Date(), interface: 'eth0' },
    { id: 'n4', orgId: 'org-1', ip: '192.168.1.50', mac: 'B8:27:EB:12:34:56', hostname: 'pi-4', vendor: 'Raspberry Pi', source: 'arp', reachable: false, latencyMs: null, lastSeenAt: new Date(), interface: 'eth0' },
  ];

  const latestScan = {
    id: 'scan-1',
    subnet: '192.168.1.0/24',
    gatewayIp: '192.168.1.1',
    localIp: '192.168.1.100',
    deviceCount: 4,
    scanDurationMs: 3200,
    startedAt: new Date(),
  };

  beforeEach(async () => {
    mockPrisma = {
      networkDevice: {
        findMany: jest.fn().mockResolvedValue(mockDevices),
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      networkScan: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(latestScan),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NetworkService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<NetworkService>(NetworkService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTopology', () => {
    it('builds correct topology graph from devices', async () => {
      const topology = await service.getTopology('org-1');

      expect(topology.nodes).toHaveLength(4);
      expect(topology.links.length).toBeGreaterThan(0);

      const gatewayNode = topology.nodes.find((n: any) => n.isGateway);
      expect(gatewayNode).toBeDefined();
      expect(gatewayNode!.ip).toBe('192.168.1.1');
      expect(gatewayNode!.vendor).toBe('Cisco');

      const localNode = topology.nodes.find((n: any) => n.isLocal);
      expect(localNode).toBeDefined();
      expect(localNode!.ip).toBe('192.168.1.100');
    });

    it('marks unreachable devices correctly', async () => {
      const topology = await service.getTopology('org-1');
      const unreachable = topology.nodes.find((n: any) => n.ip === '192.168.1.50');
      expect(unreachable).toBeDefined();
      expect(unreachable!.reachable).toBe(false);
    });

    it('uses vendor info when hostname is null', async () => {
      const topology = await service.getTopology('org-1');
      const node = topology.nodes.find((n: any) => n.ip === '192.168.1.101');
      expect(node).toBeDefined();
      expect(node!.label).toBe(node!.ip);
      expect(node!.vendor).toBeNull();
    });

    it('includes scan metadata', async () => {
      const topology = await service.getTopology('org-1');
      expect(topology.scan).toBeDefined();
      expect(topology.scan!.subnet).toBe('192.168.1.0/24');
      expect(topology.scan!.deviceCount).toBe(4);
    });
  });

  describe('getDevices', () => {
    it('returns all devices for org', async () => {
      const devices = await service.getDevices('org-1');
      expect(devices).toHaveLength(4);
      expect(mockPrisma.networkDevice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { orgId: 'org-1' } }),
      );
    });

    it('filters by reachable status', async () => {
      await service.getDevices('org-1', true);
      expect(mockPrisma.networkDevice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orgId: 'org-1', reachable: true },
        }),
      );
    });
  });

  describe('getScans', () => {
    it('returns scans ordered by startedAt desc', async () => {
      await service.getScans('org-1', 5);
      expect(mockPrisma.networkScan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orgId: 'org-1' },
          orderBy: { startedAt: 'desc' },
          take: 5,
        }),
      );
    });
  });

  describe('ingestDiscovery', () => {
    it('creates scan and upserts devices', async () => {
      mockPrisma.networkScan.create.mockResolvedValue({ id: 'scan-2' });
      mockPrisma.networkDevice.upsert.mockResolvedValue({});

      const data = {
        gateway_ip: '192.168.1.1',
        gateway_mac: '00:11:22:33:44:01',
        subnet: '192.168.1.0/24',
        scan_duration_ms: 1500,
        device_count: 2,
        devices: [
          { ip: '192.168.1.10', mac: 'aa:bb:cc:dd:ee:ff', hostname: 'test', reachable: true, latency_ms: 0.8, source: 'arp' },
          { ip: '192.168.1.20', mac: '11:22:33:44:55:66', hostname: null, reachable: false, latency_ms: null, source: 'icmp' },
        ],
      };

      const result = await service.ingestDiscovery('org-1', data);

      expect(result.id).toBe('scan-2');
      expect(mockPrisma.networkDevice.upsert).toHaveBeenCalledTimes(2);
      expect(mockPrisma.networkScan.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orgId: 'org-1',
            gatewayIp: '192.168.1.1',
            deviceCount: 2,
          }),
        }),
      );
    });
  });
});
