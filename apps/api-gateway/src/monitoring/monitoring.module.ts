import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { PresenceSweepSchedulerService } from './presence-sweep-scheduler.service';

@Module({
  imports: [QueueModule],
  providers: [PresenceSweepSchedulerService],
  exports: [PresenceSweepSchedulerService],
})
export class MonitoringModule {}
