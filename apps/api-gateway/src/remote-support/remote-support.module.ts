import { Module } from '@nestjs/common';
import { RemoteSupportController } from './remote-support.controller';

@Module({
  controllers: [RemoteSupportController],
})
export class RemoteSupportModule {}
