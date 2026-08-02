const isProduction = process.env.NODE_ENV === 'production';
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'techfusion-worker';
const ENVIRONMENT = process.env.NODE_ENV || 'development';

export interface WorkerLogContext {
  requestId?: string;
  correlationId?: string;
  queueName?: string;
  jobId?: string;
  jobName?: string;
  duration?: number;
  errorType?: string;
  errorMessage?: string;
  userId?: string;
  orgId?: string;
}

function redactSensitive(value: unknown): unknown {
  if (typeof value === 'string') {
    if (/password|secret|token|authorization|bearer|api[_-]?key/gi.test(value)) {
      return '[REDACTED]';
    }
    return value.length > 500 ? value.slice(0, 500) + '...[TRUNCATED]' : value;
  }
  if (typeof value === 'object' && value !== null) {
    if (Array.isArray(value)) return value.map(redactSensitive);
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (/password|secret|token|authorization|api_key|apikey/i.test(key)) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = redactSensitive(val);
      }
    }
    return result;
  }
  return value;
}

export class WorkerLogger {
  private readonly context: string;

  constructor(context: string) {
    this.context = context;
  }

  private formatEntry(level: string, message: string, extra?: WorkerLogContext): string {
    const entry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      service: SERVICE_NAME,
      environment: ENVIRONMENT,
      message,
      context: this.context,
    };
    if (extra) {
      if (extra.requestId) entry.requestId = extra.requestId;
      if (extra.correlationId) entry.correlationId = extra.correlationId;
      if (extra.queueName) entry.queueName = extra.queueName;
      if (extra.jobId) entry.jobId = extra.jobId;
      if (extra.jobName) entry.jobName = extra.jobName;
      if (extra.duration) entry.duration = extra.duration;
      if (extra.errorType) entry.errorType = extra.errorType;
      if (extra.errorMessage) entry.errorMessage = extra.errorMessage;
      if (extra.orgId) entry.orgId = extra.orgId;
    }

    if (isProduction) {
      return JSON.stringify(redactSensitive(entry));
    }

    const parts = [entry.timestamp, `[${level.toUpperCase()}]`, `[${SERVICE_NAME}]`, `[${this.context}]`];
    if (extra?.requestId) parts.push(`[req:${extra.requestId}]`);
    if (extra?.queueName) parts.push(`[queue:${extra.queueName}]`);
    if (extra?.jobId) parts.push(`[job:${extra.jobId}]`);
    parts.push(message);
    return parts.join(' ');
  }

  log(message: string, extra?: WorkerLogContext): void {
    console.log(this.formatEntry('info', message, extra));
  }

  error(message: string, extra?: WorkerLogContext): void {
    console.error(this.formatEntry('error', message, extra));
  }

  warn(message: string, extra?: WorkerLogContext): void {
    console.warn(this.formatEntry('warn', message, extra));
  }

  debug(message: string, extra?: WorkerLogContext): void {
    if (isProduction && process.env.LOG_LEVEL !== 'debug') return;
    console.debug(this.formatEntry('debug', message, extra));
  }
}

export function createWorkerLogger(context: string): WorkerLogger {
  return new WorkerLogger(context);
}
