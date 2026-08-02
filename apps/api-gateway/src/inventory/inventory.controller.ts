import { Controller, Get, Post, Query, Body, Req, Param, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { InventoryService } from './inventory.service';
import { QueueService } from '../queue/queue.service';
import { DevicesService } from '../devices/devices.service';
import { Public } from '../common/public.decorator';
import { throttle } from '../config/rate-limits';
import * as crypto from 'crypto';

@Controller('inventory')
export class InventoryController {
  constructor(
    private inventoryService: InventoryService,
    private queueService: QueueService,
    private devicesService: DevicesService,
  ) {}

  @Public()
  @Throttle(throttle(20, 60000))
  @Post('report')
  async ingestReport(@Req() req: any, @Body() body: any) {
    try {
      let orgId = req.headers['x-org-id'] || body?.orgId;
      let deviceId = body.deviceId || 'unknown';

      const authHeader = req.headers['authorization'] as string | undefined;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        const device = await this.devicesService.findByToken(token);
        if (device) {
          orgId = device.orgId;
          deviceId = device.id;
        }
      }

      if (!orgId) {
        orgId = '00000000-0000-0000-0000-000000000000';
      }

      const drivers = body.drivers || [];
      const software = body.software || [];
      const reportType = body.reportType || 'full';

      const payloadHash = crypto
        .createHash('sha256')
        .update(JSON.stringify({ orgId, deviceId, drivers, software }))
        .digest('hex')
        .slice(0, 16);

      console.log(`[INVENTORY] Report received: device=${deviceId} org=${orgId} drivers=${drivers.length} software=${software.length}`);

      await this.queueService.addInventoryIngest({
        orgId,
        deviceId,
        drivers,
        software,
        reportType,
        reportVersion: body.reportVersion || '1.0',
        collectedAt: body.collectedAt || new Date().toISOString(),
        payloadHash,
      });

      await this.inventoryService.clearPendingInventory(deviceId);

      return {
        status: 'accepted',
        message: 'Inventory report queued for processing',
        orgId,
        deviceId,
        payloadHash,
      };
    } catch (err) {
      console.error('[INVENTORY] Error:', err);
      throw err;
    }
  }

  @Get('drivers')
  async listDrivers(@Req() req: any, @Query('status') status?: string) {
    const orgId = req.user?.orgId;
    if (!orgId) return [];
    return this.inventoryService.getDrivers(orgId, status);
  }

  @Get('software')
  async listSoftware(@Req() req: any, @Query('source') source?: string) {
    const orgId = req.user?.orgId;
    if (!orgId) return [];
    return this.inventoryService.getSoftware(orgId, source);
  }

  @Get('catalog')
  async getCatalog() {
    return this.inventoryService.getCatalog();
  }

  @Post('refresh')
  async refreshInventory(@Req() req: any, @Body() body: { deviceId?: string }) {
    const orgId = req.user?.orgId;
    if (!orgId) throw new UnauthorizedException('Authentication required');

    const devices = body.deviceId
      ? [await this.devicesService.findById(body.deviceId, orgId)]
      : await this.devicesService.findByOrg(orgId);

    const onlineDevices = (Array.isArray(devices) ? devices : [devices]).filter(
      (d: any) => d && !d.inactive && new Date(d.lastSeenAt).getTime() > Date.now() - 30 * 60 * 1000,
    );

    if (onlineDevices.length === 0) {
      return { status: 'no_online_devices', message: 'No online devices available for inventory refresh' };
    }

    let requestedCount = 0;
    for (const device of onlineDevices) {
      const alreadyPending = await this.inventoryService.getPendingInventoryFlag(device.id);
      if (alreadyPending) {
        console.log(`[INVENTORY] Device ${device.id} already has pending inventory, skipping duplicate`);
        continue;
      }
      await this.inventoryService.setPendingInventory(device.id);
      requestedCount++;
    }

    return {
      status: 'requested',
      message: `Inventory refresh requested for ${requestedCount} device(s)`,
      deviceCount: requestedCount,
    };
  }

  @Public()
  @Throttle(throttle(30, 60000))
  @Get('pending/:deviceId')
  async checkPendingInventory(@Req() req: any, @Param('deviceId') deviceId: string) {
    const token = req.headers?.authorization?.replace('Bearer ', '');
    if (!token) {
      return { pending: false };
    }

    const device = await this.devicesService.findByToken(token);
    if (!device || device.id !== deviceId) {
      throw new UnauthorizedException('Invalid device token');
    }

    const pending = await this.inventoryService.getPendingInventoryFlag(deviceId);
    return { pending };
  }

  @Public()
  @Throttle(throttle(30, 60000))
  @Post('pending/:deviceId/clear')
  async clearPendingInventory(@Req() req: any, @Param('deviceId') deviceId: string) {
    const token = req.headers?.authorization?.replace('Bearer ', '');
    if (!token) {
      return { cleared: false };
    }

    const device = await this.devicesService.findByToken(token);
    if (!device || device.id !== deviceId) {
      throw new UnauthorizedException('Invalid device token');
    }

    await this.inventoryService.clearPendingInventory(deviceId);
    return { cleared: true };
  }
}
