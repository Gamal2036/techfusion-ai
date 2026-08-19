export interface MailConfig {
  enabled: boolean;
  transport: 'smtp' | 'test';
  fromAddress: string;
  fromName: string;
  replyTo?: string;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    connectionTimeoutMs: number;
    greetingTimeoutMs: number;
    socketTimeoutMs: number;
  };
  publicWebUrl: string;
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') return defaultValue;
  const lower = value.toLowerCase().trim();
  if (lower === 'true') return true;
  if (lower === 'false') return false;
  return defaultValue;
}

function parsePort(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const port = parseInt(value, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`[MAIL CONFIG] Invalid SMTP port: "${value}". Must be 1-65535.`);
  }
  return port;
}

function parseTimeout(value: string | undefined, defaultValue: number, min: number, max: number, name: string): number {
  if (!value) return defaultValue;
  const ms = parseInt(value, 10);
  if (isNaN(ms) || ms < min || ms > max) {
    throw new Error(`[MAIL CONFIG] Invalid ${name}: "${value}". Must be ${min}-${max}ms.`);
  }
  return ms;
}

function validateEmail(value: string, name: string): void {
  if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error(`[MAIL CONFIG] Invalid email address for ${name}: "${value.replace(/./g, '*')}".`);
  }
}

function validateUrl(value: string, name: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`[MAIL CONFIG] Invalid URL for ${name}. Must be an absolute URL (e.g. https://app.example.com).`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`[MAIL CONFIG] Invalid URL scheme for ${name}. Must be https: or http:.`);
  }
}

export function loadMailConfig(): MailConfig {
  const enabled = parseBoolean(process.env.MAIL_ENABLED, false);
  const transport = (process.env.MAIL_TRANSPORT || 'smtp') as 'smtp' | 'test';
  const fromAddress = process.env.MAIL_FROM_ADDRESS || 'noreply@techfusion.ai';
  const fromName = process.env.MAIL_FROM_NAME || 'TechFusion AI';
  const replyTo = process.env.MAIL_REPLY_TO || undefined;

  const publicWebUrl = process.env.WEB_APP_URL || process.env.PUBLIC_WEB_URL || 'http://localhost:3000';

  const smtpHost = process.env.SMTP_HOST || 'localhost';
  const smtpPort = parsePort(process.env.SMTP_PORT, 587);
  const smtpSecure = parseBoolean(process.env.SMTP_SECURE, false);
  const smtpUser = process.env.SMTP_USER || '';
  const smtpPass = process.env.SMTP_PASS || '';
  const connectionTimeoutMs = parseTimeout(process.env.SMTP_CONNECTION_TIMEOUT_MS, 10000, 1000, 60000, 'SMTP_CONNECTION_TIMEOUT_MS');
  const greetingTimeoutMs = parseTimeout(process.env.SMTP_GREETING_TIMEOUT_MS, 10000, 1000, 60000, 'SMTP_GREETING_TIMEOUT_MS');
  const socketTimeoutMs = parseTimeout(process.env.SMTP_SOCKET_TIMEOUT_MS, 30000, 1000, 120000, 'SMTP_SOCKET_TIMEOUT_MS');

  if (enabled) {
    validateEmail(fromAddress, 'MAIL_FROM_ADDRESS');
    validateUrl(publicWebUrl, 'WEB_APP_URL/PUBLIC_WEB_URL');

    if (process.env.NODE_ENV === 'production') {
      if (!publicWebUrl.startsWith('https://')) {
        throw new Error('[MAIL CONFIG] WEB_APP_URL must use HTTPS in production.');
      }
    }

    if (transport === 'smtp') {
      if (!smtpHost) {
        throw new Error('[MAIL CONFIG] SMTP_HOST is required when MAIL_ENABLED=true and MAIL_TRANSPORT=smtp.');
      }
      if (!smtpUser) {
        throw new Error('[MAIL CONFIG] SMTP_USER is required when MAIL_ENABLED=true and MAIL_TRANSPORT=smtp.');
      }
      if (!smtpPass) {
        throw new Error('[MAIL CONFIG] SMTP_PASS is required when MAIL_ENABLED=true and MAIL_TRANSPORT=smtp.');
      }
    }
  }

  return {
    enabled,
    transport,
    fromAddress,
    fromName,
    replyTo,
    smtp: {
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      user: smtpUser,
      pass: smtpPass,
      connectionTimeoutMs,
      greetingTimeoutMs,
      socketTimeoutMs,
    },
    publicWebUrl,
  };
}
