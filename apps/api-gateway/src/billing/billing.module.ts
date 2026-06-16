import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PlanGuard } from './plan.guard';

@Module({
  controllers: [BillingController],
  providers: [BillingService, PlanGuard],
  exports: [BillingService, PlanGuard],
})
export class BillingModule {}
