import { Controller, Get, Req, Res, HttpStatus } from '@nestjs/common';
import { Public } from './common/public.decorator';
import { Request, Response } from 'express';
import { getMetrics, getMetricsContentType } from './metrics.interceptor';

@Controller()
export class MetricsController {
  @Public()
  @Get('metrics')
  async getMetrics(@Req() req: Request, @Res() res: Response): Promise<void> {
    const metricsToken = process.env.METRICS_AUTH_TOKEN;
    const isProduction = process.env.NODE_ENV === 'production';

    if (metricsToken || isProduction) {
      if (!metricsToken) {
        res.status(HttpStatus.FORBIDDEN).json({ error: 'Forbidden' });
        return;
      }

      const authHeader = req.headers?.authorization;
      const providedToken = authHeader?.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : undefined;

      if (providedToken !== metricsToken) {
        res.status(HttpStatus.FORBIDDEN).json({ error: 'Forbidden' });
        return;
      }
    }

    res.setHeader('Content-Type', getMetricsContentType());
    res.send(await getMetrics());
  }
}
