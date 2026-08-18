import { Worker, Queue, Job } from 'bullmq';
import { initTelemetry, shutdownTelemetry } from './telemetry';
import { startMetricsServer, trackQueueDepth, trackJobCompleted, trackJobFailed, trackJobDuration, trackJobCounts, trackWorkerHealth, trackWorkerUptime, trackStalledJob, trackWorkerConcurrency, trackProcessorFailure } from './metrics';
import { QUEUE_NAMES, JOB_NAMES, QueueName } from './queue-names';
import { processAlertJob, processReportJob, processBackupJob, processInventoryJob, processSecurityJob, processRetentionJob, processKbEmbeddingJob, processMonitoringJob } from './processors';
import { createWorkerLogger } from './structured-logger';
import { extractCorrelationFromJob, JobCorrelationData } from './correlation';
import { disconnectPrisma } from './prisma-client';
import { loadMailProviderConfig, createSmtpMailProvider, createTestMailProvider, createDisabledMailProvider } from './mail/mail-providers';
import { MailProvider } from './mail/mail-provider.interface';
import { createMailProcessor } from './mail/mail-processor';
import { MailUrlBuilder } from './mail/mail-url-builder';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const API_URL = process.env.TF_API_URL || 'http://localhost:3001';
const HEALTH_PORT = parseInt(process.env.WORKER_HEALTH_PORT || '9465', 10);

const WORKER_CONNECTION = { url: REDIS_URL };

const DEFAULT_WORKER_OPTIONS = {
  connection: WORKER_CONNECTION,
  concurrency: 5,
  lockDuration: 30000,
  stalledInterval: 15000,
};

const logger = createWorkerLogger('Worker');

let isShuttingDown = false;
let workers: Worker[] = [];
let queues: Queue[] = [];
let metricsInterval: ReturnType<typeof setInterval> | null = null;

// ─── Health Server ─────────────────────────────────────────────

function startHealthServer(port: number): void {
  const server = require('http').createServer(async (req: any, res: any) => {
    if (req.url === '/health' && req.method === 'GET') {
      const workerStatus = workers.map((w) => ({
        name: w.name,
        isRunning: w.isRunning(),
        isPaused: w.isPaused(),
      }));

      const allHealthy = workerStatus.every((w) => w.isRunning);
      trackWorkerHealth(allHealthy);

      res.writeHead(allHealthy ? 200 : 503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: allHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        workers: workerStatus,
        memory: {
          rss: process.memoryUsage().rss,
          heapUsed: process.memoryUsage().heapUsed,
        },
      }));
    } else if (req.url === '/health/live' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      }));
    } else if (req.url === '/health/ready' && req.method === 'GET') {
      let redisOk = false;
      try {
        const Redis = require('ioredis');
        const client = new Redis(REDIS_URL, { connectTimeout: 2000, maxRetriesPerRequest: 0 });
        await client.ping();
        client.disconnect();
        redisOk = true;
      } catch {
        redisOk = false;
      }

      const allReady = workers.every((w) => w.isRunning()) && redisOk;
      res.writeHead(allReady ? 200 : 503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ready: allReady, redis: redisOk, workers: workers.every((w) => w.isRunning()) }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(port, '0.0.0.0', () => {
    logger.log(`Health server listening on port ${port}`);
  });
}

// ─── Mail Provider Initialization ───────────────────────────

let mailProvider: MailProvider | null = null;

async function initMailProvider(): Promise<void> {
  const config = loadMailProviderConfig();
  if (!config.enabled) {
    mailProvider = createDisabledMailProvider();
    logger.log('Transactional email is DISABLED in worker.');
    return;
  }

  if (config.transport === 'test') {
    mailProvider = createTestMailProvider();
    logger.log('Transactional email using TEST provider in worker.');
    return;
  }

  try {
    mailProvider = await createSmtpMailProvider({
      ...config.smtp,
      fromAddress: config.fromAddress,
      fromName: config.fromName,
      replyTo: config.replyTo,
    });
    logger.log('Transactional email using SMTP provider in worker.');
  } catch (err: any) {
    logger.error('Failed to initialize SMTP mail provider', {
      errorType: err?.name || 'MailInitError',
      errorMessage: err?.message || String(err),
    });
    mailProvider = createDisabledMailProvider();
  }
}

// ─── Queue Processors Map ──────────────────────────────────────

const QUEUE_PROCESSORS: Record<string, (job: Job) => Promise<any>> = {
  [QUEUE_NAMES.ALERT]: processAlertJob,
  [QUEUE_NAMES.REPORT]: processReportJob,
  [QUEUE_NAMES.BACKUP]: processBackupJob,
  [QUEUE_NAMES.INVENTORY]: processInventoryJob,
  [QUEUE_NAMES.SECURITY]: processSecurityJob,
  [QUEUE_NAMES.RETENTION]: processRetentionJob,
  [QUEUE_NAMES.KB_EMBEDDING]: processKbEmbeddingJob,
  [QUEUE_NAMES.MONITORING]: processMonitoringJob,
};

// ─── Worker Factory ────────────────────────────────────────────

function createWorker(queueName: string): Worker {
  const processor = QUEUE_PROCESSORS[queueName];
  if (!processor) {
    throw new Error(`No processor registered for queue "${queueName}"`);
  }

  const worker = new Worker(queueName, processor, {
    ...DEFAULT_WORKER_OPTIONS,
    autorun: true,
  });

  trackWorkerConcurrency(queueName, DEFAULT_WORKER_OPTIONS.concurrency);

  worker.on('ready', () => {
    logger.log('Worker ready and connected to Redis', { queueName });
  });

  worker.on('error', (err) => {
    logger.error('Worker error', {
      queueName,
      errorType: err.name || 'WorkerError',
      errorMessage: err.message,
    });
    trackJobFailed(queueName, err.message);
    trackProcessorFailure(queueName);
  });

  worker.on('failed', (job, err) => {
    const correlation = job?.data ? extractCorrelationFromJob(job.data as Record<string, unknown>) : undefined;
    logger.error('Job failed', {
      queueName,
      jobId: job?.id?.toString(),
      jobName: job?.name,
      errorType: err.name || 'JobError',
      errorMessage: err.message,
      requestId: correlation?.requestId,
      correlationId: correlation?.correlationId,
    });
    trackJobFailed(queueName, err.message);
  });

  worker.on('completed', (job, result) => {
    const correlation = job.data ? extractCorrelationFromJob(job.data as Record<string, unknown>) : undefined;
    logger.log('Job completed', {
      queueName,
      jobId: job.id?.toString(),
      jobName: job.name,
      requestId: correlation?.requestId,
      correlationId: correlation?.correlationId,
    });
    trackJobCompleted(queueName);
  });

  worker.on('stalled', (jobId) => {
    logger.warn('Job stalled', { queueName, jobId: jobId?.toString() });
    trackStalledJob(queueName);
  });

  return worker;
}

// ─── Main ──────────────────────────────────────────────────────

async function main() {
  logger.log('Starting TechFusion AI Worker...');
  const redisHost = REDIS_URL.includes('@') ? REDIS_URL.split('@')[1]?.split(':')[0] || 'configured' : REDIS_URL.split('://')[1]?.split(':')[0] || 'configured';
  logger.log(`Redis host: ${redisHost}`);
  logger.log(`API URL: ${API_URL}`);

  await initTelemetry();
  startMetricsServer(9464);
  startHealthServer(HEALTH_PORT);

  // Initialize mail provider
  await initMailProvider();

  // Register mail processor if mail is enabled
  if (mailProvider && mailProvider.isReady()) {
    const mailConfig = loadMailProviderConfig();
    const mailUrlBuilder = new MailUrlBuilder(process.env.WEB_APP_URL || process.env.PUBLIC_WEB_URL || 'http://localhost:3000');
    const mailDecryptPayload = (encrypted: string) => {
      try {
        const JSON5 = require('json5');
        return JSON5.parse(encrypted);
      } catch {
        return JSON.parse(encrypted);
      }
    };
    const mailProcessor = createMailProcessor(mailProvider, mailDecryptPayload, mailUrlBuilder);
    QUEUE_PROCESSORS[QUEUE_NAMES.TRANSACTIONAL_EMAIL] = mailProcessor;
    logger.log('Transactional email processor registered');
  } else {
    // Register a stub processor that rejects jobs when mail is disabled
    QUEUE_PROCESSORS[QUEUE_NAMES.TRANSACTIONAL_EMAIL] = async (job: Job) => {
      logger.warn('Received transactional email job but mail is disabled', {
        queueName: QUEUE_NAMES.TRANSACTIONAL_EMAIL,
        jobId: job.id?.toString(),
      });
      throw new Error('Transactional email is not enabled');
    };
    logger.log('Transactional email processor registered (disabled stub)');
  }

  const queueNames = Object.values(QUEUE_NAMES);
  logger.log(`Registering ${queueNames.length} queues: ${queueNames.join(', ')}`);

  for (const queueName of queueNames) {
    try {
      const worker = createWorker(queueName);
      workers.push(worker);
      logger.log(`Queue "${queueName}" worker created`);
    } catch (err: any) {
      logger.error(`Failed to create worker for "${queueName}"`, {
        errorType: err?.name || 'StartupError',
        errorMessage: err?.message || String(err),
      });
    }
  }

  for (const queueName of queueNames) {
    const queue = new Queue(queueName, { connection: WORKER_CONNECTION });
    queues.push(queue);
  }

  metricsInterval = setInterval(async () => {
    trackWorkerUptime();
    for (const queue of queues) {
      try {
        const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed');
        const depth = (counts.waiting || 0) + (counts.delayed || 0);
        trackQueueDepth(queue.name, depth);
        trackJobCounts(queue.name, counts.waiting || 0, counts.active || 0, counts.delayed || 0);

        if (counts.waiting && counts.waiting > 0) {
          const jobs = await queue.getJobs(['waiting'], 0, 0);
          if (jobs.length > 0 && jobs[0].timestamp) {
            const ageSeconds = (Date.now() - jobs[0].timestamp) / 1000;
            const { trackOldestWaitingAge } = await import('./metrics');
            trackOldestWaitingAge(queue.name, ageSeconds);
          }
        }
      } catch (err) {
        logger.error(`Failed to get queue stats for "${queue.name}"`, {
          queueName: queue.name,
          errorType: err instanceof Error ? err.name : 'QueueStatsError',
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }, 15000);

  logger.log(`All ${workers.length} workers started successfully`);
  logger.log(`Health endpoint: http://0.0.0.0:${HEALTH_PORT}/health`);
  logger.log(`Metrics endpoint: http://0.0.0.0:9464/metrics`);
}

// ─── Graceful Shutdown ─────────────────────────────────────────

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) {
    logger.log(`Shutdown already in progress, ignoring ${signal}`);
    return;
  }

  isShuttingDown = true;
  logger.log(`Received ${signal}, starting graceful shutdown...`);

  if (metricsInterval) {
    clearInterval(metricsInterval);
    metricsInterval = null;
  }

  const closePromises: Promise<void>[] = [];
  for (const worker of workers) {
    closePromises.push(
      worker.close().then(() => {
        logger.log(`Worker "${worker.name}" closed`);
      }),
    );
  }

  for (const queue of queues) {
    closePromises.push(
      queue.close().then(() => {
        logger.log(`Queue "${queue.name}" closed`);
      }),
    );
  }

  await Promise.all(closePromises);

  await disconnectPrisma();
  await shutdownTelemetry();
  logger.log('Graceful shutdown complete');
  process.exit(0);
}

// ─── Entry Point ───────────────────────────────────────────────

main().catch(async (err) => {
  logger.error('Fatal startup error', {
    errorType: err?.name || 'FatalError',
    errorMessage: err?.message || String(err),
  });
  await disconnectPrisma();
  await shutdownTelemetry();
  process.exit(1);
});

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', {
    errorType: err.name || 'UncaughtException',
    errorMessage: err.message,
  });
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', {
    errorType: 'UnhandledRejection',
    errorMessage: reason instanceof Error ? reason.message : String(reason),
  });
});
