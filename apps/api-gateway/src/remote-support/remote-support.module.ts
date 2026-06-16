import { Module } from '@nestjs/common';
import { RemoteSupportController } from './remote-support.controller';
import { RemoteSupportService } from './remote-support.service';
import { RemoteSupportGateway } from './remote-support.gateway';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RemoteSupportController],
  providers: [RemoteSupportService, RemoteSupportGateway],
  exports: [RemoteSupportService, RemoteSupportGateway],
})
export class RemoteSupportModule {}
