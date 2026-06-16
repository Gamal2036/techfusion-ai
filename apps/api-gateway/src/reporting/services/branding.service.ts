import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BrandingConfig } from './report-generator.interface';

@Injectable()
export class BrandingService {
  private readonly logger = new Logger(BrandingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getBranding(orgId: string): Promise<BrandingConfig> {
    try {
      const template = await this.prisma.reportTemplate.findUnique({
        where: { orgId },
      });

      if (template) {
        return {
          companyName: template.companyName || undefined,
          logoPath: template.logoPath || undefined,
          accentColor: template.accentColor,
        };
      }
    } catch (err) {
      this.logger.warn(`Failed to load branding for org ${orgId}: ${(err as Error).message}`);
    }

    return { accentColor: '#3b82f6' };
  }

  async setBranding(orgId: string, config: Partial<BrandingConfig>): Promise<BrandingConfig> {
    const template = await this.prisma.reportTemplate.upsert({
      where: { orgId },
      update: {
        companyName: config.companyName ?? undefined,
        logoPath: config.logoPath ?? undefined,
        accentColor: config.accentColor ?? '#3b82f6',
      },
      create: {
        orgId,
        companyName: config.companyName || null,
        logoPath: config.logoPath || null,
        accentColor: config.accentColor || '#3b82f6',
      },
    });

    return {
      companyName: template.companyName || undefined,
      logoPath: template.logoPath || undefined,
      accentColor: template.accentColor,
    };
  }
}
