import { Module } from '@nestjs/common';
import { AiOrchestratorService } from './ai-orchestrator.service';
import { EncryptionService } from './services/encryption.service';
import { CostTrackerService } from './services/cost-tracker.service';
import { AiUsageService } from './services/ai-usage.service';
import { TroubleshootingController } from './controllers/troubleshooting.controller';

@Module({
  controllers: [TroubleshootingController],
  providers: [
    AiOrchestratorService,
    EncryptionService,
    CostTrackerService,
    AiUsageService,
  ],
  exports: [AiOrchestratorService, AiUsageService],
})
export class AiModule {}
