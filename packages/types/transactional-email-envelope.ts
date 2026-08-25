import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import {
  isValidTransactionalEmailPayload,
  type TransactionalEmailPayloadV1,
} from './transactional-email-job';

/**
 * Transactional-email encrypted delivery envelope (V1).
 *
 * The real recipient address and the typed template data exist ONLY inside
 * the AES-256-GCM ciphertext stored in the queue job's `encryptedPayload`
 * field. They must never appear in root BullMQ job data, logs, reports,
 * error output, or test snapshots.
 */

export const TRANSACTIONAL_EMAIL_DELIVERY_ENVELOPE_VERSION = 1 as const;
export const TRANSACTIONAL_EMAIL_ENCRYPTED_CONTAINER_VERSION = 1 as const;
export const TRANSACTIONAL_EMAIL_PAYLOAD_ENCRYPTION_SCHEME = 'aes-256-gcm' as const;

/** Environment variable holding the shared 32-byte base64 key (identical in API Gateway and Worker). */
export const MAIL_PAYLOAD_ENCRYPTION_KEY_B64_ENV = 'MAIL_PAYLOAD_ENCRYPTION_KEY_B64';

const KEY_BYTES = 32;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

export interface TransactionalEmailDeliveryEnvelopeV1 {
  envelopeVersion: typeof TRANSACTIONAL_EMAIL_DELIVERY_ENVELOPE_VERSION;
  /** Real SMTP recipient address. Only ever persisted inside sealed ciphertext. */
  to: string;
  /** Typed raw template payload; the Worker renders it. */
  templateData: TransactionalEmailPayloadV1;
}

export interface TransactionalEmailEncryptedContainerV1 {
  containerVersion: typeof TRANSACTIONAL_EMAIL_ENCRYPTED_CONTAINER_VERSION;
  scheme: typeof TRANSACTIONAL_EMAIL_PAYLOAD_ENCRYPTION_SCHEME;
  /** Base64 12-byte AES-GCM initialization vector (fresh per payload). */
  iv: string;
  /** Base64 16-byte AES-GCM authentication tag. */
  tag: string;
  /** Base64 ciphertext of the JSON-serialized delivery envelope. */
  ciphertext: string;
}

function requireKeyMaterial(key: Buffer): void {
  if (!Buffer.isBuffer(key) || key.length !== KEY_BYTES) {
    throw new Error('[MAIL PAYLOAD] Encryption key must be a 32-byte buffer.');
  }
}

/**
 * Loads and validates MAIL_PAYLOAD_ENCRYPTION_KEY_B64.
 * Fails closed (throws) when the variable is missing or does not decode to
 * exactly 32 random bytes. Never logs or embeds key material in errors.
 */
export function loadMailPayloadEncryptionKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  const raw = env[MAIL_PAYLOAD_ENCRYPTION_KEY_B64_ENV];
  if (!raw || typeof raw !== 'string' || raw.trim() === '') {
    throw new Error(
      `[MAIL PAYLOAD] ${MAIL_PAYLOAD_ENCRYPTION_KEY_B64_ENV} is required for transactional email. ` +
        'Generate with: openssl rand -base64 32',
    );
  }

  let key: Buffer;
  try {
    key = Buffer.from(raw.trim(), 'base64');
  } catch {
    throw new Error(`[MAIL PAYLOAD] ${MAIL_PAYLOAD_ENCRYPTION_KEY_B64_ENV} is not valid base64.`);
  }

  if (key.length !== KEY_BYTES) {
    throw new Error(
      `[MAIL PAYLOAD] ${MAIL_PAYLOAD_ENCRYPTION_KEY_B64_ENV} must decode to exactly ${KEY_BYTES} bytes.`,
    );
  }

  // Guard against silent character-stripping by Node's lenient base64 decoder.
  if (key.toString('base64') !== raw.trim()) {
    throw new Error(`[MAIL PAYLOAD] ${MAIL_PAYLOAD_ENCRYPTION_KEY_B64_ENV} is not canonical base64.`);
  }

  return key;
}

/** Validates an SMTP recipient address without echoing it anywhere. */
export function isValidRecipientEmailAddress(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.length === 0 || value.length > 254) return false;
  if (/[\r\n\t\x00-\x1f]/.test(value)) return false;
  if (value.startsWith('.') || value.endsWith('.') || value.includes('..')) return false;
  const localCharset = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+@[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
  return localCharset.test(value);
}

/** Full structural validation of a decrypted delivery envelope against its templateId. */
export function isValidTransactionalEmailDeliveryEnvelope(
  templateId: unknown,
  envelope: unknown,
): envelope is TransactionalEmailDeliveryEnvelopeV1 {
  if (typeof envelope !== 'object' || envelope === null) return false;
  const candidate = envelope as Record<string, unknown>;
  if (candidate.envelopeVersion !== TRANSACTIONAL_EMAIL_DELIVERY_ENVELOPE_VERSION) return false;
  if (!isValidRecipientEmailAddress(candidate.to)) return false;
  return isValidTransactionalEmailPayload(templateId, candidate.templateData);
}

/**
 * Seals a delivery envelope into a versioned AES-256-GCM container.
 * Returns the serialized container string destined for `encryptedPayload`.
 */
export function sealTransactionalEmailDeliveryEnvelope(
  envelope: TransactionalEmailDeliveryEnvelopeV1,
  key: Buffer,
): string {
  requireKeyMaterial(key);

  if (
    typeof envelope !== 'object' ||
    envelope === null ||
    envelope.envelopeVersion !== TRANSACTIONAL_EMAIL_DELIVERY_ENVELOPE_VERSION ||
    !isValidRecipientEmailAddress(envelope.to) ||
    typeof envelope.templateData !== 'object' ||
    envelope.templateData === null
  ) {
    throw new Error('[MAIL PAYLOAD] Refusing to seal invalid delivery envelope.');
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(envelope), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  const container: TransactionalEmailEncryptedContainerV1 = {
    containerVersion: TRANSACTIONAL_EMAIL_ENCRYPTED_CONTAINER_VERSION,
    scheme: TRANSACTIONAL_EMAIL_PAYLOAD_ENCRYPTION_SCHEME,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };

  return JSON.stringify(container);
}

/**
 * Opens a sealed delivery envelope. Throws sanitized errors with static
 * messages only — never echoes ciphertext, plaintext, or addresses.
 */
export function openTransactionalEmailDeliveryEnvelope(
  sealed: string,
  key: Buffer,
): TransactionalEmailDeliveryEnvelopeV1 {
  requireKeyMaterial(key);

  if (typeof sealed !== 'string' || sealed.length === 0) {
    throw new Error('[MAIL PAYLOAD] Invalid encrypted container.');
  }

  let container: unknown;
  try {
    container = JSON.parse(sealed);
  } catch {
    throw new Error('[MAIL PAYLOAD] Invalid encrypted container.');
  }

  if (typeof container !== 'object' || container === null) {
    throw new Error('[MAIL PAYLOAD] Invalid encrypted container.');
  }

  const record = container as Record<string, unknown>;
  if (
    record.containerVersion !== TRANSACTIONAL_EMAIL_ENCRYPTED_CONTAINER_VERSION ||
    record.scheme !== TRANSACTIONAL_EMAIL_PAYLOAD_ENCRYPTION_SCHEME
  ) {
    throw new Error('[MAIL PAYLOAD] Unsupported encrypted container version or scheme.');
  }

  if (
    typeof record.iv !== 'string' ||
    typeof record.tag !== 'string' ||
    typeof record.ciphertext !== 'string'
  ) {
    throw new Error('[MAIL PAYLOAD] Invalid encrypted container.');
  }

  let iv: Buffer;
  let tag: Buffer;
  let ciphertext: Buffer;
  try {
    iv = Buffer.from(record.iv, 'base64');
    tag = Buffer.from(record.tag, 'base64');
    ciphertext = Buffer.from(record.ciphertext, 'base64');
  } catch {
    throw new Error('[MAIL PAYLOAD] Invalid encrypted container.');
  }

  if (iv.length !== IV_BYTES || tag.length !== AUTH_TAG_BYTES || ciphertext.length === 0) {
    throw new Error('[MAIL PAYLOAD] Invalid encrypted container.');
  }

  let plaintext: Buffer;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error('[MAIL PAYLOAD] Envelope decryption or authentication failed.');
  }

  let envelope: unknown;
  try {
    envelope = JSON.parse(plaintext.toString('utf8'));
  } catch {
    throw new Error('[MAIL PAYLOAD] Invalid delivery envelope.');
  }

  if (typeof envelope !== 'object' || envelope === null) {
    throw new Error('[MAIL PAYLOAD] Invalid delivery envelope.');
  }

  const candidate = envelope as Record<string, unknown>;
  if (candidate.envelopeVersion !== TRANSACTIONAL_EMAIL_DELIVERY_ENVELOPE_VERSION) {
    throw new Error('[MAIL PAYLOAD] Unsupported delivery envelope version.');
  }

  if (!isValidRecipientEmailAddress(candidate.to)) {
    throw new Error('[MAIL PAYLOAD] Delivery envelope has no valid recipient.');
  }

  if (typeof candidate.templateData !== 'object' || candidate.templateData === null) {
    throw new Error('[MAIL PAYLOAD] Invalid delivery envelope.');
  }

  return envelope as TransactionalEmailDeliveryEnvelopeV1;
}
