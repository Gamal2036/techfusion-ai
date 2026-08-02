import { Counter, Gauge, Histogram, Registry } from 'prom-client';
import * as http from 'http';

const register = new Registry();

const bullmqQueueDepth = new Gauge({
  name: 'bullmq_queue_depth',
  help: 'Current depth of BullMQ queues',
  labelNames: ['queue'],
  registers: [register],
});

const bullmqWaitingJobs = new Gauge({
  name: 'bullmq_waiting_jobs',
  help: 'Number of waiting jobs per queue',
  labelNames: ['queue'],
  registers: [register],
});

const bullmqActiveJobs = new Gauge({
  name: 'bullmq_active_jobs',
  help: 'Number of active jobs per queue',
  labelNames: ['queue'],
  registers: [register],
});

const bullmqDelayedJobs = new Gauge({
  name: 'bullmq_delayed_jobs',
  help: 'Number of delayed jobs per queue',
  labelNames: ['queue'],
  registers: [register],
});

const bullmqCompletedJobs = new Counter({
  name: 'bullmq_jobs_completed_total',
  help: 'Total number of completed BullMQ jobs',
  labelNames: ['queue'],
  registers: [register],
});

const bullmqFailedJobs = new Counter({
  name: 'bullmq_jobs_failed_total',
  help: 'Total number of failed BullMQ jobs',
  labelNames: ['queue', 'error'],
  registers: [register],
});

const bullmqJobDuration = new Histogram({
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

const bullmqRetryCount = new Counter({
  name: 'bullmq_retry_count_total',
  help: 'Total job retry attempts',
  labelNames: ['queue'],
  registers: [register],
});

const bullmqOldestWaitingAge = new Gauge({
  name: 'bullmq_oldest_waiting_job_age_seconds',
  help: 'Age of oldest waiting job in seconds',
  labelNames: ['queue'],
  registers: [register],
});

const bullmqWorkerConcurrency = new Gauge({
  name: 'bullmq_worker_concurrency',
  help: 'Worker concurrency setting',
  labelNames: ['queue'],
  registers: [register],
});

const bullmqProcessorFailures = new Counter({
  name: 'bullmq_processor_failures_total',
  help: 'Total processor-level failures',
  labelNames: ['queue'],
  registers: [register],
});

const bullmqStalledJobs = new Counter({
  name: 'bullmq_stalled_jobs_total',
  help: 'Total stalled jobs detected',
  labelNames: ['queue'],
  registers: [register],
});

const workerHealthGauge = new Gauge({
  name: 'worker_health',
  help: 'Worker health status (1=healthy, 0=unhealthy)',
  labelNames: ['service'],
  registers: [register],
});

const workerUptimeGauge = new Gauge({
  name: 'worker_uptime_seconds',
  help: 'Worker uptime in seconds',
  labelNames: ['service'],
  registers: [register],
});

export function trackQueueDepth(queue: string, depth: number): void {
  bullmqQueueDepth.labels(queue).set(depth);
}

export function trackJobCounts(queue: string, waiting: number, active: number, delayed: number): void {
  bullmqWaitingJobs.labels(queue).set(waiting);
  bullmqActiveJobs.labels(queue).set(active);
  bullmqDelayedJobs.labels(queue).set(delayed);
}

export function trackJobCompleted(queue: string): void {
  bullmqCompletedJobs.labels(queue).inc();
}

export function trackJobFailed(queue: string, error: string): void {
  const safeError = error.length > 100 ? error.slice(0, 100) : error;
  bullmqFailedJobs.labels(queue, safeError).inc();
}

export function trackJobDuration(queue: string, jobName: string, durationSeconds: number): void {
  bullmqJobDuration.labels(queue, jobName).observe(durationSeconds);
}

export function trackUtilization(queue: string, utilization: number): void {
  bullmqWorkerUtilization.labels(queue).set(utilization);
}

export function trackRetryCount(queue: string): void {
  bullmqRetryCount.labels(queue).inc();
}

export function trackOldestWaitingAge(queue: string, ageSeconds: number): void {
  bullmqOldestWaitingAge.labels(queue).set(ageSeconds);
}

export function trackWorkerConcurrency(queue: string, concurrency: number): void {
  bullmqWorkerConcurrency.labels(queue).set(concurrency);
}

export function trackProcessorFailure(queue: string): void {
  bullmqProcessorFailures.labels(queue).inc();
}

export function trackStalledJob(queue: string): void {
  bullmqStalledJobs.labels(queue).inc();
}

export function trackWorkerHealth(healthy: boolean): void {
  workerHealthGauge.labels('techfusion-worker').set(healthy ? 1 : 0);
}

export function trackWorkerUptime(): void {
  workerUptimeGauge.labels('techfusion-worker').set(process.uptime());
}

export function getMetricsContentType(): string {
  return register.contentType;
}

export async function getMetrics(): Promise<string> {
  return register.metrics();
}

const METRICS_TOKEN = process.env.METRICS_AUTH_TOKEN;

export function startMetricsServer(port: number = 9464): void {
  const server = http.createServer(async (req, res) => {
    if (req.url === '/metrics' && req.method === 'GET') {
      if (METRICS_TOKEN) {
        const authHeader = req.headers.authorization;
        const urlParams = new URL(req.url, `http://${req.headers.host}`);
        const tokenFromQuery = urlParams.searchParams.get('token');
        const providedToken = authHeader?.startsWith('Bearer ')
          ? authHeader.slice(7)
          : tokenFromQuery;

        if (providedToken !== METRICS_TOKEN) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Forbidden' }));
          return;
        }
      }
      res.writeHead(200, { 'Content-Type': register.contentType });
      res.end(await register.metrics());
    } else if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        service: 'techfusion-worker',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`Metrics server listening on port ${port}`);
  });
}
