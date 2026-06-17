import { Controller, Get, Res } from '@nestjs/common';
import { Public } from './common/public.decorator';
import { Response } from 'express';
import { getMetrics, getMetricsContentType } from './metrics.interceptor';

@Controller()
export class MetricsController {
  @Public()
  @Get('metrics')
  async getMetrics(@Res() res: Response): Promise<void> {
    res.setHeader('Content-Type', getMetricsContentType());
    res.send(await getMetrics());
  }
}
