import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { HealthController } from './health.controller';
import { MetricsController } from './metrics.controller';
import { MetricsInterceptor } from './metrics.interceptor';
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
import { NetworkModule } from './network/network.module';
import { InventoryModule } from './inventory/inventory.module';
import { BackupsModule } from './backups/backups.module';
import { KbModule } from './kb/kb.module';
import { SsoModule } from './sso/sso.module';
import { AuditModule } from './audit/audit.module';
import { EncryptionModule } from './encryption/encryption.module';
import { RetentionModule } from './retention/retention.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [PrismaModule, AuthModule, MfaModule, DevicesModule, AlertsModule, AiModule, SecurityModule, ReportingModule, BillingModule, RemoteSupportModule, NetworkModule, InventoryModule, BackupsModule, KbModule, SsoModule, AuditModule, EncryptionModule, RetentionModule, AdminModule],
  controllers: [HealthController, DemoController, MetricsController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
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
