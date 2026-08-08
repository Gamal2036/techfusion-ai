import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { getRateLimitConfig } from './config/rate-limits';
import { HealthController } from './health.controller';
import { MetricsController } from './metrics.controller';
import { MetricsInterceptor } from './metrics.interceptor';
import { CorrelationIdInterceptor } from './common/correlation-id';
import { RequestLoggingInterceptor } from './common/request-logging.interceptor';
import { BigIntSerializerInterceptor } from './common/bigint-serializer.interceptor';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { MfaModule } from './mfa/mfa.module';
import { DevicesModule } from './devices/devices.module';
import { AlertsModule } from './alerts/alerts.module';
import { AiModule } from './ai/ai.module';
import { SecurityModule } from './security/security.module';
import { ReportingModule } from './reporting/reporting.module';
import { CombinedAuthGuard } from './common/combined-auth.guard';
import { PermissionsGuard } from './common/permissions.guard';
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
import { QueueModule } from './queue/queue.module';
import { EnrollmentModule } from './enrollment/enrollment.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { AccountModule } from './account/account.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot(getRateLimitConfig()),
    PrismaModule, AuthModule, MfaModule, DevicesModule, AlertsModule, AiModule, SecurityModule, ReportingModule, BillingModule, RemoteSupportModule, NetworkModule, InventoryModule, BackupsModule, KbModule, SsoModule, AuditModule, EncryptionModule, RetentionModule, AdminModule, QueueModule, EnrollmentModule, DashboardModule, MonitoringModule, OrganizationsModule, AccountModule,
  ],
  controllers: [HealthController, DemoController, MetricsController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: CorrelationIdInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: BigIntSerializerInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: CombinedAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PlanGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
