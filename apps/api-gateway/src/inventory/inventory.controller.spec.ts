import { Test, TestingModule } from '@nestjs/testing';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { QueueService } from '../queue/queue.service';
import { DevicesService } from '../devices/devices.service';
import * as crypto from 'crypto';

describe('InventoryController', () => {
  let controller: InventoryController;
  let mockDevicesService: any;
  let mockInventoryService: any;
  let mockQueueService: any;

  const mockDevice = {
    id: 'dev-001',
    orgId: 'org-001',
    name: 'test-host',
    hostname: 'test-host',
    deviceToken: 'tok-test-123',
    deviceTokenHash: crypto.createHash('sha256').update('tok-test-123').digest('hex'),
  };

  beforeEach(async () => {
    mockDevicesService = {
      findByToken: jest.fn(),
    };

    mockInventoryService = {
      ingestReport: jest.fn().mockResolvedValue({ driverCount: 5, softwareCount: 10 }),
      clearPendingInventory: jest.fn().mockResolvedValue(undefined),
      getDrivers: jest.fn().mockResolvedValue([]),
      getSoftware: jest.fn().mockResolvedValue([]),
      getCatalog: jest.fn().mockResolvedValue([]),
    };

    mockQueueService = {
      addInventoryIngest: jest.fn().mockResolvedValue({ jobId: 'job-001' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [
        { provide: InventoryService, useValue: mockInventoryService },
        { provide: QueueService, useValue: mockQueueService },
        { provide: DevicesService, useValue: mockDevicesService },
      ],
    }).compile();

    controller = module.get<InventoryController>(InventoryController);
  });

  describe('ingestReport', () => {
    it('accepts inventory report with device token auth via hashed lookup', async () => {
      mockDevicesService.findByToken.mockResolvedValue(mockDevice);

      const req = {
        headers: {
          authorization: 'Bearer tok-test-123',
        },
      } as any;

      const body = {
        drivers: [
          { name: 'nvidia', version: '550.120', vendor: 'NVIDIA' },
        ],
        software: [
          { name: 'nginx', version: '1.24.0' },
        ],
      };

      const result = await controller.ingestReport(req, body);
      expect(result).toBeDefined();
      expect(result.status).toBe('accepted');
      expect(result.orgId).toBe('org-001');
      expect(mockDevicesService.findByToken).toHaveBeenCalledWith('tok-test-123');
      expect(mockQueueService.addInventoryIngest).toHaveBeenCalledWith(
        expect.objectContaining({ orgId: 'org-001' }),
      );
    });

    it('uses x-org-id header when no device token', async () => {
      const req = {
        headers: {
          'x-org-id': 'org-002',
        },
      } as any;

      const body = { drivers: [], software: [] };
      const result = await controller.ingestReport(req, body);
      expect(result.orgId).toBe('org-002');
      expect(mockDevicesService.findByToken).not.toHaveBeenCalled();
      expect(mockQueueService.addInventoryIngest).toHaveBeenCalledWith(
        expect.objectContaining({ orgId: 'org-002' }),
      );
    });

    it('falls back to default org when no auth info', async () => {
      const req = { headers: {} } as any;
      const body = { drivers: [], software: [] };
      const result = await controller.ingestReport(req, body);
      expect(result.orgId).toBe('00000000-0000-0000-0000-000000000000');
      expect(mockDevicesService.findByToken).not.toHaveBeenCalled();
      expect(mockQueueService.addInventoryIngest).toHaveBeenCalledWith(
        expect.objectContaining({ orgId: '00000000-0000-0000-0000-000000000000' }),
      );
    });

    it('scopes inventory to device organization via hashed lookup', async () => {
      mockDevicesService.findByToken.mockResolvedValue({
        ...mockDevice,
        orgId: 'org-specific',
      });

      const req = {
        headers: {
          authorization: 'Bearer tok-test-123',
        },
      } as any;

      const body = { drivers: [], software: [] };
      const result = await controller.ingestReport(req, body);
      expect(result.orgId).toBe('org-specific');
      expect(mockQueueService.addInventoryIngest).toHaveBeenCalledWith(
        expect.objectContaining({ orgId: 'org-specific' }),
      );
    });

    it('rejects invalid device token and falls back to header org', async () => {
      mockDevicesService.findByToken.mockResolvedValue(null);

      const req = {
        headers: {
          authorization: 'Bearer invalid-token',
          'x-org-id': 'org-fallback',
        },
      } as any;

      const body = { drivers: [], software: [] };
      const result = await controller.ingestReport(req, body);
      expect(result.orgId).toBe('org-fallback');
      expect(mockDevicesService.findByToken).toHaveBeenCalledWith('invalid-token');
    });

    it('does not accept raw plaintext token as valid credential', async () => {
      mockDevicesService.findByToken.mockResolvedValue(null);

      const req = {
        headers: {
          authorization: 'Bearer plaintext-raw-token',
        },
      } as any;

      const body = { drivers: [], software: [] };
      const result = await controller.ingestReport(req, body);
      expect(result.orgId).toBe('00000000-0000-0000-0000-000000000000');
      expect(mockDevicesService.findByToken).toHaveBeenCalledWith('plaintext-raw-token');
    });

    it('authenticates via SHA-256 hash lookup, not plaintext database match', async () => {
      const rawToken = 'tok-rotation-test-456';
      const expectedHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      mockDevicesService.findByToken.mockImplementation(async (token: string) => {
        expect(token).toBe(rawToken);
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        expect(tokenHash).toBe(expectedHash);
        return { ...mockDevice, orgId: 'org-hash-verified' };
      });

      const req = {
        headers: {
          authorization: `Bearer ${rawToken}`,
        },
      } as any;

      const body = { drivers: [], software: [] };
      const result = await controller.ingestReport(req, body);
      expect(result.orgId).toBe('org-hash-verified');
      expect(mockDevicesService.findByToken).toHaveBeenCalledTimes(1);
    });
  });

  describe('negative: raw token cannot bypass hashed auth', () => {
    it('returns default org when token does not match any hashed credential', async () => {
      mockDevicesService.findByToken.mockResolvedValue(null);

      const req = {
        headers: {
          authorization: 'Bearer completely-fake-token',
        },
      } as any;

      const body = { drivers: [], software: [] };
      const result = await controller.ingestReport(req, body);
      expect(result.orgId).toBe('00000000-0000-0000-0000-000000000000');
      expect(mockQueueService.addInventoryIngest).toHaveBeenCalledWith(
        expect.objectContaining({ orgId: '00000000-0000-0000-0000-000000000000' }),
      );
    });

    it('does not perform direct prisma.device.findUnique for auth', async () => {
      const req = {
        headers: {
          authorization: 'Bearer any-token',
        },
      } as any;

      const body = { drivers: [], software: [] };
      await controller.ingestReport(req, body);
      expect(mockDevicesService.findByToken).toHaveBeenCalledWith('any-token');
    });
  });

  describe('listDrivers', () => {
    it('returns drivers for authenticated org', async () => {
      mockInventoryService.getDrivers.mockResolvedValue([
        { name: 'nvidia', status: 'current', orgId: 'org-001' },
      ]);

      const req = { user: { orgId: 'org-001' } } as any;
      const result = await controller.listDrivers(req);
      expect(result).toHaveLength(1);
    });

    it('returns empty when no orgId', async () => {
      const req = { user: {} } as any;
      const result = await controller.listDrivers(req);
      expect(result).toEqual([]);
    });
  });

  describe('listSoftware', () => {
    it('returns software for authenticated org', async () => {
      mockInventoryService.getSoftware.mockResolvedValue([
        { name: 'nginx', orgId: 'org-001' },
      ]);

      const req = { user: { orgId: 'org-001' } } as any;
      const result = await controller.listSoftware(req);
      expect(result).toHaveLength(1);
    });
  });
});
