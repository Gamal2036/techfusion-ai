export function getWsCorsOrigins(): string[] {
  const allowed = process.env.WS_ALLOWED_ORIGINS;
  if (allowed) {
    const origins = allowed.split(',').map((o) => o.trim()).filter(Boolean);
    if (origins.length > 0) return origins;
  }

  if (process.env.NODE_ENV === 'production') {
    console.error('[WS CORS] WS_ALLOWED_ORIGINS must be set in production. Falling back to https://techfusion.ai');
    return ['https://techfusion.ai'];
  }

  return ['http://localhost:3000', 'http://localhost:3001'];
}
