export const TRANSACTIONAL_EMAIL_CONTRACT_VERSION = 1 as const;

export type TransactionalEmailTemplateId =
  | 'password-reset'
  | 'email-verification'
  | 'security-notification';

export interface TransactionalEmailJobV1 {
  version: typeof TRANSACTIONAL_EMAIL_CONTRACT_VERSION;
  templateId: TransactionalEmailTemplateId;
  encryptedPayload: string;
  recipientHash: string;
  idempotencyKey: string;
  correlationId: string;
}

export type TransactionalEmailJob = TransactionalEmailJobV1;

export interface TransactionalEmailJobCorrelation {
  requestId: string;
  correlationId: string;
  traceId?: string;
  userId?: string;
  orgId?: string;
}

export interface TransactionalEmailJobWithCorrelation extends TransactionalEmailJob {
  _correlation?: TransactionalEmailJobCorrelation;
}

export function isValidContractVersion(version: unknown): version is typeof TRANSACTIONAL_EMAIL_CONTRACT_VERSION {
  return version === TRANSACTIONAL_EMAIL_CONTRACT_VERSION;
}
