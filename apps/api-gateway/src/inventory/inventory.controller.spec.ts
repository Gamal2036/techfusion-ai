import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { QueueService } from '../queue/queue.service';
import { DevicesService } from '../devices/devices.service';
import { PrismaService } from '../prisma/prisma.service';
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
      getPendingInventoryFlag: jest.fn().mockResolvedValue(false),
      setPendingInventory: jest.fn().mockResolvedValue(undefined),
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
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    controller = module.get<InventoryController>(InventoryController);
  });

  describe('ingestReport', () => {
    it('derives org and device from the authenticated device (request.device)', async () => {
      const req = {
        device: mockDevice,
        headers: {},
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
      expect(result.status).toBe('accepted');
      expect(result.orgId).toBe('org-001');
      expect(result.deviceId).toBe('dev-001');
      expect(mockQueueService.addInventoryIngest).toHaveBeenCalledWith(
        expect.objectContaining({ orgId: 'org-001', deviceId: 'dev-001' }),
      );
      expect(mockDevicesService.findByToken).not.toHaveBeenCalled();
    });

    it('does not trust x-org-id header when it matches (metadata consistency only)', async () => {
      const req = {
        device: mockDevice,
        headers: { 'x-org-id': 'org-001' },
      } as any;

      const result = await controller.ingestReport(req, { drivers: [], software: [] });
      expect(result.orgId).toBe('org-001');
    });

    it('rejects x-org-id header that does not match the authenticated device org', async () => {
      const req = {
        device: mockDevice,
        headers: { 'x-org-id': 'org-victim' },
      } as any;

      await expect(controller.ingestReport(req, { drivers: [], software: [] }))
        .rejects.toThrow(ForbiddenException);
      expect(mockQueueService.addInventoryIngest).not.toHaveBeenCalled();
    });

    it('rejects payload deviceId that does not match the authenticated device', async () => {
      const req = {
        device: mockDevice,
        headers: {},
      } as any;

      const body = { deviceId: 'dev-victim', drivers: [], software: [] };
      await expect(controller.ingestReport(req, body))
        .rejects.toThrow(ForbiddenException);
      expect(mockQueueService.addInventoryIngest).not.toHaveBeenCalled();
    });

    it('accepts payload deviceId matching the authenticated device', async () => {
      const req = {
        device: mockDevice,
        headers: {},
      } as any;

      const body = { deviceId: 'dev-001', drivers: [], software: [] };
      const result = await controller.ingestReport(req, body);
      expect(result.orgId).toBe('org-001');
      expect(result.deviceId).toBe('dev-001');
    });
  });

  describe('checkPendingInventory', () => {
    it('rejects when device token belongs to a different device', async () => {
      const req = {
        device: { ...mockDevice, id: 'dev-other' },
        headers: {},
      } as any;

      await expect(controller.checkPendingInventory(req, 'dev-001')).rejects.toThrow();
    });

    it('returns pending flag for the authenticated device', async () => {
      mockInventoryService.getPendingInventoryFlag.mockResolvedValue(true);
      const req = { device: mockDevice, headers: {} } as any;
      const result = await controller.checkPendingInventory(req, 'dev-001');
      expect(result).toEqual({ pending: true });
    });
  });

  describe('clearPendingInventory', () => {
    it('rejects when device token belongs to a different device', async () => {
      const req = {
        device: { ...mockDevice, id: 'dev-other' },
        headers: {},
      } as any;

      await expect(controller.clearPendingInventory(req, 'dev-001')).rejects.toThrow();
    });

    it('clears pending flag for the authenticated device', async () => {
      const req = { device: mockDevice, headers: {} } as any;
      const result = await controller.clearPendingInventory(req, 'dev-001');
      expect(result).toEqual({ cleared: true });
      expect(mockInventoryService.clearPendingInventory).toHaveBeenCalledWith('dev-001');
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
