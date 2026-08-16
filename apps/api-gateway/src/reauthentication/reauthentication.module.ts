import { Module } from '@nestjs/common';
import { ReauthenticationService } from './reauthentication.service';

@Module({
  providers: [ReauthenticationService],
  exports: [ReauthenticationService],
})
export class ReauthenticationModule {}
