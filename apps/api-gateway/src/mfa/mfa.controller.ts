import { Controller, Post, Get, Body, Req } from '@nestjs/common';
import { MfaService } from './mfa.service';

@Controller('mfa')
export class MfaController {
  constructor(private mfaService: MfaService) {}

  @Post('enroll')
  async enroll(@Req() req: any) {
    return this.mfaService.enroll(req.user.sub);
  }

  @Post('verify')
  async verify(@Req() req: any, @Body() body: { token: string }) {
    return this.mfaService.verify(req.user.sub, body.token);
  }

  @Get('status')
  async status(@Req() req: any) {
    return this.mfaService.status(req.user.sub);
  }
}
