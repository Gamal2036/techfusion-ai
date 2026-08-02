export const QUEUE_NAMES = {
  ALERT: 'alert',
  REPORT: 'report',
  BACKUP: 'backup',
  INVENTORY: 'inventory',
  SECURITY: 'security',
  RETENTION: 'retention',
  KB_EMBEDDING: 'kb_embedding',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const JOB_NAMES = {
  ALERT: {
    NOTIFICATION: 'notification',
  },
  REPORT: {
    GENERATE: 'generate',
    SCHEDULED: 'scheduled',
  },
  BACKUP: {
    EXECUTE: 'execute',
    RESTORE: 'restore',
    VERIFY: 'verify',
  },
  INVENTORY: {
    INGEST: 'ingest',
    CATALOG_UPDATE: 'catalog_update',
  },
  SECURITY: {
    SCAN_COMPLETE: 'scan_complete',
    FINDING_ALERT: 'finding_alert',
  },
  RETENTION: {
    ENFORCE: 'enforce',
  },
  KB_EMBEDDING: {
    EMBED: 'embed',
    REINDEX: 'reindex',
  },
} as const;

export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 2000,
  },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 },
};
