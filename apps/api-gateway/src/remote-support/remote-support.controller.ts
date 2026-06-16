import { Controller, Get, Post, Req } from '@nestjs/common';
import { RequireFeature } from '../common/plan.decorator';

@Controller('remote-support')
@RequireFeature('remoteSupport')
export class RemoteSupportController {
  @Get('sessions')
  async listSessions(@Req() req: any) {
    return { sessions: [], message: 'Remote support available on Business+ plan' };
  }

  @Post('sessions')
  async createSession(@Req() req: any) {
    return { session: null, message: 'Remote support available on Business+ plan' };
  }
}
