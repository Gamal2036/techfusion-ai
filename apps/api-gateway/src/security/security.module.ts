import { Module } from '@nestjs/common';
import { SecurityController } from './security.controller';
import { SecurityService } from './security.service';
import { SecurityScoringService } from './services/security-scoring.service';
import { SecurityReportingService } from './services/security-reporting.service';
import { QueueModule } from '../queue/queue.module';
import { DevicesModule } from '../devices/devices.module';

@Module({
  imports: [QueueModule, DevicesModule],
  controllers: [SecurityController],
  providers: [SecurityService, SecurityScoringService, SecurityReportingService],
  exports: [SecurityService, SecurityScoringService, SecurityReportingService],
})
export class SecurityModule {}
