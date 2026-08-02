import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import express from 'express';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { validateEnvironment } from './config/env.validation';
import { getSecurityHeaders } from './config/security-headers';
import { initTelemetry, shutdownTelemetry } from './telemetry';
import { CorrelationIdInterceptor } from './common/correlation-id';
import { RequestLoggingInterceptor } from './common/request-logging.interceptor';
import { createStructuredLogger } from './common/structured-logger';

const logger = createStructuredLogger('Bootstrap');

async function bootstrap() {
  validateEnvironment();
  await initTelemetry();

  const app = await NestFactory.create(AppModule, { rawBody: true, bodyParser: false });
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.use(helmet(getSecurityHeaders()));

  app.useGlobalInterceptors(
    new CorrelationIdInterceptor(),
    new RequestLoggingInterceptor(),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) || ['http://localhost:3000'];
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Org-Id', 'X-Device-Token', 'X-Request-Id', 'X-Correlation-Id'],
    exposedHeaders: ['Content-Disposition', 'X-Request-Id', 'X-Correlation-Id'],
    maxAge: 86400,
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: false,
    transformOptions: { enableImplicitConversion: true },
  }));

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(`API Gateway listening on port ${port}`);
}

bootstrap().catch(async (err) => {
  logger.error('Failed to start API Gateway', {
    errorType: err?.name || 'StartupError',
    errorMessage: err?.message || String(err),
  });
  await shutdownTelemetry();
  process.exit(1);
});

process.on('SIGTERM', async () => {
  logger.log('Received SIGTERM, shutting down...');
  await shutdownTelemetry();
  process.exit(0);
});
