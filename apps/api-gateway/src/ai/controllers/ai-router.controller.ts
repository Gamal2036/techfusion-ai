import { Controller, Get, Put, Body } from '@nestjs/common';
import { RequirePermissions } from '../../common/permissions.decorator';
import { Permission } from '../../common/permissions';
import { AiRouterService } from '../router/ai-router.service';
import { ProviderStatus, RouterStats, RouterStrategy } from '../types/ai-provider.types';

@Controller('ai')
export class AiRouterController {
  constructor(private readonly aiRouter: AiRouterService) {}

  @RequirePermissions(Permission.ORGANIZATION_SETTINGS)
  @Get('providers/status')
  async getProvidersStatus(): Promise<ProviderStatus[]> {
    return this.aiRouter.getProvidersStatus()
  }

  @RequirePermissions(Permission.ORGANIZATION_SETTINGS)
  @Get('router/stats')
  async getRouterStats(): Promise<RouterStats> {
    return this.aiRouter.getStats()
  }

  @RequirePermissions(Permission.ORGANIZATION_SETTINGS)
  @Put('router/strategy')
  async updateStrategy(@Body('strategy') strategy: RouterStrategy): Promise<{ strategy: RouterStrategy }> {
    this.aiRouter.setStrategy(strategy)
    return { strategy }
  }
}
