import { Module } from '@nestjs/common';
import { MfaController } from './mfa.controller';
import { MfaService } from './mfa.service';
import { RecoveryCodesService } from './recovery-codes.service';
import { EncryptionModule } from '../encryption/encryption.module';
import { ReauthenticationModule } from '../reauthentication/reauthentication.module';

@Module({
  imports: [EncryptionModule, ReauthenticationModule],
  controllers: [MfaController],
  providers: [MfaService, RecoveryCodesService],
  exports: [MfaService, RecoveryCodesService],
})
export class MfaModule {}
