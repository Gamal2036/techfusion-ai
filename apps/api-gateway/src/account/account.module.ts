import { Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AccountDeletionService } from './account-deletion.service';

@Module({
  controllers: [AccountController],
  providers: [AccountDeletionService],
})
export class AccountModule {}
