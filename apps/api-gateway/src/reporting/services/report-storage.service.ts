import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const STORAGE_DIR = process.env.REPORT_STORAGE_DIR || './report-storage';
const SIGNED_URL_SECRET = process.env.REPORT_URL_SECRET || 'report-signing-secret-dev';
const URL_EXPIRY_HOURS = 24;

@Injectable()
export class ReportStorageService {
  private readonly logger = new Logger(ReportStorageService.name);

  constructor() {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }

  async store(
    orgId: string,
    reportId: string,
    format: string,
    buffer: Buffer,
  ): Promise<{ storagePath: string; fileSize: number }> {
    const dir = path.join(STORAGE_DIR, orgId);
    fs.mkdirSync(dir, { recursive: true });

    const filename = `${reportId}.${format}`;
    const filePath = path.join(dir, filename);

    await fs.promises.writeFile(filePath, buffer);
    const stat = await fs.promises.stat(filePath);

    this.logger.log(`Stored report ${filename} (${stat.size} bytes)`);

    return { storagePath: filePath, fileSize: stat.size };
  }

  async read(storagePath: string): Promise<Buffer | null> {
    try {
      return await fs.promises.readFile(storagePath);
    } catch {
      return null;
    }
  }

  async delete(storagePath: string): Promise<boolean> {
    try {
      await fs.promises.unlink(storagePath);
      return true;
    } catch {
      return false;
    }
  }

  generateSignedUrl(orgId: string, reportId: string, format: string): string {
    const expiresAt = Math.floor(Date.now() / 1000) + URL_EXPIRY_HOURS * 3600;
    const payload = `${orgId}:${reportId}:${format}:${expiresAt}`;
    const signature = crypto
      .createHmac('sha256', SIGNED_URL_SECRET)
      .update(payload)
      .digest('hex')
      .slice(0, 16);

    return `/api/reports/download/${reportId}/${format}?expires=${expiresAt}&sig=${signature}`;
  }

  validateSignedUrl(
    reportId: string,
    format: string,
    expires: string,
    sig: string,
    orgId: string,
  ): { valid: boolean; reason?: string } {
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = parseInt(expires, 10);

    if (isNaN(expiresAt) || now > expiresAt) {
      return { valid: false, reason: 'URL expired' };
    }

    const payload = `${orgId}:${reportId}:${format}:${expires}`;
    const expectedSig = crypto
      .createHmac('sha256', SIGNED_URL_SECRET)
      .update(payload)
      .digest('hex')
      .slice(0, 16);

    if (sig !== expectedSig) {
      return { valid: false, reason: 'Invalid signature' };
    }

    return { valid: true };
  }
}
