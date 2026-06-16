import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { MfaModule } from './mfa/mfa.module';
import { DevicesModule } from './devices/devices.module';
import { AlertsModule } from './alerts/alerts.module';
import { AiModule } from './ai/ai.module';
import { SecurityModule } from './security/security.module';
import { ReportingModule } from './reporting/reporting.module';
import { CombinedAuthGuard } from './common/combined-auth.guard';
import { PlanGuard } from './billing/plan.guard';
import { DemoController } from './demo.controller';
import { BillingModule } from './billing/billing.module';
import { RemoteSupportModule } from './remote-support/remote-support.module';

@Module({
  imports: [PrismaModule, AuthModule, MfaModule, DevicesModule, AlertsModule, AiModule, SecurityModule, ReportingModule, BillingModule, RemoteSupportModule],
  controllers: [HealthController, DemoController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: CombinedAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PlanGuard,
    },
  ],
})
export class AppModule {}
