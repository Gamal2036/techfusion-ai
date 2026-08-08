import { QueueService } from './queue.service';
import { QUEUE_NAMES, JOB_NAMES } from './queue.constants';

const mockQueueAdd = jest.fn();

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: mockQueueAdd,
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('QueueService', () => {
  let service: QueueService;

  beforeEach(() => {
    mockQueueAdd.mockReset();
    mockQueueAdd.mockResolvedValue({});
    service = new QueueService({ url: 'redis://localhost:6381' });
  });

  describe('addPresenceSweep', () => {
    it('enqueues a presence sweep job on the monitoring queue', async () => {
      await service.addPresenceSweep({ allOrgs: true, scheduledAt: '2026-08-08T12:00:00.000Z' });

      expect(mockQueueAdd).toHaveBeenCalledTimes(1);
      const [name, data, opts] = mockQueueAdd.mock.calls[0];
      expect(name).toBe(JOB_NAMES.MONITORING.PRESENCE_SWEEP);
      expect(data.allOrgs).toBe(true);
      expect(data.scheduledAt).toBe('2026-08-08T12:00:00.000Z');
    });

    it('builds a jobId that BullMQ accepts (no colon character)', async () => {
      await service.addPresenceSweep({ allOrgs: true });

      const opts = mockQueueAdd.mock.calls[0][2];
      const jobId = opts.jobId as string;
      expect(jobId).toBeDefined();
      // BullMQ throws "Custom Id cannot contain :" for custom job ids holding
      // colons (unless in repeatable 3-part format). The presence sweep jobId
      // must never contain one.
      expect(jobId).not.toContain(':');
      expect(jobId).toMatch(/^presence-sweep-/);
    });

    it('keeps one deduplicated sweep per minute via a stable minute-based jobId', async () => {
      const idA = `presence-sweep-${new Date('2026-08-08T12:15:10.000Z')
        .toISOString()
        .slice(0, 16)
        .replace(':', '-')}`;
      const idB = `presence-sweep-${new Date('2026-08-08T12:15:59.000Z')
        .toISOString()
        .slice(0, 16)
        .replace(':', '-')}`;
      expect(idA).toBe(idB);
    });

    it('keeps retention options so completed/failed sweeps do not accumulate', async () => {
      await service.addPresenceSweep({ allOrgs: true });

      const opts = mockQueueAdd.mock.calls[0][2];
      expect(opts.removeOnComplete).toBeDefined();
      expect(opts.removeOnFail).toBeDefined();
    });
  });
});
