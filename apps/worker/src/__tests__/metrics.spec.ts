import {
  trackQueueDepth,
  trackJobCompleted,
  trackJobFailed,
  trackJobDuration,
  trackUtilization,
  getMetrics,
  getMetricsContentType,
} from '../metrics';

describe('Metrics', () => {
  it('trackQueueDepth sets gauge without error', () => {
    expect(() => trackQueueDepth('alert', 5)).not.toThrow();
    expect(() => trackQueueDepth('report', 0)).not.toThrow();
    expect(() => trackQueueDepth('backup', 100)).not.toThrow();
  });

  it('trackJobCompleted increments counter', () => {
    expect(() => trackJobCompleted('alert')).not.toThrow();
    expect(() => trackJobCompleted('report')).not.toThrow();
    expect(() => trackJobCompleted('backup')).not.toThrow();
    expect(() => trackJobCompleted('inventory')).not.toThrow();
    expect(() => trackJobCompleted('security')).not.toThrow();
    expect(() => trackJobCompleted('retention')).not.toThrow();
    expect(() => trackJobCompleted('default')).not.toThrow();
  });

  it('trackJobFailed increments failure counter', () => {
    expect(() => trackJobFailed('alert', 'timeout')).not.toThrow();
    expect(() => trackJobFailed('report', 'ECONNREFUSED')).not.toThrow();
  });

  it('trackJobDuration records histogram observation', () => {
    expect(() => trackJobDuration('alert', 'notification', 0.5)).not.toThrow();
    expect(() => trackJobDuration('backup', 'execute', 2.3)).not.toThrow();
    expect(() => trackJobDuration('security', 'scan_complete', 0.01)).not.toThrow();
  });

  it('trackUtilization sets utilization gauge', () => {
    expect(() => trackUtilization('alert', 0.5)).not.toThrow();
    expect(() => trackUtilization('alert', 0)).not.toThrow();
    expect(() => trackUtilization('alert', 1)).not.toThrow();
  });

  it('getMetricsContentType returns valid content type', () => {
    const contentType = getMetricsContentType();
    expect(contentType).toContain('text/plain');
  });

  it('getMetrics returns prometheus metrics string', async () => {
    trackJobCompleted('alert');
    const metrics = await getMetrics();
    expect(typeof metrics).toBe('string');
    expect(metrics).toContain('bullmq_jobs_completed_total');
  });
});
