import { Controller, Get, Put, Body, Req } from '@nestjs/common';
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
  async getRouterStats(@Req() req: any): Promise<RouterStats> {
    return this.aiRouter.getStats(req.user?.orgId)
  }

  @RequirePermissions(Permission.ORGANIZATION_SETTINGS)
  @Put('router/strategy')
  async updateStrategy(@Req() req: any, @Body('strategy') strategy: RouterStrategy): Promise<{ strategy: RouterStrategy }> {
    this.aiRouter.setStrategy(req.user?.orgId, strategy)
    return { strategy }
  }
}
