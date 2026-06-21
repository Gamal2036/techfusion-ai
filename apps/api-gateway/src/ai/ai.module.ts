import { Module, forwardRef } from '@nestjs/common';
import { AiOrchestratorService } from './ai-orchestrator.service';
import { EncryptionService } from './services/encryption.service';
import { CostTrackerService } from './services/cost-tracker.service';
import { AiUsageService } from './services/ai-usage.service';
import { TroubleshootingController } from './controllers/troubleshooting.controller';
import { AiRouterController } from './controllers/ai-router.controller';
import { AiRouterService } from './router/ai-router.service';
import { KbModule } from '../kb/kb.module';

@Module({
  imports: [forwardRef(() => KbModule)],
  controllers: [TroubleshootingController, AiRouterController],
  providers: [
    AiOrchestratorService,
    EncryptionService,
    CostTrackerService,
    AiUsageService,
    AiRouterService,
  ],
  exports: [AiOrchestratorService, AiUsageService, AiRouterService],
})
export class AiModule {}
