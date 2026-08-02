import { Injectable, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import * as crypto from 'crypto';

const ENROLLMENT_TOKEN_BYTES = 32;
const ENROLLMENT_TOKEN_PREFIX = 'tfenr_';

@Injectable()
export class EnrollmentService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async createToken(
    orgId: string,
    label?: string,
    maxUses?: number,
    expiresAt?: string,
    userId?: string,
    req?: { ipAddress?: string; userAgent?: string },
  ) {
    const rawToken = crypto.randomBytes(ENROLLMENT_TOKEN_BYTES).toString('hex');
    const prefixedToken = `${ENROLLMENT_TOKEN_PREFIX}${rawToken}`;
    const tokenHash = this.hashToken(rawToken);

    const expiresAtDate = expiresAt ? new Date(expiresAt) : null;

    const enrollmentToken = await this.prisma.enrollmentToken.create({
      data: {
        orgId,
        tokenHash,
        label: label ?? 'default',
        maxUses: maxUses ?? 1,
        expiresAt: expiresAtDate,
        createdByUserId: userId ?? null,
      },
    });

    await this.audit.log({
      orgId,
      action: 'enrollment_token_created',
      actorId: userId,
      targetId: enrollmentToken.id,
      details: {
        label: enrollmentToken.label,
        maxUses: enrollmentToken.maxUses,
        expiresAt: enrollmentToken.expiresAt,
      },
      ipAddress: req?.ipAddress,
      userAgent: req?.userAgent,
    });

    return {
      id: enrollmentToken.id,
      token: prefixedToken,
      label: enrollmentToken.label,
      maxUses: enrollmentToken.maxUses,
      useCount: enrollmentToken.useCount,
      expiresAt: enrollmentToken.expiresAt,
      createdAt: enrollmentToken.createdAt,
      createdByUserId: enrollmentToken.createdByUserId,
      status: 'active',
    };
  }

  async validateToken(rawToken: string): Promise<string> {
    const plainToken = rawToken.startsWith(ENROLLMENT_TOKEN_PREFIX)
      ? rawToken.slice(ENROLLMENT_TOKEN_PREFIX.length)
      : rawToken;

    if (plainToken.length !== ENROLLMENT_TOKEN_BYTES * 2) {
      throw new ForbiddenException('Invalid enrollment token');
    }

    const tokenHash = this.hashToken(plainToken);

    const record = await this.prisma.enrollmentToken.findUnique({
      where: { tokenHash },
    });

    if (!record) {
      throw new ForbiddenException('Invalid enrollment token');
    }

    if (record.revokedAt) {
      throw new ForbiddenException('Enrollment token has been revoked');
    }

    if (record.expiresAt && record.expiresAt < new Date()) {
      throw new ForbiddenException('Enrollment token has expired');
    }

    if (record.useCount >= record.maxUses) {
      throw new ForbiddenException('Enrollment token has been fully used');
    }

    await this.prisma.enrollmentToken.update({
      where: { id: record.id },
      data: { useCount: { increment: 1 } },
    });

    await this.audit.log({
      orgId: record.orgId,
      action: 'enrollment_token_used',
      targetId: record.id,
      details: {
        useCount: record.useCount + 1,
        maxUses: record.maxUses,
      },
    });

    return record.orgId;
  }

  async revokeToken(
    tokenId: string,
    orgId: string,
    userId?: string,
    req?: { ipAddress?: string; userAgent?: string },
  ) {
    const record = await this.prisma.enrollmentToken.findUnique({
      where: { id: tokenId },
    });

    if (!record) {
      throw new NotFoundException('Enrollment token not found');
    }

    if (record.orgId !== orgId) {
      throw new ForbiddenException('Enrollment token does not belong to this organization');
    }

    const updated = await this.prisma.enrollmentToken.update({
      where: { id: tokenId },
      data: { revokedAt: new Date() },
    });

    await this.audit.log({
      orgId,
      action: 'enrollment_token_revoked',
      actorId: userId,
      targetId: tokenId,
      details: { label: record.label },
      ipAddress: req?.ipAddress,
      userAgent: req?.userAgent,
    });

    return updated;
  }

  async regenerateToken(
    tokenId: string,
    orgId: string,
    userId?: string,
    req?: { ipAddress?: string; userAgent?: string },
  ) {
    const record = await this.prisma.enrollmentToken.findUnique({
      where: { id: tokenId },
    });

    if (!record) {
      throw new NotFoundException('Enrollment token not found');
    }

    if (record.orgId !== orgId) {
      throw new ForbiddenException('Enrollment token does not belong to this organization');
    }

    await this.prisma.enrollmentToken.update({
      where: { id: tokenId },
      data: { revokedAt: new Date() },
    });

    const newToken = await this.createToken(
      orgId,
      record.label ?? undefined,
      record.maxUses,
      record.expiresAt?.toISOString(),
      userId,
      req,
    );

    await this.audit.log({
      orgId,
      action: 'enrollment_token_regenerated',
      actorId: userId,
      targetId: tokenId,
      details: {
        oldTokenId: tokenId,
        newTokenId: newToken.id,
        label: record.label,
      },
      ipAddress: req?.ipAddress,
      userAgent: req?.userAgent,
    });

    return newToken;
  }

  async listTokens(orgId: string) {
    const tokens = await this.prisma.enrollmentToken.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        label: true,
        maxUses: true,
        useCount: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
        createdByUserId: true,
      },
    });

    const userIds = [...new Set(tokens.map((t) => t.createdByUserId).filter(Boolean))] as string[];
    let userMap = new Map<string, string>();

    if (userIds.length > 0) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, displayName: true, email: true },
      });
      userMap = new Map(users.map((u) => [u.id, u.displayName || u.email]));
    }

    return tokens.map((t) => ({
      ...t,
      createdByName: t.createdByUserId ? userMap.get(t.createdByUserId) || 'Unknown' : 'System',
      status: t.revokedAt
        ? 'revoked'
        : t.expiresAt && t.expiresAt < new Date()
        ? 'expired'
        : t.useCount >= t.maxUses
        ? 'exhausted'
        : 'active',
    }));
  }

  async getAuditLogs(orgId: string, tokenId?: string) {
    const where: any = { orgId, action: { startsWith: 'enrollment_token' } };
    if (tokenId) {
      where.targetId = tokenId ?? undefined;
    }

    return this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        action: true,
        actorId: true,
        targetId: true,
        details: true,
        ipAddress: true,
        createdAt: true,
      },
    });
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
