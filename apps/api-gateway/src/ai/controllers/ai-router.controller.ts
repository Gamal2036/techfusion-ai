import { Controller, Get, Put, Body } from '@nestjs/common';
import { Roles } from '../../common/roles.decorator';
import { AiRouterService } from '../router/ai-router.service';
import { ProviderStatus, RouterStats, RouterStrategy } from '../types/ai-provider.types';

@Controller('ai')
export class AiRouterController {
  constructor(private readonly aiRouter: AiRouterService) {}

  @Roles('Owner', 'Admin')
  @Get('providers/status')
  async getProvidersStatus(): Promise<ProviderStatus[]> {
    return this.aiRouter.getProvidersStatus()
  }

  @Roles('Owner', 'Admin')
  @Get('router/stats')
  async getRouterStats(): Promise<RouterStats> {
    return this.aiRouter.getStats()
  }

  @Roles('Owner', 'Admin')
  @Put('router/strategy')
  async updateStrategy(@Body('strategy') strategy: RouterStrategy): Promise<{ strategy: RouterStrategy }> {
    this.aiRouter.setStrategy(strategy)
    return { strategy }
  }
}
