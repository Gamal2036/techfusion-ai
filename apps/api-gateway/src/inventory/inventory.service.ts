import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

function parseVersion(v: string): number[] {
  return v.split(/[.\-_]/).map((s) => {
    const n = parseInt(s, 10);
    return isNaN(n) ? 0 : n;
  });
}

export function compareVersions(a: string, b: string): number {
  const aParts = parseVersion(a);
  const bParts = parseVersion(b);
  const len = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < len; i++) {
    const diff = (aParts[i] ?? 0) - (bParts[i] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

const SEED_DRIVERS = [
  { name: 'nvidia', vendor: 'NVIDIA Corporation', latestVersion: '550.120', category: 'gpu', isBuiltin: false },
  { name: 'amdgpu', vendor: 'Advanced Micro Devices', latestVersion: '6.8.0', category: 'gpu', isBuiltin: true },
  { name: 'i915', vendor: 'Intel Corporation', latestVersion: '6.8.0', category: 'gpu', isBuiltin: true },
  { name: 'e1000', vendor: 'Intel Corporation', latestVersion: '6.8.0', category: 'network', isBuiltin: true },
  { name: 'e1000e', vendor: 'Intel Corporation', latestVersion: '6.8.0', category: 'network', isBuiltin: true },
  { name: 'igb', vendor: 'Intel Corporation', latestVersion: '6.8.0', category: 'network', isBuiltin: true },
  { name: 'ixgbe', vendor: 'Intel Corporation', latestVersion: '6.8.0', category: 'network', isBuiltin: true },
  { name: 'r8169', vendor: 'Realtek Semiconductor', latestVersion: '6.8.0', category: 'network', isBuiltin: true },
  { name: 'rtl8192cu', vendor: 'Realtek Semiconductor', latestVersion: '6.8.0', category: 'wireless', isBuiltin: true },
  { name: 'iwlwifi', vendor: 'Intel Corporation', latestVersion: '6.8.0', category: 'wireless', isBuiltin: true },
  { name: 'ath9k', vendor: 'Qualcomm Atheros', latestVersion: '6.8.0', category: 'wireless', isBuiltin: true },
  { name: 'ath10k', vendor: 'Qualcomm Atheros', latestVersion: '6.8.0', category: 'wireless', isBuiltin: true },
  { name: 'nvme', vendor: 'NVM Express', latestVersion: '6.8.0', category: 'storage', isBuiltin: true },
  { name: 'ahci', vendor: 'Generic', latestVersion: '6.8.0', category: 'storage', isBuiltin: true },
  { name: 'megaraid_sas', vendor: 'Broadcom', latestVersion: '6.8.0', category: 'storage', isBuiltin: true },
  { name: 'mlx5_core', vendor: 'Mellanox Technologies', latestVersion: '6.8.0', category: 'network', isBuiltin: true },
  { name: 'bnxt_en', vendor: 'Broadcom', latestVersion: '6.8.0', category: 'network', isBuiltin: true },
  { name: 'tg3', vendor: 'Broadcom', latestVersion: '6.8.0', category: 'network', isBuiltin: true },
  { name: 'snd_hda_intel', vendor: 'Intel Corporation', latestVersion: '6.8.0', category: 'audio', isBuiltin: true },
  { name: 'usb_storage', vendor: 'Generic', latestVersion: '6.8.0', category: 'storage', isBuiltin: true },
  { name: 'xhci_hcd', vendor: 'Generic', latestVersion: '6.8.0', category: 'usb', isBuiltin: true },
  { name: 'virtio_net', vendor: 'Red Hat', latestVersion: '6.8.0', category: 'network', isBuiltin: true },
  { name: 'virtio_blk', vendor: 'Red Hat', latestVersion: '6.8.0', category: 'storage', isBuiltin: true },
  { name: 'vmwgfx', vendor: 'VMware', latestVersion: '6.8.0', category: 'gpu', isBuiltin: true },
  { name: 'vmxnet3', vendor: 'VMware', latestVersion: '6.8.0', category: 'network', isBuiltin: true },
];

@Injectable()
export class InventoryService implements OnModuleInit {
  private readonly logger = new Logger(InventoryService.name);

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedCatalog();
  }

  private async seedCatalog() {
    for (const d of SEED_DRIVERS) {
      await this.prisma.driverCatalogItem.upsert({
        where: { name_vendor: { name: d.name, vendor: d.vendor } },
        update: { latestVersion: d.latestVersion, category: d.category },
        create: { ...d, minVersion: '1.0.0' },
      });
    }
  }

  async ingestReport(orgId: string, body: any) {
    const drivers = body.drivers || [];
    const software = body.software || [];
    const deviceId = body.deviceId || null;

    this.logger.log(`[INVENTORY] Ingesting report for device ${deviceId}: ${drivers.length} drivers, ${software.length} software`);

    let driverCount = 0;
    let softwareCount = 0;

    for (const d of drivers) {
      try {
        const catalogEntry = await this.prisma.driverCatalogItem.findFirst({
          where: { name: d.name },
        });

        let status = 'unknown';
        if (catalogEntry && d.version && catalogEntry.latestVersion) {
          status = compareVersions(d.version, catalogEntry.latestVersion) >= 0 ? 'current' : 'outdated';
        } else if (catalogEntry) {
          status = 'missing';
        } else {
          status = 'unknown';
        }

        await this.prisma.driver.upsert({
          where: { orgId_name: { orgId, name: d.name } },
          update: {
            deviceId,
            vendor: d.vendor || null,
            version: d.version || null,
            modulePath: d.module_path || null,
            usedBy: d.used_by || null,
            source: d.source || 'kernel_module',
            status,
            lastSeenAt: new Date(),
            metadata: d,
          },
          create: {
            orgId,
            deviceId,
            name: d.name,
            vendor: d.vendor || null,
            version: d.version || null,
            modulePath: d.module_path || null,
            usedBy: d.used_by || null,
            source: d.source || 'kernel_module',
            status,
            metadata: d,
          },
        });
        driverCount++;
      } catch (e: any) {
        this.logger.warn(`[INVENTORY] Failed to upsert driver ${d.name}: ${e.message}`);
      }
    }

    for (const s of software) {
      try {
        await this.prisma.softwareInventory.upsert({
          where: { orgId_name: { orgId, name: s.name } },
          update: {
            deviceId,
            version: s.version || null,
            vendor: s.vendor || null,
            installDate: s.install_date || null,
            description: s.description || null,
            source: s.source || 'deb',
            lastSeenAt: new Date(),
            metadata: s,
          },
          create: {
            orgId,
            deviceId,
            name: s.name,
            version: s.version || null,
            vendor: s.vendor || null,
            installDate: s.install_date || null,
            description: s.description || null,
            source: s.source || 'deb',
            metadata: s,
          },
        });
        softwareCount++;
      } catch (e: any) {
        this.logger.warn(`[INVENTORY] Failed to upsert software ${s.name}: ${e.message}`);
      }
    }

    this.logger.log(`[INVENTORY] Report completed: ${driverCount} drivers, ${softwareCount} software persisted`);
    return { driverCount, softwareCount };
  }

  async getDrivers(orgId: string, status?: string) {
    const where: any = { orgId };
    if (status) where.status = status;
    return this.prisma.driver.findMany({ where, orderBy: { name: 'asc' } });
  }

  async getSoftware(orgId: string, source?: string) {
    const where: any = { orgId };
    if (source) where.source = source;
    return this.prisma.softwareInventory.findMany({ where, orderBy: { name: 'asc' } });
  }

  async getCatalog() {
    return this.prisma.driverCatalogItem.findMany({ orderBy: { name: 'asc' } });
  }

  getVersionStatus(current: string | null, latest: string | null): string {
    if (!current) return 'missing';
    if (!latest) return 'unknown';
    return compareVersions(current, latest) >= 0 ? 'current' : 'outdated';
  }

  async setPendingInventory(deviceId: string): Promise<void> {
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) return;
    const existingMeta = (device.metadata as Record<string, any>) || {};
    await this.prisma.device.update({
      where: { id: deviceId },
      data: {
        metadata: {
          ...existingMeta,
          inventoryPending: true,
          inventoryPendingAt: new Date().toISOString(),
        },
      },
    });
  }

  async getPendingInventoryFlag(deviceId: string): Promise<boolean> {
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device || !device.metadata) return false;
    const meta = device.metadata as Record<string, any>;
    if (meta.inventoryPending !== true) return false;

    const pendingAt = meta.inventoryPendingAt ? new Date(meta.inventoryPendingAt).getTime() : 0;
    const staleThreshold = Date.now() - 10 * 60 * 1000;
    if (pendingAt < staleThreshold) {
      await this.clearPendingInventory(deviceId);
      return false;
    }
    return true;
  }

  async clearPendingInventory(deviceId: string): Promise<void> {
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device || !device.metadata) return;
    const meta = device.metadata as Record<string, any>;
    if (meta.inventoryPending === undefined && meta.inventoryPendingAt === undefined) return;
    const { inventoryPending, inventoryPendingAt, ...rest } = meta;
    await this.prisma.device.update({
      where: { id: deviceId },
      data: { metadata: Object.keys(rest).length > 0 ? rest : Prisma.DbNull },
    });
  }

  async cleanupStalePendingInventory(): Promise<number> {
    const devices = await this.prisma.device.findMany();

    let cleaned = 0;
    for (const device of devices) {
      if (!device.metadata) continue;
      const meta = device.metadata as Record<string, any>;
      if (meta.inventoryPending === true && meta.inventoryPendingAt) {
        const pendingAt = new Date(meta.inventoryPendingAt).getTime();
        if (pendingAt < Date.now() - 10 * 60 * 1000) {
          const { inventoryPending, inventoryPendingAt, ...rest } = meta;
          await this.prisma.device.update({
            where: { id: device.id },
            data: { metadata: Object.keys(rest).length > 0 ? rest : Prisma.DbNull },
          });
          cleaned++;
        }
      }
    }
    if (cleaned > 0) {
      this.logger.log(`[INVENTORY] Cleaned up ${cleaned} stale pending inventory flags`);
    }
    return cleaned;
  }
}
