import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { AlertEvaluationService } from './alert-evaluation.service';
import { NotificationService } from './notification.service';
import { AlertsGateway } from './alerts.gateway';

@Module({
  controllers: [AlertsController],
  providers: [AlertsService, AlertEvaluationService, NotificationService, AlertsGateway],
  exports: [AlertEvaluationService, AlertsService, AlertsGateway, NotificationService],
})
export class AlertsModule {}
