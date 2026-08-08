import { Controller, Get, Post, Query, Body, Req, Param, UseGuards, UnauthorizedException, ForbiddenException, Logger } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { InventoryService } from './inventory.service';
import { QueueService } from '../queue/queue.service';
import { DevicesService } from '../devices/devices.service';
import { DeviceTokenGuard } from '../devices/device-token.guard';
import { Public } from '../common/public.decorator';
import { RequirePermissions } from '../common/permissions.decorator';
import { Permission } from '../common/permissions';
import { createStructuredLogger } from '../common/structured-logger';
import { throttle } from '../config/rate-limits';
import * as crypto from 'crypto';

@Controller('inventory')
export class InventoryController {
  private readonly logger = createStructuredLogger(InventoryController.name);

  constructor(
    private inventoryService: InventoryService,
    private queueService: QueueService,
    private devicesService: DevicesService,
  ) {}

  @Public()
  @UseGuards(DeviceTokenGuard)
  @Throttle(throttle(20, 60000))
  @Post('report')
  async ingestReport(@Req() req: any, @Body() body: any) {
    const device = req.device;
    const orgId = device.orgId;
    const deviceId = device.id;

    const clientOrgId = req.headers['x-org-id'] || body?.orgId;
    if (clientOrgId && clientOrgId !== orgId) {
      this.logger.warn('tenant_ingestion_denied', {
        event: 'tenant_ingestion_denied',
        orgId,
        deviceId,
        reason: 'client_org_id_mismatch',
        clientOrgId,
      });
      throw new ForbiddenException('Organization context mismatch');
    }

    if (body.deviceId && body.deviceId !== deviceId) {
      this.logger.warn('device_org_mismatch', {
        event: 'device_org_mismatch',
        orgId,
        deviceId,
        claimedDeviceId: body.deviceId,
      });
      throw new ForbiddenException('Device ownership mismatch');
    }

    const drivers = body.drivers || [];
    const software = body.software || [];
    const reportType = body.reportType || 'full';

    const payloadHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({ orgId, deviceId, drivers, software }))
      .digest('hex')
      .slice(0, 16);

    this.logger.log(`[INVENTORY] Report received: device=${deviceId} org=${orgId} drivers=${drivers.length} software=${software.length}`);

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
  }

  @RequirePermissions(Permission.INVENTORY_VIEW)
  @Get('drivers')
  async listDrivers(@Req() req: any, @Query('status') status?: string) {
    const orgId = req.user?.orgId;
    if (!orgId) return [];
    return this.inventoryService.getDrivers(orgId, status);
  }

  @RequirePermissions(Permission.INVENTORY_VIEW)
  @Get('software')
  async listSoftware(@Req() req: any, @Query('source') source?: string) {
    const orgId = req.user?.orgId;
    if (!orgId) return [];
    return this.inventoryService.getSoftware(orgId, source);
  }

  @RequirePermissions(Permission.INVENTORY_VIEW)
  @Get('catalog')
  async getCatalog() {
    return this.inventoryService.getCatalog();
  }

  @RequirePermissions(Permission.DEVICES_MANAGE)
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
  @UseGuards(DeviceTokenGuard)
  @Throttle(throttle(30, 60000))
  @Get('pending/:deviceId')
  async checkPendingInventory(@Req() req: any, @Param('deviceId') deviceId: string) {
    const device = req.device;
    if (device.id !== deviceId) {
      throw new UnauthorizedException('Invalid device token');
    }

    const pending = await this.inventoryService.getPendingInventoryFlag(deviceId);
    return { pending };
  }

  @Public()
  @UseGuards(DeviceTokenGuard)
  @Throttle(throttle(30, 60000))
  @Post('pending/:deviceId/clear')
  async clearPendingInventory(@Req() req: any, @Param('deviceId') deviceId: string) {
    const device = req.device;
    if (device.id !== deviceId) {
      throw new UnauthorizedException('Invalid device token');
    }

    await this.inventoryService.clearPendingInventory(deviceId);
    return { cleared: true };
  }
}
