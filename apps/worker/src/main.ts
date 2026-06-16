import { Worker } from 'bullmq';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function main() {
  const worker = new Worker(
    'default',
    async (job) => {
      console.log(`Processing job ${job.id}: ${job.name}`);
    },
    { connection: { url: REDIS_URL } },
  );

  worker.on('ready', () => {
    console.log('worker ready');
  });

  worker.on('error', (err) => {
    console.error('Worker error:', err);
  });

  console.log(`Worker connecting to Redis at ${REDIS_URL}`);
}

main().catch(console.error);
