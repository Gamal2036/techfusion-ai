import { Controller, Post, Get, Body, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { MfaService } from './mfa.service';
import { VerifyMfaDto } from './dto/verify-mfa.dto';
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
}
