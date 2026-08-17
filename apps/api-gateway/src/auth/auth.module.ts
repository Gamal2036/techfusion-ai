import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EncryptionModule } from '../encryption/encryption.module';
import { MfaModule } from '../mfa/mfa.module';
import { ReauthenticationModule } from '../reauthentication/reauthentication.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [EncryptionModule, MfaModule, ReauthenticationModule, AuditModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
