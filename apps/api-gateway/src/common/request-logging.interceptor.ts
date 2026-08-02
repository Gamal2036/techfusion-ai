import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();
    const start = Date.now();
    const method = request.method;
    const url = request.route?.path || request.url;
    const requestId = (request as any).requestId || '-';
    const correlationId = (request as any).correlationId || '-';

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;
          const statusCode = response.statusCode;
          const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
          const logEntry = {
            requestId,
            correlationId,
            method,
            url,
            statusCode,
            duration,
            userId: (request as any).user?.userId || (request as any).user?.sub,
            orgId: (request as any).user?.orgId,
          };
          if (level === 'error') {
            this.logger.error(`${method} ${url} ${statusCode} ${duration}ms`, JSON.stringify(logEntry));
          } else if (level === 'warn') {
            this.logger.warn(`${method} ${url} ${statusCode} ${duration}ms`, JSON.stringify(logEntry));
          } else {
            this.logger.log(`${method} ${url} ${statusCode} ${duration}ms`);
          }
        },
        error: (err) => {
          const duration = Date.now() - start;
          const statusCode = err?.status || 500;
          this.logger.error(`${method} ${url} ${statusCode} ${duration}ms`, JSON.stringify({
            requestId,
            correlationId,
            method,
            url,
            statusCode,
            duration,
            errorType: err?.name || 'UnknownError',
            errorMessage: err?.message || 'Unknown error',
          }));
        },
      }),
    );
  }
}
