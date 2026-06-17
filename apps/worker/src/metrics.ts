import { Counter, Gauge, Histogram, Registry } from 'prom-client';
import * as http from 'http';

const register = new Registry();

const bullmqQueueDepth = new Gauge({
  name: 'bullmq_queue_depth',
  help: 'Current depth of BullMQ queues',
  labelNames: ['queue'],
  registers: [register],
});

const bullmqJobsCompletedTotal = new Counter({
  name: 'bullmq_jobs_completed_total',
  help: 'Total number of completed BullMQ jobs',
  labelNames: ['queue'],
  registers: [register],
});

const bullmqJobsFailedTotal = new Counter({
  name: 'bullmq_jobs_failed_total',
  help: 'Total number of failed BullMQ jobs',
  labelNames: ['queue', 'error'],
  registers: [register],
});

const bullmqJobDurationSeconds = new Histogram({
  name: 'bullmq_job_duration_seconds',
  help: 'BullMQ job processing duration in seconds',
  labelNames: ['queue', 'job_name'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [register],
});

const bullmqWorkerUtilization = new Gauge({
  name: 'bullmq_worker_utilization',
  help: 'Worker utilization (0-1)',
  labelNames: ['queue'],
  registers: [register],
});

export function trackQueueDepth(queue: string, depth: number): void {
  bullmqQueueDepth.labels(queue).set(depth);
}

export function trackJobCompleted(queue: string): void {
  bullmqJobsCompletedTotal.labels(queue).inc();
}

export function trackJobFailed(queue: string, error: string): void {
  bullmqJobsFailedTotal.labels(queue, error).inc();
}

export function trackJobDuration(queue: string, jobName: string, durationSeconds: number): void {
  bullmqJobDurationSeconds.labels(queue, jobName).observe(durationSeconds);
}

export function trackUtilization(queue: string, utilization: number): void {
  bullmqWorkerUtilization.labels(queue).set(utilization);
}

export function getMetricsContentType(): string {
  return register.contentType;
}

export async function getMetrics(): Promise<string> {
  return register.metrics();
}

export function startMetricsServer(port: number = 9464): void {
  const server = http.createServer(async (req, res) => {
    if (req.url === '/metrics' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': register.contentType });
      res.end(await register.metrics());
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`Metrics server listening on port ${port}`);
  });
}
