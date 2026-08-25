import { createHash } from 'crypto';

const DANGEROUS_SCHEMES = new Set(['javascript:', 'data:', 'file:']);

export class MailUrlBuilder {
  private readonly publicWebUrl: string;

  constructor(publicWebUrl: string) {
    this.publicWebUrl = this.resolveOrigin(publicWebUrl);
  }

  private resolveOrigin(url: string): string {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error(`Invalid origin URL. Must be an absolute URL.`);
    }

    if (DANGEROUS_SCHEMES.has(parsed.protocol)) {
      throw new Error(`Dangerous URL scheme rejected: "${parsed.protocol}".`);
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error(`Invalid URL scheme: "${parsed.protocol}". Must be https: or http:.`);
    }

    if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
      throw new Error('Production origin must use HTTPS.');
    }

    return `${parsed.protocol}//${parsed.host}`;
  }

  buildActionUrl(path: string, params: Record<string, string> = {}): string {
    if (!path.startsWith('/')) {
      throw new Error('Action URL path must start with "/".');
    }

    const url = new URL(path, this.publicWebUrl);

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const built = url.toString();

    if (!built.startsWith(this.publicWebUrl)) {
      throw new Error('Constructed URL escaped the trusted origin.');
    }

    return built;
  }

  getOrigin(): string {
    return this.publicWebUrl;
  }

  hashRecipient(email: string): string {
    return createHash('sha256').update(email.toLowerCase().trim()).digest('hex').slice(0, 16);
  }
}
