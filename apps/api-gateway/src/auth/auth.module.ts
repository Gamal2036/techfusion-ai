import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import { EncryptionModule } from '../encryption/encryption.module';
import { MfaModule } from '../mfa/mfa.module';
import { ReauthenticationModule } from '../reauthentication/reauthentication.module';
import { AuditModule } from '../audit/audit.module';
import { MailModule } from '../mail/mail.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [EncryptionModule, MfaModule, ReauthenticationModule, AuditModule, MailModule, QueueModule],
  controllers: [AuthController],
  providers: [AuthService, PasswordResetService],
  exports: [AuthService, PasswordResetService],
})
export class AuthModule {}
