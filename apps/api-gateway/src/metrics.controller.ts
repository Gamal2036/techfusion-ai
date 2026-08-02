import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { Public } from './common/public.decorator';
import { Response } from 'express';
import { getMetrics, getMetricsContentType } from './metrics.interceptor';

const METRICS_TOKEN = process.env.METRICS_AUTH_TOKEN;

@Controller()
export class MetricsController {
  @Public()
  @Get('metrics')
  async getMetrics(@Res() res: Response): Promise<void> {
    if (METRICS_TOKEN) {
      const authHeader = res.req?.headers?.authorization;
      const tokenFromQuery = res.req?.query?.token;
      const providedToken = authHeader?.startsWith('Bearer ')
        ? authHeader.slice(7)
        : typeof tokenFromQuery === 'string'
          ? tokenFromQuery
          : undefined;

      if (providedToken !== METRICS_TOKEN) {
        res.status(HttpStatus.FORBIDDEN).json({ error: 'Forbidden' });
        return;
      }
    }

    res.setHeader('Content-Type', getMetricsContentType());
    res.send(await getMetrics());
  }
}
