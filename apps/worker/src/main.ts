import { Worker, Queue } from 'bullmq';
import { initTelemetry, shutdownTelemetry } from './telemetry';
import { startMetricsServer, trackQueueDepth, trackJobCompleted, trackJobFailed, trackJobDuration } from './metrics';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const API_URL = process.env.TF_API_URL || 'http://localhost:3001';

async function sendNotification(jobData: any) {
  const { alert, rule, deviceName } = jobData;

  console.log(`[ALERT] ${alert.severity.toUpperCase()}: ${alert.message}`);

  // Email notification (placeholder - logs to console)
  console.log(`[EMAIL] To: admin@${organizationDomain()} Subject: Alert - ${rule.name}`);
  console.log(`[EMAIL] Body: ${alert.message}`);

  // Webhook notification
  if (rule.webhookUrl) {
    try {
      const response = await fetch(rule.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'alert',
          alert,
          deviceName,
          timestamp: new Date().toISOString(),
        }),
      });
      if (!response.ok) {
        console.warn(`[WEBHOOK] ${rule.webhookUrl} returned ${response.status}`);
      } else {
        console.log(`[WEBHOOK] Sent to ${rule.webhookUrl}`);
      }
    } catch (err) {
      console.error(`[WEBHOOK] Failed: ${err}`);
    }
  }
}

function organizationDomain(): string {
  return 'techfusion.ai';
}

async function main() {
  await initTelemetry();
  startMetricsServer(9464);

  const alertWorker = new Worker(
    'alert',
    async (job) => {
      const start = Date.now();
      console.log(`Processing alert job ${job.id}`);
      try {
        await sendNotification(job.data);
        trackJobCompleted('alert');
        trackJobDuration('alert', job.name || 'notification', (Date.now() - start) / 1000);
      } catch (err) {
        trackJobFailed('alert', String(err));
        throw err;
      }
    },
    { connection: { url: REDIS_URL } },
  );

  // Also keep default queue worker for other tasks
  const defaultWorker = new Worker(
    'default',
    async (job) => {
      const start = Date.now();
      console.log(`Processing job ${job.id}: ${job.name}`);
      try {
        trackJobCompleted('default');
        trackJobDuration('default', job.name || 'generic', (Date.now() - start) / 1000);
      } catch (err) {
        trackJobFailed('default', String(err));
        throw err;
      }
    },
    { connection: { url: REDIS_URL } },
  );

  alertWorker.on('ready', () => {
    console.log('Alert worker ready');
  });

  alertWorker.on('error', (err) => {
    console.error('Alert worker error:', err);
    trackJobFailed('alert', err.message);
  });

  defaultWorker.on('ready', () => {
    console.log('Default worker ready');
  });

  defaultWorker.on('error', (err) => {
    console.error('Default worker error:', err);
    trackJobFailed('default', err.message);
  });

  const alertQueue = new Queue('alert', { connection: { url: REDIS_URL } });
  const defaultQueue = new Queue('default', { connection: { url: REDIS_URL } });

  setInterval(async () => {
    try {
      const alertCounts = await alertQueue.getJobCounts('waiting');
      trackQueueDepth('alert', (alertCounts.waiting || 0));
      const defaultCounts = await defaultQueue.getJobCounts('waiting');
      trackQueueDepth('default', (defaultCounts.waiting || 0));
    } catch (err) {
      console.error('Failed to get queue depth:', err);
    }
  }, 15000);

  console.log(`Worker connecting to Redis at ${REDIS_URL}`);
}

main().catch(async (err) => {
  console.error('Worker failed:', err);
  await shutdownTelemetry();
  process.exit(1);
});

process.on('SIGTERM', async () => {
  await shutdownTelemetry();
  process.exit(0);
});
