import { Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AccountDeletionService } from './account-deletion.service';
import { AccountProfileService } from './account-profile.service';

@Module({
  controllers: [AccountController],
  providers: [AccountDeletionService, AccountProfileService],
})
export class AccountModule {}
