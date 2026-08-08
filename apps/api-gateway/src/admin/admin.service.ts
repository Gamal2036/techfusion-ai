import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private prisma: PrismaService) {}

  // ─── User Management ─────────────────────────────────────────
  //
  // Membership rows (OrganizationMember) are authoritative for who belongs to an
  // organization. User.orgId/User.role are snapshot fields of the user's active
  // org only and are NOT a reliable "team" listing source for a multi-org user.
  // Team management endpoints therefore resolve users through OrganizationMember.

  async listUsers(orgId: string) {
    const members = await this.prisma.organizationMember.findMany({
      where: { orgId },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });
    return members.map((m) => ({
      id: m.userId,
      email: m.user.email,
      displayName: m.user.displayName,
      role: m.role,
      isMfaEnabled: m.user.isMfaEnabled,
      ssoId: m.user.ssoId,
      ssoProvider: m.user.ssoProvider,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));
  }

  async getUser(orgId: string, userId: string) {
    const membership = await this.prisma.organizationMember.findUnique({
      where: { userId_orgId: { userId, orgId } },
      include: { user: true },
    });
    if (!membership) throw new NotFoundException('User not found');
    const user = membership.user;
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: membership.role,
      isMfaEnabled: user.isMfaEnabled,
      ssoId: user.ssoId,
      ssoProvider: user.ssoProvider,
      createdAt: membership.createdAt,
      updatedAt: membership.updatedAt,
    };
  }

  async updateUserRole(orgId: string, actorId: string, userId: string, newRole: string) {
    const VALID_ROLES = ['Owner', 'Admin', 'Technician', 'Viewer'];
    if (!VALID_ROLES.includes(newRole)) {
      throw new BadRequestException(`Invalid role: ${newRole}. Must be one of: ${VALID_ROLES.join(', ')}`);
    }

    // The OrganizationMember row is the authority for the target user's role in
    // this org; the User.role field is a snapshot of their active org only.
    const membership = await this.prisma.organizationMember.findUnique({
      where: { userId_orgId: { userId, orgId } },
      include: { user: true },
    });
    if (!membership) throw new NotFoundException('User not found');

    // Cannot change role of another Owner
    if (membership.role === 'Owner' && actorId !== userId) {
      throw new BadRequestException('Cannot change role of another Owner');
    }

    const updated = await this.prisma.organizationMember.update({
      where: { id: membership.id },
      data: { role: newRole as Role },
    });

    // Keep the legacy snapshot field in sync when this is the user's active org.
    if (membership.user.orgId === orgId) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { role: newRole as Role },
      });
    }

    return {
      id: membership.user.id,
      email: membership.user.email,
      displayName: membership.user.displayName,
      role: newRole,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Removes a user's membership from an organization. ORG-01C: this deletes the
   * OrganizationMember row only — never the global User — because a User may hold
   * memberships in multiple organizations. The last Owner can never be removed.
   */
  async removeUser(orgId: string, actorId: string, userId: string) {
    const membership = await this.prisma.organizationMember.findUnique({
      where: { userId_orgId: { userId, orgId } },
      include: { user: true },
    });
    if (!membership) throw new NotFoundException('User not found');
    if (membership.role === 'Owner') {
      const ownerCount = await this.prisma.organizationMember.count({
        where: { orgId, role: 'Owner' },
      });
      if (ownerCount <= 1) {
        throw new ConflictException(
          'This organization must keep at least one Owner. Transfer ownership before removing the last Owner.',
        );
      }
    }
    if (membership.user.id === actorId) {
      throw new BadRequestException('Cannot remove yourself');
    }

    await this.prisma.organizationMember.delete({ where: { id: membership.id } });

    await this.prisma.refreshToken.updateMany({
      where: { userId, orgId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // If the removed org was the user's active org, fall back deterministically.
    if (membership.user.orgId === orgId) {
      const fallback = await this.prisma.organizationMember.findFirst({
        where: { userId, orgId: { not: orgId } },
        orderBy: { createdAt: 'asc' },
      });
      if (fallback) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { orgId: fallback.orgId, role: fallback.role },
        });
      }
    }

    return { message: 'User removed', userId };
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
