import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private prisma: PrismaService) {}

  // ─── User Management ─────────────────────────────────────────

  async listUsers(orgId: string) {
    return this.prisma.user.findMany({
      where: { orgId },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        isMfaEnabled: true,
        ssoId: true,
        ssoProvider: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getUser(orgId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, orgId },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        isMfaEnabled: true,
        ssoId: true,
        ssoProvider: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateUserRole(orgId: string, actorId: string, userId: string, newRole: string) {
    const VALID_ROLES = ['Owner', 'Admin', 'Technician', 'Viewer'];
    if (!VALID_ROLES.includes(newRole)) {
      throw new BadRequestException(`Invalid role: ${newRole}. Must be one of: ${VALID_ROLES.join(', ')}`);
    }

    const target = await this.prisma.user.findFirst({
      where: { id: userId, orgId },
    });
    if (!target) throw new NotFoundException('User not found');

    // Cannot change role of another Owner
    if (target.role === 'Owner' && actorId !== userId) {
      throw new BadRequestException('Cannot change role of another Owner');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role: newRole as any },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        updatedAt: true,
      },
    });

    return updated;
  }

  async removeUser(orgId: string, actorId: string, userId: string) {
    const target = await this.prisma.user.findFirst({
      where: { id: userId, orgId },
    });
    if (!target) throw new NotFoundException('User not found');
    if (target.role === 'Owner') {
      throw new BadRequestException('Cannot remove the Owner of the organization');
    }
    if (target.id === actorId) {
      throw new BadRequestException('Cannot remove yourself');
    }

    await this.prisma.user.delete({ where: { id: userId } });
    return { message: 'User removed' };
  }

  // ─── Org Info ─────────────────────────────────────────────────

  async getOrgInfo(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        createdAt: true,
        _count: {
          select: {
            users: true,
            devices: true,
            auditLogs: true,
            remoteSessions: true,
            securityScans: true,
            backupJobs: true,
          },
        },
      },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  // ─── Dashboard Stats ──────────────────────────────────────────

  async getDashboardStats(orgId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      deviceCount,
      activeSessions,
      openFindings,
      reportsThisMonth,
      alertCount,
      recentAuditActions,
    ] = await Promise.all([
      this.prisma.device.count({ where: { orgId, inactive: false } }),
      this.prisma.remoteSession.count({ where: { orgId, status: { in: ['pending', 'active'] } } }),
      this.prisma.securityFinding.count({ where: { orgId, status: 'open' } }),
      this.prisma.report.count({ where: { orgId, createdAt: { gte: startOfMonth } } }),
      this.prisma.alert.count({ where: { orgId, resolvedAt: null, acknowledgedAt: null } }),
      this.prisma.auditLog.findMany({
        where: { orgId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, action: true, createdAt: true, actorId: true },
      }),
    ]);

    return {
      devices: deviceCount,
      activeRemoteSessions: activeSessions,
      openSecurityFindings: openFindings,
      reportsThisMonth,
      unresolvedAlerts: alertCount,
      recentActivity: recentAuditActions,
    };
  }
}
