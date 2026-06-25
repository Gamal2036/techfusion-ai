import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import { initTelemetry, shutdownTelemetry } from './telemetry';

async function bootstrap() {
  await initTelemetry();

  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`API Gateway listening on port ${port}`);
}

bootstrap().catch(async (err) => {
  console.error('Failed to start API Gateway:', err);
  await shutdownTelemetry();
  process.exit(1);
});

process.on('SIGTERM', async () => {
  await shutdownTelemetry();
  process.exit(0);
});
