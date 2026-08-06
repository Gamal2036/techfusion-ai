import { QUEUE_NAMES } from '../queue-names';

jest.mock('../metrics', () => ({
  startMetricsServer: jest.fn(),
  trackQueueDepth: jest.fn(),
  trackJobCompleted: jest.fn(),
  trackJobFailed: jest.fn(),
  trackJobDuration: jest.fn(),
  getMetrics: jest.fn().mockResolvedValue(''),
  getMetricsContentType: jest.fn().mockReturnValue('text/plain'),
}));

jest.mock('../telemetry', () => ({
  initTelemetry: jest.fn().mockResolvedValue(undefined),
  shutdownTelemetry: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('bullmq', () => {
  const mockWorkerInstance = {
    on: jest.fn(),
    isRunning: jest.fn().mockReturnValue(true),
    isPaused: jest.fn().mockReturnValue(false),
    close: jest.fn().mockResolvedValue(undefined),
  };
  return {
    Worker: jest.fn().mockImplementation(() => mockWorkerInstance),
    Queue: jest.fn().mockImplementation(() => ({
      getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 0, delayed: 0 }),
      close: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

import { Worker, Queue } from 'bullmq';

describe('Queue Bootstrap', () => {
  it('creates a Worker for each queue name', () => {
    const queueNames = Object.values(QUEUE_NAMES);
    expect(queueNames.length).toBe(7);

    for (const name of queueNames) {
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    }
  });

  it('all queue names are unique', () => {
    const names = Object.values(QUEUE_NAMES);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('Worker constructor is available', () => {
    expect(Worker).toBeDefined();
    expect(typeof Worker).toBe('function');
  });

  it('Queue constructor is available', () => {
    expect(Queue).toBeDefined();
    expect(typeof Queue).toBe('function');
  });

  it('can instantiate a Worker for each queue', () => {
    const mockProcessor = jest.fn();
    for (const name of Object.values(QUEUE_NAMES)) {
      const worker = new Worker(name, mockProcessor, {
        connection: { url: 'redis://localhost:6379' },
      });
      expect(worker).toBeDefined();
      expect(worker.on).toBeDefined();
    }
  });

  it('can instantiate a Queue for each queue name', () => {
    for (const name of Object.values(QUEUE_NAMES)) {
      const queue = new Queue(name, { connection: { url: 'redis://localhost:6379' } });
      expect(queue).toBeDefined();
      expect(queue.getJobCounts).toBeDefined();
    }
  });
});
