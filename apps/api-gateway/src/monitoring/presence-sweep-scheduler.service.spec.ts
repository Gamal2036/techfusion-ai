import { Logger } from '@nestjs/common';
import { PresenceSweepSchedulerService } from './presence-sweep-scheduler.service';

describe('PresenceSweepSchedulerService', () => {
  let service: PresenceSweepSchedulerService;
  let queueMock: { addPresenceSweep: jest.Mock };
  let lockMock: { acquire: jest.Mock; release: jest.Mock };
  let debugSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    queueMock = {
      addPresenceSweep: jest.fn().mockResolvedValue(undefined),
    };
    lockMock = {
      acquire: jest.fn().mockResolvedValue('sweep-token-1'),
      release: jest.fn().mockResolvedValue(true),
    } as any;

    service = new PresenceSweepSchedulerService(queueMock as any, lockMock as any);
    debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    debugSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('enqueues an all-org presence sweep when the lock is acquired', async () => {
    await service.handlePresenceSweepTick();

    expect(lockMock.acquire).toHaveBeenCalledTimes(1);
    expect(queueMock.addPresenceSweep).toHaveBeenCalledTimes(1);
    const call = queueMock.addPresenceSweep.mock.calls[0][0];
    expect(call.allOrgs).toBe(true);
    expect(call.scheduledAt).toBeDefined();
    expect(lockMock.release).toHaveBeenCalledTimes(1);
    expect(lockMock.release).toHaveBeenCalledWith('techfusion:presence-sweep:lock', 'sweep-token-1');
  });

  it('skips enqueueing when the lock is already held by another instance', async () => {
    lockMock.acquire.mockResolvedValue(null);

    await service.handlePresenceSweepTick();

    expect(queueMock.addPresenceSweep).not.toHaveBeenCalled();
    expect(lockMock.release).not.toHaveBeenCalled();
  });

  it('releases the lock even when enqueueing fails', async () => {
    queueMock.addPresenceSweep.mockRejectedValue(new Error('redis down'));

    await service.handlePresenceSweepTick();

    expect(errorSpy).toHaveBeenCalled();
    expect(lockMock.release).toHaveBeenCalledTimes(1);
  });

  it('does not throw when lock acquisition fails', async () => {
    lockMock.acquire.mockRejectedValue(new Error('connect refused'));

    await expect(service.handlePresenceSweepTick()).resolves.not.toThrow();
    expect(errorSpy).toHaveBeenCalled();
    expect(queueMock.addPresenceSweep).not.toHaveBeenCalled();
  });
});
