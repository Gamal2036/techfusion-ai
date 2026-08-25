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

export interface PasswordResetEmailPayloadV1 {
  recipientName: string;
  actionUrl: string;
  expiresIn: string;
}

export interface EmailVerificationEmailPayloadV1 {
  recipientName: string;
  actionUrl: string;
  expiresIn: string;
}

export interface SecurityNotificationEmailPayloadV1 {
  recipientName: string;
  eventDescription: string;
  timestamp: string;
}

export interface TransactionalEmailPayloadMapV1 {
  'password-reset': PasswordResetEmailPayloadV1;
  'email-verification': EmailVerificationEmailPayloadV1;
  'security-notification': SecurityNotificationEmailPayloadV1;
}

export type TransactionalEmailPayloadV1 =
  TransactionalEmailPayloadMapV1[TransactionalEmailTemplateId];

const REQUIRED_PAYLOAD_FIELDS: Record<TransactionalEmailTemplateId, readonly string[]> = {
  'password-reset': ['recipientName', 'actionUrl', 'expiresIn'],
  'email-verification': ['recipientName', 'actionUrl', 'expiresIn'],
  'security-notification': ['recipientName', 'eventDescription', 'timestamp'],
};

export function isValidTransactionalEmailTemplateId(
  templateId: unknown,
): templateId is TransactionalEmailTemplateId {
  return (
    templateId === 'password-reset' ||
    templateId === 'email-verification' ||
    templateId === 'security-notification'
  );
}

export function isValidTransactionalEmailPayload(
  templateId: unknown,
  payload: unknown,
): payload is TransactionalEmailPayloadV1 {
  if (!isValidTransactionalEmailTemplateId(templateId)) return false;
  if (typeof payload !== 'object' || payload === null) return false;
  const record = payload as Record<string, unknown>;
  return REQUIRED_PAYLOAD_FIELDS[templateId].every(
    (field) => typeof record[field] === 'string' && record[field].length > 0,
  );
}
