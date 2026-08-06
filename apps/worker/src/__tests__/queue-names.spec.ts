import { QUEUE_NAMES, JOB_NAMES, QueueName } from '../queue-names';

describe('Queue Names', () => {
  it('defines all 7 queue names (default removed)', () => {
    const names = Object.values(QUEUE_NAMES);
    expect(names).toHaveLength(7);
    expect(names).toContain('alert');
    expect(names).toContain('report');
    expect(names).toContain('backup');
    expect(names).toContain('inventory');
    expect(names).toContain('security');
    expect(names).toContain('retention');
    expect(names).toContain('kb_embedding');
  });

  it('has correct values for each queue', () => {
    expect(QUEUE_NAMES.ALERT).toBe('alert');
    expect(QUEUE_NAMES.REPORT).toBe('report');
    expect(QUEUE_NAMES.BACKUP).toBe('backup');
    expect(QUEUE_NAMES.INVENTORY).toBe('inventory');
    expect(QUEUE_NAMES.SECURITY).toBe('security');
    expect(QUEUE_NAMES.RETENTION).toBe('retention');
    expect(QUEUE_NAMES.KB_EMBEDDING).toBe('kb_embedding');
  });

  it('has no duplicate values', () => {
    const names = Object.values(QUEUE_NAMES);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('does not include default queue', () => {
    expect(Object.values(QUEUE_NAMES)).not.toContain('default');
  });
});

describe('Job Names', () => {
  it('defines alert job names', () => {
    expect(JOB_NAMES.ALERT.NOTIFICATION).toBe('notification');
  });

  it('defines report job names', () => {
    expect(JOB_NAMES.REPORT.GENERATE).toBe('generate');
    expect(JOB_NAMES.REPORT.SCHEDULED).toBe('scheduled');
  });

  it('defines backup job names', () => {
    expect(JOB_NAMES.BACKUP.EXECUTE).toBe('execute');
    expect(JOB_NAMES.BACKUP.RESTORE).toBe('restore');
  });

  it('defines inventory job names', () => {
    expect(JOB_NAMES.INVENTORY.INGEST).toBe('ingest');
    expect(JOB_NAMES.INVENTORY.CATALOG_UPDATE).toBe('catalog_update');
  });

  it('defines security job names', () => {
    expect(JOB_NAMES.SECURITY.SCAN_COMPLETE).toBe('scan_complete');
    expect(JOB_NAMES.SECURITY.FINDING_ALERT).toBe('finding_alert');
  });

  it('defines retention job names', () => {
    expect(JOB_NAMES.RETENTION.ENFORCE).toBe('enforce');
  });
});
