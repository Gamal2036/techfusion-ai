import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { MfaModule } from './mfa/mfa.module';
import { DevicesModule } from './devices/devices.module';
import { CombinedAuthGuard } from './common/combined-auth.guard';
import { DemoController } from './demo.controller';

@Module({
  imports: [PrismaModule, AuthModule, MfaModule, DevicesModule],
  controllers: [HealthController, DemoController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: CombinedAuthGuard,
    },
  ],
})
export class AppModule {}
