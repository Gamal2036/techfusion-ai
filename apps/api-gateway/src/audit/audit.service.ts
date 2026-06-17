import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  orgId: string;
  action: string;
  actorId?: string;
  targetId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  async log(entry: AuditEntry) {
    const log = await this.prisma.auditLog.create({
      data: {
        orgId: entry.orgId,
        action: entry.action,
        actorId: entry.actorId || null,
        targetId: entry.targetId || null,
        details: entry.details || undefined,
        ipAddress: entry.ipAddress || null,
        userAgent: entry.userAgent || null,
        sessionId: entry.sessionId || null,
      },
    });
    this.logger.debug(`Audit: ${entry.action} by ${entry.actorId || 'system'} in org ${entry.orgId}`);
    return log;
  }

  async query(orgId: string, filters?: {
    action?: string;
    actorId?: string;
    targetId?: string;
    sessionId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = { orgId };
    if (filters?.action) where.action = filters.action;
    if (filters?.actorId) where.actorId = filters.actorId;
    if (filters?.targetId) where.targetId = filters.targetId;
    if (filters?.sessionId) where.sessionId = filters.sessionId;
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters?.limit || 50,
        skip: filters?.offset || 0,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { rows, total, limit: filters?.limit || 50, offset: filters?.offset || 0 };
  }

  async exportCsv(orgId: string, filters?: { action?: string; startDate?: string; endDate?: string }): Promise<string> {
    const result = await this.query(orgId, { ...filters, limit: 10000 });
    const headers = ['id', 'createdAt', 'action', 'actorId', 'targetId', 'sessionId', 'ipAddress', 'userAgent', 'details'];

    const escape = (val: any): string => {
      if (val === null || val === undefined) return '';
      const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const lines = [headers.join(',')];
    for (const row of result.rows) {
      lines.push(headers.map(h => escape((row as any)[h])).join(','));
    }
    return lines.join('\n');
  }

  async exportJson(orgId: string, filters?: { action?: string; startDate?: string; endDate?: string }): Promise<any[]> {
    const result = await this.query(orgId, { ...filters, limit: 10000 });
    return result.rows;
  }

  async logSecurityScan(orgId: string, actorId: string, targetId: string, details: any) {
    return this.log({ orgId, action: 'security_scan', actorId, targetId, details });
  }

  async logRemoteSessionAction(orgId: string, actorId: string, targetId: string, sessionId: string, action: string, details?: any) {
    return this.log({ orgId, action: `session_${action}`, actorId, targetId, sessionId, details });
  }

  async logBillingChange(orgId: string, actorId: string, details: any) {
    return this.log({ orgId, action: 'billing_change', actorId, details });
  }

  async logSettingsChange(orgId: string, actorId: string, details: any) {
    return this.log({ orgId, action: 'settings_change', actorId, details });
  }

  async logRoleChange(orgId: string, actorId: string, targetId: string, details: any) {
    return this.log({ orgId, action: 'role_change', actorId, targetId, details });
  }

  async logUserManagement(orgId: string, actorId: string, targetId: string, action: string, details?: any) {
    return this.log({ orgId, action: `user_${action}`, actorId, targetId, details });
  }

  async logRetentionChange(orgId: string, actorId: string, details: any) {
    return this.log({ orgId, action: 'retention_policy_change', actorId, details });
  }

  async logSsoConfigChange(orgId: string, actorId: string, details: any) {
    return this.log({ orgId, action: 'sso_config_change', actorId, details });
  }
}
