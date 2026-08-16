import { Controller, Post, Get, Body, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { MfaService } from './mfa.service';
import { VerifyMfaDto } from './dto/verify-mfa.dto';
import { DisableMfaDto } from './dto/disable-mfa.dto';
import { RecoveryCodesChallengeDto } from './dto/recovery-codes-challenge.dto';
import { mfaThrottle } from '../config/rate-limits';

@Controller('mfa')
export class MfaController {
  constructor(private mfaService: MfaService) {}

  @Post('enroll')
  @Throttle(mfaThrottle())
  async enroll(@Req() req: any) {
    return this.mfaService.enroll(req.user.sub);
  }

  @Post('verify')
  @Throttle(mfaThrottle())
  async verify(@Req() req: any, @Body() body: VerifyMfaDto) {
    return this.mfaService.verify(req.user.sub, body.token);
  }

  @Get('status')
  async status(@Req() req: any) {
    return this.mfaService.status(req.user.sub);
  }

  // ACC-SEC-02B2 — MFA lifecycle completion.

  @Post('disable')
  @Throttle(mfaThrottle())
  async disable(@Req() req: any, @Body() body: DisableMfaDto) {
    return this.mfaService.disable(req.user.sub, body.password, body.token, body.recoveryCode);
  }

  @Post('recovery-codes/generate')
  @Throttle(mfaThrottle())
  async generateRecoveryCodes(@Req() req: any, @Body() body: RecoveryCodesChallengeDto) {
    return this.mfaService.generateRecoveryCodes(req.user.sub, body.password, body.token);
  }

  @Post('recovery-codes/regenerate')
  @Throttle(mfaThrottle())
  async regenerateRecoveryCodes(@Req() req: any, @Body() body: RecoveryCodesChallengeDto) {
    return this.mfaService.regenerateRecoveryCodes(req.user.sub, body.password, body.token);
  }

  @Get('recovery-codes/status')
  async recoveryCodesStatus(@Req() req: any) {
    return this.mfaService.recoveryCodesStatus(req.user.sub);
  }
}
