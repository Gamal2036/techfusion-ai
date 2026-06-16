import { Module } from '@nestjs/common';
import { SecurityController } from './security.controller';
import { SecurityService } from './security.service';
import { SecurityScoringService } from './services/security-scoring.service';
import { SecurityReportingService } from './services/security-reporting.service';

@Module({
  controllers: [SecurityController],
  providers: [SecurityService, SecurityScoringService, SecurityReportingService],
  exports: [SecurityService, SecurityScoringService, SecurityReportingService],
})
export class SecurityModule {}
