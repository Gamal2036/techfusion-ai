const EXAMPLE_SECRETS = [
  'sk_test_placeholder',
  'whsec_placeholder',
  'price_pro',
  'price_business',
  'price_enterprise',
];

function isExampleSecret(value: string): boolean {
  return EXAMPLE_SECRETS.includes(value.toLowerCase());
}

function requireEnv(name: string, options?: { allowEmpty?: boolean; secret?: boolean }): string {
  const value = process.env[name];
  if (value === undefined || value === null) {
    throw new Error(`[ENV VALIDATION] Required environment variable "${name}" is missing.`);
  }
  if (!options?.allowEmpty && value.trim() === '') {
    throw new Error(`[ENV VALIDATION] Environment variable "${name}" must not be empty.`);
  }
  if (options?.secret && process.env.NODE_ENV === 'production' && isExampleSecret(value)) {
    throw new Error(
      `[ENV VALIDATION] Environment variable "${name}" contains an example/placeholder value. ` +
      `Production must use real secrets. Generate with: openssl rand -hex 32`,
    );
  }
  return value;
}

function requireSecret(name: string): string {
  const value = requireEnv(name, { secret: true });
  if (process.env.NODE_ENV === 'production' && value.length < 32) {
    throw new Error(
      `[ENV VALIDATION] Secret "${name}" is too short for production (minimum 32 characters). ` +
      `Generate with: openssl rand -hex 32`,
    );
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

export function validateEnvironment(): void {
  const nodeEnv = process.env.NODE_ENV || 'development';
  console.log(`[ENV VALIDATION] Running in "${nodeEnv}" mode`);

  requireEnv('DATABASE_URL');
  requireEnv('REDIS_URL');

  requireSecret('JWT_SECRET');
  requireSecret('JWT_REFRESH_SECRET');

  if (nodeEnv === 'production') {
    requireSecret('AI_ENCRYPTION_KEY');
    requireSecret('REPORT_URL_SECRET');

    const allowedOrigins = process.env.ALLOWED_ORIGINS;
    if (!allowedOrigins || allowedOrigins.trim() === '') {
      throw new Error(
        '[ENV VALIDATION] ALLOWED_ORIGINS must be set in production.',
      );
    }

    const wsOrigins = process.env.WS_ALLOWED_ORIGINS;
    if (!wsOrigins || wsOrigins.trim() === '') {
      throw new Error(
        '[ENV VALIDATION] WS_ALLOWED_ORIGINS must be set in production.',
      );
    }
  } else {
    optionalEnv('AI_ENCRYPTION_KEY', 'dev-key-not-for-production');
    optionalEnv('REPORT_URL_SECRET', 'dev-key-not-for-production');
  }

  console.log('[ENV VALIDATION] All required environment variables validated successfully.');
}
