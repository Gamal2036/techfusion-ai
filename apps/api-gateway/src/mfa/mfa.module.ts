import { Module } from '@nestjs/common';
import { MfaController } from './mfa.controller';
import { MfaService } from './mfa.service';
import { EncryptionModule } from '../encryption/encryption.module';

@Module({
  imports: [EncryptionModule],
  controllers: [MfaController],
  providers: [MfaService],
  exports: [MfaService],
})
export class MfaModule {}
