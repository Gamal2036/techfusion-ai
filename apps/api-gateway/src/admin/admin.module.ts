import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminRecoveryController } from './admin-recovery.controller';
import { AdminRecoveryService } from './admin-recovery.service';
import { SupportAdminGuard } from './support-admin.guard';

@Module({
  controllers: [AdminController, AdminRecoveryController],
  providers: [AdminService, AdminRecoveryService, SupportAdminGuard],
  exports: [AdminService, AdminRecoveryService],
})
export class AdminModule {}
