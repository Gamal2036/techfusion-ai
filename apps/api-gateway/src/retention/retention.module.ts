import { Module } from '@nestjs/common';
import { RetentionService } from './retention.service';
import { RetentionController } from './retention.controller';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [QueueModule],
  controllers: [RetentionController],
  providers: [RetentionService],
  exports: [RetentionService],
})
export class RetentionModule {}
