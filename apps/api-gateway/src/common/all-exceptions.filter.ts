import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { createStructuredLogger, StructuredLogger } from './structured-logger';
import { getRequestId, getCorrelationId } from './correlation-id';
import { trackInternalError } from '../metrics.interceptor';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger: StructuredLogger = createStructuredLogger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const isProduction = process.env.NODE_ENV === 'production';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let errorName = 'InternalServerError';
    let code: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse();
      if (typeof exResponse === 'string') {
        message = exResponse;
      } else if (typeof exResponse === 'object' && exResponse !== null) {
        const obj = exResponse as Record<string, any>;
        message = obj.message || exception.message;
        errorName = obj.error || exception.name;
        code = obj.code;
      }
    }

    if (isProduction && status >= 500) {
      message = 'Internal server error';
      errorName = 'InternalServerError';
    }

    const requestId = getRequestId() || (request as any).requestId || '-';
    const correlationId = getCorrelationId() || (request as any).correlationId || '-';

    if (status >= 500) {
      trackInternalError();
      this.logger.error(`${request.method} ${request.url} ${status}`, {
        requestId,
        correlationId,
        method: request.method,
        route: request.url,
        statusCode: status,
        errorType: errorName,
        errorMessage: exception instanceof Error ? exception.message : String(exception),
      });
    } else {
      this.logger.warn(`${request.method} ${request.url} ${status}`, {
        requestId,
        correlationId,
        method: request.method,
        route: request.url,
        statusCode: status,
        errorType: errorName,
        errorMessage: Array.isArray(message) ? message.join(', ') : message,
      });
    }

    const responseBody: Record<string, any> = {
      statusCode: status,
      error: errorName,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId,
      correlationId,
    };

    if (code) {
      responseBody.code = code;
    }

    response.status(status).json(responseBody);
  }
}
