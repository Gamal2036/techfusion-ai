import { Worker } from 'bullmq';

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
  const worker = new Worker(
    'alert',
    async (job) => {
      console.log(`Processing alert job ${job.id}`);
      await sendNotification(job.data);
    },
    { connection: { url: REDIS_URL } },
  );

  // Also keep default queue worker for other tasks
  const defaultWorker = new Worker(
    'default',
    async (job) => {
      console.log(`Processing job ${job.id}: ${job.name}`);
    },
    { connection: { url: REDIS_URL } },
  );

  worker.on('ready', () => {
    console.log('Alert worker ready');
  });

  worker.on('error', (err) => {
    console.error('Alert worker error:', err);
  });

  defaultWorker.on('ready', () => {
    console.log('Default worker ready');
  });

  console.log(`Worker connecting to Redis at ${REDIS_URL}`);
}

main().catch(console.error);
