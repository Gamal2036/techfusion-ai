import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Counter, Histogram, Gauge, Registry } from 'prom-client';

const register = new Registry();

// --- Metrics output cache (regenerate every 5s, not on every scrape) ---
let cachedMetrics: string | null = null;
let cachedMetricsTime = 0;
const METRICS_CACHE_TTL_MS = 5000;

// --- Route label normalization to prevent high cardinality ---
const ROUTE_PATTERN_MAP: Array<[RegExp, string]> = [
  [/\/kb\/articles\/[^/]+/, '/kb/articles/:id'],
  [/\/devices\/[^/]+\/metrics/, '/devices/:id/metrics'],
  [/\/devices\/[^/]+/, '/devices/:id'],
  [/\/alerts\/rules\/[^/]+/, '/alerts/rules/:id'],
  [/\/alerts\/[^/]+/, '/alerts/:id'],
  [/\/reports\/[^/]+/, '/reports/:id'],
  [/\/audit\/logs\/[^/]+/, '/audit/logs/:id'],
  [/\/admin\/[^/]+/, '/admin/:id'],
  [/\/billing\/[^/]+/, '/billing/:id'],
  [/\/remote-support\/sessions\/[^/]+/, '/remote-support/sessions/:id'],
  [/\/security\/[^/]+/, '/security/:id'],
  [/\/inventory\/[^/]+/, '/inventory/:id'],
  [/\/network\/[^/]+/, '/network/:id'],
  [/\/ai\/[^/]+/, '/ai/:id'],
  [/\/mfa\/[^/]+/, '/mfa/:id'],
  [/\/sso\/[^/]+/, '/sso/:id'],
  [/\/encryption\/[^/]+/, '/encryption/:id'],
  [/\/retention\/[^/]+/, '/retention/:id'],
  [/\/backups\/[^/]+/, '/backups/:id'],
  [/\/auth\/[^/]+/, '/auth/:id'],
];

function normalizeRoute(raw: string): string {
  for (const [pattern, replacement] of ROUTE_PATTERN_MAP) {
    if (pattern.test(raw)) return replacement;
  }
  return raw;
}

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

const activeRequests = new Gauge({
  name: 'http_active_requests',
  help: 'Number of active HTTP requests',
  labelNames: ['service'],
  registers: [register],
});

const authenticationFailures = new Counter({
  name: 'authentication_failures_total',
  help: 'Total authentication failures',
  labelNames: ['reason', 'service'],
  registers: [register],
});

const rateLimitRejections = new Counter({
  name: 'rate_limit_rejections_total',
  help: 'Total rate limit rejections',
  labelNames: ['service'],
  registers: [register],
});

const validationFailures = new Counter({
  name: 'validation_failures_total',
  help: 'Total validation failures',
  labelNames: ['service'],
  registers: [register],
});

const deviceRegistrationOutcomes = new Counter({
  name: 'device_registration_outcomes_total',
  help: 'Device registration outcomes',
  labelNames: ['outcome', 'service'],
  registers: [register],
});

const metricsIngestionOutcomes = new Counter({
  name: 'metrics_ingestion_outcomes_total',
  help: 'Metrics ingestion outcomes',
  labelNames: ['outcome', 'service'],
  registers: [register],
});

const inventoryIngestionOutcomes = new Counter({
  name: 'inventory_ingestion_outcomes_total',
  help: 'Inventory ingestion outcomes',
  labelNames: ['outcome', 'service'],
  registers: [register],
});

const securityReportOutcomes = new Counter({
  name: 'security_report_outcomes_total',
  help: 'Security report outcomes',
  labelNames: ['outcome', 'service'],
  registers: [register],
});

const alertCreationCount = new Counter({
  name: 'alert_creation_total',
  help: 'Total alerts created',
  labelNames: ['severity', 'service'],
  registers: [register],
});

const internalErrorCount = new Counter({
  name: 'internal_errors_total',
  help: 'Total internal errors (5xx)',
  labelNames: ['service'],
  registers: [register],
});

const websocketConnections = new Gauge({
  name: 'websocket_connections',
  help: 'Current WebSocket connections',
  labelNames: ['namespace', 'service'],
  registers: [register],
});

const websocketDisconnections = new Counter({
  name: 'websocket_disconnections_total',
  help: 'Total WebSocket disconnections',
  labelNames: ['namespace', 'reason', 'service'],
  registers: [register],
});

const websocketAuthFailures = new Counter({
  name: 'websocket_auth_failures_total',
  help: 'Total WebSocket authentication failures',
  labelNames: ['namespace', 'service'],
  registers: [register],
});

const remoteSupportSessions = new Gauge({
  name: 'remote_support_active_sessions',
  help: 'Active remote support sessions',
  labelNames: ['service'],
  registers: [register],
});

const remoteSupportCreated = new Counter({
  name: 'remote_support_sessions_created_total',
  help: 'Total remote support sessions created',
  labelNames: ['service'],
  registers: [register],
});

const remoteSupportConsentOutcomes = new Counter({
  name: 'remote_support_consent_outcomes_total',
  help: 'Remote support consent outcomes',
  labelNames: ['outcome', 'service'],
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

export function trackAuthFailure(reason: string): void {
  authenticationFailures.labels(reason, process.env.OTEL_SERVICE_NAME || 'techfusion-api-gateway').inc();
}

export function trackRateLimitRejection(): void {
  rateLimitRejections.labels(process.env.OTEL_SERVICE_NAME || 'techfusion-api-gateway').inc();
}

export function trackValidationFailure(): void {
  validationFailures.labels(process.env.OTEL_SERVICE_NAME || 'techfusion-api-gateway').inc();
}

export function trackDeviceRegistration(outcome: string): void {
  deviceRegistrationOutcomes.labels(outcome, process.env.OTEL_SERVICE_NAME || 'techfusion-api-gateway').inc();
}

export function trackMetricsIngestion(outcome: string): void {
  metricsIngestionOutcomes.labels(outcome, process.env.OTEL_SERVICE_NAME || 'techfusion-api-gateway').inc();
}

export function trackInventoryIngestion(outcome: string): void {
  inventoryIngestionOutcomes.labels(outcome, process.env.OTEL_SERVICE_NAME || 'techfusion-api-gateway').inc();
}

export function trackSecurityReport(outcome: string): void {
  securityReportOutcomes.labels(outcome, process.env.OTEL_SERVICE_NAME || 'techfusion-api-gateway').inc();
}

export function trackAlertCreation(severity: string): void {
  alertCreationCount.labels(severity, process.env.OTEL_SERVICE_NAME || 'techfusion-api-gateway').inc();
}

export function trackInternalError(): void {
  internalErrorCount.labels(process.env.OTEL_SERVICE_NAME || 'techfusion-api-gateway').inc();
}

export function trackWsConnection(namespace: string): void {
  websocketConnections.labels(namespace, process.env.OTEL_SERVICE_NAME || 'techfusion-api-gateway').inc();
}

export function trackWsDisconnection(namespace: string, reason: string): void {
  websocketConnections.labels(namespace, process.env.OTEL_SERVICE_NAME || 'techfusion-api-gateway').dec();
  websocketDisconnections.labels(namespace, reason, process.env.OTEL_SERVICE_NAME || 'techfusion-api-gateway').inc();
}

export function trackWsAuthFailure(namespace: string): void {
  websocketAuthFailures.labels(namespace, process.env.OTEL_SERVICE_NAME || 'techfusion-api-gateway').inc();
}

export function trackRemoteSupportSession(): void {
  remoteSupportSessions.labels(process.env.OTEL_SERVICE_NAME || 'techfusion-api-gateway').inc();
}

export function trackRemoteSupportSessionEnd(): void {
  remoteSupportSessions.labels(process.env.OTEL_SERVICE_NAME || 'techfusion-api-gateway').dec();
}

export function trackRemoteSupportCreated(): void {
  remoteSupportCreated.labels(process.env.OTEL_SERVICE_NAME || 'techfusion-api-gateway').inc();
}

export function trackRemoteSupportConsent(outcome: string): void {
  remoteSupportConsentOutcomes.labels(outcome, process.env.OTEL_SERVICE_NAME || 'techfusion-api-gateway').inc();
}

const dbConnectionAttempts = new Counter({
  name: 'db_connection_attempts_total',
  help: 'PostgreSQL connection attempts',
  labelNames: ['outcome', 'service'],
  registers: [register],
});

const dbQueryErrors = new Counter({
  name: 'db_query_errors_total',
  help: 'Database query errors',
  labelNames: ['service'],
  registers: [register],
});

const redisConnectionAttempts = new Counter({
  name: 'redis_connection_attempts_total',
  help: 'Redis connection attempts',
  labelNames: ['outcome', 'service'],
  registers: [register],
});

const redisCommandFailures = new Counter({
  name: 'redis_command_failures_total',
  help: 'Redis command failures',
  labelNames: ['service'],
  registers: [register],
});

export function trackDbConnection(outcome: string): void {
  dbConnectionAttempts.labels(outcome, process.env.OTEL_SERVICE_NAME || 'techfusion-api-gateway').inc();
}

export function trackDbQueryError(): void {
  dbQueryErrors.labels(process.env.OTEL_SERVICE_NAME || 'techfusion-api-gateway').inc();
}

export function trackRedisConnection(outcome: string): void {
  redisConnectionAttempts.labels(outcome, process.env.OTEL_SERVICE_NAME || 'techfusion-api-gateway').inc();
}

export function trackRedisCommandFailure(): void {
  redisCommandFailures.labels(process.env.OTEL_SERVICE_NAME || 'techfusion-api-gateway').inc();
}

export function getMetricsContentType(): string {
  return register.contentType;
}

export async function getMetrics(): Promise<string> {
  const now = Date.now();
  if (cachedMetrics && (now - cachedMetricsTime) < METRICS_CACHE_TTL_MS) {
    return cachedMetrics;
  }
  cachedMetrics = await register.metrics();
  cachedMetricsTime = now;
  return cachedMetrics;
}

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  private readonly service: string = process.env.OTEL_SERVICE_NAME || 'techfusion-api-gateway';

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const method = request.method || 'UNKNOWN';
    const rawRoute = request.route?.path || request.url || 'unknown';
    const route = normalizeRoute(rawRoute);
    const start = Date.now();

    activeRequests.labels(this.service).inc();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const statusCode = response.statusCode?.toString() || '200';
          const duration = (Date.now() - start) / 1000;

          activeRequests.labels(this.service).dec();
          httpRequestDuration.labels(method, route, statusCode, this.service).observe(duration);
          httpRequestsTotal.labels(method, route, statusCode, this.service).inc();
          httpRequestsPerSecond.labels(this.service).observe(1);

          if (parseInt(statusCode) >= 500) {
            internalErrorCount.labels(this.service).inc();
          }
        },
        error: (error) => {
          const statusCode = error?.status?.toString() || '500';
          const duration = (Date.now() - start) / 1000;

          activeRequests.labels(this.service).dec();
          httpRequestDuration.labels(method, route, statusCode, this.service).observe(duration);
          httpRequestsTotal.labels(method, route, statusCode, this.service).inc();

          if (parseInt(statusCode) >= 500) {
            internalErrorCount.labels(this.service).inc();
          }
        },
      }),
    );
  }
}

export {
  register,
  httpRequestDuration,
  httpRequestsTotal,
  activeRequests,
  authenticationFailures,
  rateLimitRejections,
  validationFailures,
  deviceRegistrationOutcomes,
  metricsIngestionOutcomes,
  inventoryIngestionOutcomes,
  securityReportOutcomes,
  alertCreationCount,
  internalErrorCount,
  websocketConnections,
  websocketDisconnections,
  websocketAuthFailures,
  remoteSupportSessions,
  remoteSupportCreated,
  remoteSupportConsentOutcomes,
  aiProviderCostUsd,
  aiProviderLatencyMs,
  aiTokensTotal,
  aiRequestsTotal,
  dbConnectionAttempts,
  dbQueryErrors,
  redisConnectionAttempts,
  redisCommandFailures,
};
