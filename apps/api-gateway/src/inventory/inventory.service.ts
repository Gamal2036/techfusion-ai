import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

    for (const d of drivers) {
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
    }

    for (const s of software) {
      await this.prisma.softwareInventory.upsert({
        where: { orgId_name: { orgId, name: s.name } },
        update: {
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
          name: s.name,
          version: s.version || null,
          vendor: s.vendor || null,
          installDate: s.install_date || null,
          description: s.description || null,
          source: s.source || 'deb',
          metadata: s,
        },
      });
    }

    return { driverCount: drivers.length, softwareCount: software.length };
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
}
