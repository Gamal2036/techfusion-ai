import { LoggerService, Logger } from '@nestjs/common';

const isProduction = process.env.NODE_ENV === 'production';
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'techfusion-api-gateway';
const ENVIRONMENT = process.env.NODE_ENV || 'development';

export interface LogContext {
  requestId?: string;
  correlationId?: string;
  traceId?: string;
  userId?: string;
  orgId?: string;
  deviceId?: string;
  route?: string;
  method?: string;
  statusCode?: number;
  duration?: number;
  operation?: string;
  queueName?: string;
  jobId?: string;
  errorType?: string;
  errorMessage?: string;
  event?: string;
  reason?: string;
  clientOrgId?: string;
  claimedDeviceId?: string;
  scanId?: string;
  alreadyRevoked?: boolean;
}

export interface StructuredLogEntry {
  timestamp: string;
  level: string;
  service: string;
  environment: string;
  message: string;
  context?: string;
  requestId?: string;
  correlationId?: string;
  traceId?: string;
  userId?: string;
  orgId?: string;
  deviceId?: string;
  route?: string;
  method?: string;
  statusCode?: number;
  duration?: number;
  operation?: string;
  queueName?: string;
  jobId?: string;
  errorType?: string;
  errorMessage?: string;
  event?: string;
  reason?: string;
  clientOrgId?: string;
  claimedDeviceId?: string;
  scanId?: string;
  alreadyRevoked?: boolean;
}

const SENSITIVE_PATTERNS = [
  /password/gi,
  /secret/gi,
  /token/gi,
  /authorization/gi,
  /bearer/gi,
  /api[_-]?key/gi,
  /credit[_-]?card/gi,
  /ssn/gi,
];

function redactSensitive(value: unknown): unknown {
  if (typeof value === 'string') {
    let redacted = value;
    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(redacted)) {
        return '[REDACTED]';
      }
    }
    if (redacted.length > 500) {
      return redacted.slice(0, 500) + '...[TRUNCATED]';
    }
    return redacted;
  }
  if (typeof value === 'object' && value !== null) {
    if (Array.isArray(value)) {
      return value.map(redactSensitive);
    }
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('password') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('token') ||
        lowerKey.includes('authorization') ||
        lowerKey.includes('api_key') ||
        lowerKey.includes('apikey')
      ) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = redactSensitive(val);
      }
    }
    return result;
  }
  return value;
}

function formatDevLog(entry: StructuredLogEntry): string {
  const parts = [
    entry.timestamp,
    `[${entry.level.toUpperCase()}]`,
    `[${entry.service}]`,
  ];
  if (entry.context) parts.push(`[${entry.context}]`);
  if (entry.requestId) parts.push(`[req:${entry.requestId}]`);
  if (entry.correlationId) parts.push(`[corr:${entry.correlationId}]`);
  parts.push(entry.message);
  return parts.join(' ');
}

function formatJsonLog(entry: StructuredLogEntry): string {
  return JSON.stringify(redactSensitive(entry));
}

function createLogEntry(level: string, message: string, context?: string, extra?: LogContext): StructuredLogEntry {
  const entry: StructuredLogEntry = {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    service: SERVICE_NAME,
    environment: ENVIRONMENT,
    message,
  };
  if (context) entry.context = context;
  if (extra?.requestId) entry.requestId = extra.requestId;
  if (extra?.correlationId) entry.correlationId = extra.correlationId;
  if (extra?.traceId) entry.traceId = extra.traceId;
  if (extra?.userId) entry.userId = extra.userId;
  if (extra?.orgId) entry.orgId = extra.orgId;
  if (extra?.deviceId) entry.deviceId = extra.deviceId;
  if (extra?.route) entry.route = extra.route;
  if (extra?.method) entry.method = extra.method;
  if (extra?.statusCode) entry.statusCode = extra.statusCode;
  if (extra?.duration) entry.duration = extra.duration;
  if (extra?.operation) entry.operation = extra.operation;
  if (extra?.queueName) entry.queueName = extra.queueName;
  if (extra?.jobId) entry.jobId = extra.jobId;
  if (extra?.errorType) entry.errorType = extra.errorType;
  if (extra?.errorMessage) entry.errorMessage = extra.errorMessage;
  if (extra?.event) entry.event = extra.event;
  if (extra?.reason) entry.reason = extra.reason;
  if (extra?.clientOrgId) entry.clientOrgId = extra.clientOrgId;
  if (extra?.claimedDeviceId) entry.claimedDeviceId = extra.claimedDeviceId;
  if (extra?.scanId) entry.scanId = extra.scanId;
  if (extra?.alreadyRevoked !== undefined) entry.alreadyRevoked = extra.alreadyRevoked;
  return entry;
}

export class StructuredLogger {
  private readonly nestLogger: Logger;
  private readonly context: string;

  constructor(context: string) {
    this.context = context;
    this.nestLogger = new Logger(context);
  }

  private output(level: string, message: string, extra?: LogContext): void {
    const entry = createLogEntry(level, message, this.context, extra);
    if (isProduction) {
      const formatted = formatJsonLog(entry);
      switch (level) {
        case 'error': console.error(formatted); break;
        case 'warn': console.warn(formatted); break;
        case 'debug': console.debug(formatted); break;
        default: console.log(formatted);
      }
    } else {
      switch (level) {
        case 'error': this.nestLogger.error(formatDevLog(entry)); break;
        case 'warn': this.nestLogger.warn(formatDevLog(entry)); break;
        case 'debug': this.nestLogger.debug(formatDevLog(entry)); break;
        default: this.nestLogger.log(formatDevLog(entry));
      }
    }
  }

  log(message: string, extra?: LogContext): void {
    this.output('info', message, extra);
  }

  error(message: string, extra?: LogContext): void {
    this.output('error', message, extra);
  }

  warn(message: string, extra?: LogContext): void {
    this.output('warn', message, extra);
  }

  debug(message: string, extra?: LogContext): void {
    this.output('debug', message, extra);
  }

  verbose(message: string, extra?: LogContext): void {
    this.output('verbose', message, extra);
  }
}

export function createStructuredLogger(context: string): StructuredLogger {
  return new StructuredLogger(context);
}
