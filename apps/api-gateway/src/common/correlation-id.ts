import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';

export interface CorrelationContext {
  requestId: string;
  correlationId: string;
  traceId?: string;
  userId?: string;
  orgId?: string;
}

const correlationStorage = new AsyncLocalStorage<CorrelationContext>();

export function getCorrelationContext(): CorrelationContext | undefined {
  return correlationStorage.getStore();
}

export function getRequestId(): string | undefined {
  return correlationStorage.getStore()?.requestId;
}

export function getCorrelationId(): string | undefined {
  return correlationStorage.getStore()?.correlationId;
}

const MAX_REQUEST_ID_LENGTH = 128;
const UUID_REGEX = /^[a-zA-Z0-9\-_]+$/;

function sanitizeIncomingId(raw: string | undefined | null): string | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_REQUEST_ID_LENGTH) return undefined;
  if (!UUID_REGEX.test(trimmed)) return undefined;
  return trimmed;
}

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CorrelationIdInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();

    const incomingRequestId = sanitizeIncomingId(
      request.headers['x-request-id'] as string | undefined,
    );
    const incomingCorrelationId = sanitizeIncomingId(
      request.headers['x-correlation-id'] as string | undefined,
    );

    const requestId = incomingRequestId || randomUUID();
    const correlationId = incomingCorrelationId || requestId;

    response.setHeader('X-Request-Id', requestId);
    response.setHeader('X-Correlation-Id', correlationId);

    (request as any).requestId = requestId;
    (request as any).correlationId = correlationId;

    const store: CorrelationContext = {
      requestId,
      correlationId,
      userId: (request as any).user?.userId || (request as any).user?.sub,
      orgId: (request as any).user?.orgId,
    };

    return correlationStorage.run(store, () => {
      return next.handle().pipe(
        tap({
          next: () => {},
          error: (err) => {
            this.logger.debug(
              `Request ${requestId} completed with error`,
              { requestId, correlationId, error: err?.message },
            );
          },
        }),
      );
    });
  }
}

export function generateJobCorrelationId(parentCorrelationId?: string): string {
  if (parentCorrelationId) {
    return `${parentCorrelationId}.${randomUUID().slice(0, 8)}`;
  }
  return randomUUID();
}
