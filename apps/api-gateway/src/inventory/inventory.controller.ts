import { Controller, Get, Post, Query, Body, Req, Param } from '@nestjs/common';
import { InventoryService } from './inventory.service';

@Controller('inventory')
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @Post('report')
  async ingestReport(@Req() req: any, @Body() body: any) {
    const orgId = req.headers['x-org-id'] || body?.orgId || '00000000-0000-0000-0000-000000000000';
    return this.inventoryService.ingestReport(orgId, body);
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
}
