import { Module } from '@nestjs/common';
import { NetworkController } from './network.controller';
import { NetworkService } from './network.service';
import { NetworkGateway } from './network.gateway';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [NetworkController],
  providers: [NetworkService, NetworkGateway],
  exports: [NetworkService],
})
export class NetworkModule {}
