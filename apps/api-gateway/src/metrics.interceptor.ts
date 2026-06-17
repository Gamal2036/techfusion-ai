import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Counter, Histogram, Registry } from 'prom-client';

const register = new Registry();

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code', 'service'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
  registers: [register],
});

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'service'],
  registers: [register],
});

const aiProviderCostUsd = new Counter({
  name: 'ai_provider_cost_usd_total',
  help: 'Total AI provider cost in USD',
  labelNames: ['provider', 'model', 'org_id'],
  registers: [register],
});

const aiProviderLatencyMs = new Histogram({
  name: 'ai_provider_latency_ms',
  help: 'AI provider request latency in milliseconds',
  labelNames: ['provider', 'model'],
  buckets: [100, 250, 500, 1000, 2000, 5000, 10000, 30000],
  registers: [register],
});

const aiTokensTotal = new Counter({
  name: 'ai_tokens_total',
  help: 'Total AI tokens used',
  labelNames: ['provider', 'model', 'type'],
  registers: [register],
});

const aiRequestsTotal = new Counter({
  name: 'ai_requests_total',
  help: 'Total AI requests',
  labelNames: ['provider', 'model', 'status'],
  registers: [register],
});

const httpRequestsPerSecond = new Histogram({
  name: 'http_requests_per_second',
  help: 'HTTP requests per second (sliding window)',
  labelNames: ['service'],
  buckets: [10, 50, 100, 200, 500, 1000],
  registers: [register],
});

export function trackAiCost(provider: string, model: string, orgId: string, costUsd: number): void {
  aiProviderCostUsd.labels(provider, model, orgId).inc(costUsd);
}

export function trackAiLatency(provider: string, model: string, latencyMs: number): void {
  aiProviderLatencyMs.labels(provider, model).observe(latencyMs);
}

export function trackAiTokens(provider: string, model: string, type: string, count: number): void {
  aiTokensTotal.labels(provider, model, type).inc(count);
}

export function trackAiRequest(provider: string, model: string, status: string): void {
  aiRequestsTotal.labels(provider, model, status).inc();
}

export function getMetricsContentType(): string {
  return register.contentType;
}

export async function getMetrics(): Promise<string> {
  return register.metrics();
}

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  private readonly service: string = process.env.OTEL_SERVICE_NAME || 'techfusion-api-gateway';

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const method = request.method || 'UNKNOWN';
    const route = request.route?.path || request.url || 'unknown';
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const statusCode = response.statusCode?.toString() || '200';
          const duration = (Date.now() - start) / 1000;

          httpRequestDuration.labels(method, route, statusCode, this.service).observe(duration);
          httpRequestsTotal.labels(method, route, statusCode, this.service).inc();
          httpRequestsPerSecond.labels(this.service).observe(1);
        },
        error: (error) => {
          const statusCode = error?.status?.toString() || '500';
          const duration = (Date.now() - start) / 1000;

          httpRequestDuration.labels(method, route, statusCode, this.service).observe(duration);
          httpRequestsTotal.labels(method, route, statusCode, this.service).inc();
        },
      }),
    );
  }
}

export { register, httpRequestDuration, httpRequestsTotal, aiProviderCostUsd, aiProviderLatencyMs, aiTokensTotal, aiRequestsTotal };
