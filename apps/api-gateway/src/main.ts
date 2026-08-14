import 'dotenv/config';
import * as nodeCrypto from 'node:crypto';
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

if (typeof globalThis.crypto === 'undefined') {
  Object.defineProperty(globalThis, 'crypto', {
    value: nodeCrypto,
    writable: true,
    configurable: true,
  });
}

const logger = createStructuredLogger('Bootstrap');

async function bootstrap() {
  console.log('[BOOT_STEP_1] Bootstrap started');
  validateEnvironment();
  await initTelemetry();

  console.log('[BOOT_STEP_2] Creating Nest application');

const app = await NestFactory.create(AppModule);

console.log('[BOOT_STEP_3] Nest application created');
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

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, "0.0.0");
  logger.log(`API Gateway listening on port ${port}`);
}

bootstrap().catch(async (err: any) => {
  const errorType = err?.name ?? 'StartupError';
  const errorCode = err?.code ?? err?.cause?.code ?? 'UNKNOWN_ERROR';

  let safeMessage = String(err?.message ?? 'No error message');

  // إزالة أي قيم سرية قد تجعل Railway تخفي السجل بالكامل
  for (const [key, value] of Object.entries(process.env)) {
    if (
      value &&
      value.length >= 4 &&
      /(URL|SECRET|TOKEN|PASSWORD|KEY)/i.test(key)
    ) {
      safeMessage = safeMessage.split(value).join(`[${key}_HIDDEN]`);
    }
  }

  safeMessage = safeMessage
    .replace(
      /(?:postgres(?:ql)?|redis(?:s)?):\/\/[^\s]+/gi,
      '[CONNECTION_URL_HIDDEN]',
    )
    .replace(
      /(password|passwd|token|secret)=([^&\s]+)/gi,
      '$1=[HIDDEN]',
    );

  console.error('[BOOT_ERROR]', {
    errorType,
    errorCode,
    message: safeMessage,
    causeName: err?.cause?.name ?? null,
    causeCode: err?.cause?.code ?? null,
  });

  await shutdownTelemetry();
  process.exit(1);
});

process.on('SIGTERM', async () => {
  logger.log('Received SIGTERM, shutting down...');
  await shutdownTelemetry();
  process.exit(0);
});
