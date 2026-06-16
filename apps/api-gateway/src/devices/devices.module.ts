import { Module } from '@nestjs/common';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { ScoringService } from './scoring.service';
import { DeviceTokenGuard } from './device-token.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { DevicesGateway } from './devices.gateway';

@Module({
  imports: [PrismaModule],
  controllers: [DevicesController],
  providers: [DevicesService, ScoringService, DeviceTokenGuard, DevicesGateway],
  exports: [DevicesService, ScoringService],
})
export class DevicesModule {}
