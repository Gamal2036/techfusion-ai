import { Injectable, ForbiddenException, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService, normalizeSlug } from '../auth/auth.service';
import { ROLE_HIERARCHY, hasMinimumRole } from '../common/role-hierarchy';
import { createStructuredLogger } from '../common/structured-logger';
import { Organization, OrganizationMember, Role } from '@prisma/client';

const MAX_SLUG_RETRIES = 10;

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  plan: Organization['plan'];
  createdAt: Date;
  membershipRole: Role;
  isActive: boolean;
}

export interface OrganizationDetail extends OrganizationSummary {
  deviceCount: number;
  memberCount: number;
}

export interface OrganizationMemberSummary {
  membershipId: string;
  userId: string;
  email: string;
  displayName: string;
  role: Role;
  createdAt: Date;
  isSelf: boolean;
}

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);
  private readonly events = createStructuredLogger('Organizations');

  constructor(
    private prisma: PrismaService,
    private auth: AuthService,
  ) {}

  /**
   * Centralized membership authorization. Throws ForbiddenException when the
   * authenticated user has no OrganizationMember row for the target org.
   */
  async requireMembership(userId: string, orgId: string): Promise<OrganizationMember> {
    const membership = await this.prisma.organizationMember.findUnique({
      where: { userId_orgId: { userId, orgId } },
    });
    if (!membership) {
      this.events.log('organization_access_denied', { userId, orgId });
      throw new ForbiddenException('You are not a member of this organization');
    }
    return membership;
  }

  /**
   * Membership authorization plus a minimum role requirement. The role is read
   * from the OrganizationMember of the TARGET org, never from the JWT.
   */
  async requireMembershipRole(
    userId: string,
    orgId: string,
    minimumRole: Role,
  ): Promise<OrganizationMember> {
    const membership = await this.requireMembership(userId, orgId);
    if (!hasMinimumRole(membership.role, minimumRole)) {
      this.events.log('organization_access_denied', { userId, orgId });
      throw new ForbiddenException(
        'Insufficient role in this organization',
      );
    }
    return membership;
  }

  async listOrganizations(userId: string, activeOrgId?: string): Promise<OrganizationSummary[]> {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      include: { org: true },
      orderBy: { createdAt: 'asc' },
    });

    const items: OrganizationSummary[] = memberships.map((m) => ({
      id: m.org.id,
      name: m.org.name,
      slug: m.org.slug,
      plan: m.org.plan,
      createdAt: m.org.createdAt,
      membershipRole: m.role,
      isActive: m.orgId === activeOrgId,
    }));

    return items.sort((a, b) => {
      if (a.isActive) return -1;
      if (b.isActive) return 1;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  async getOrganization(
    userId: string,
    orgId: string,
    activeOrgId?: string,
  ): Promise<OrganizationDetail> {
    const membership = await this.requireMembership(userId, orgId);
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    const [deviceCount, memberCount] = await Promise.all([
      this.prisma.device.count({ where: { orgId } }),
      this.prisma.organizationMember.count({ where: { orgId } }),
    ]);
    return {
      ...this.toSummary(org, membership.role, orgId === activeOrgId),
      deviceCount,
      memberCount,
    };
  }

  // ─── Ownership Safety ─────────────────────────────────────────

  /**
   * Count of Owner memberships in an org. The last-Owner rule means an
   * organization must never end up with zero Owners unless it is being
   * explicitly destroyed through a safe deletion flow (not available in V1).
   */
  async countOwners(orgId: string): Promise<number> {
    return this.prisma.organizationMember.count({ where: { orgId, role: 'Owner' } });
  }

  /**
   * Centralized active-org fallback resolution. Returns the oldest remaining
   * membership (deterministic) excluding the given org, or null when the user
   * has no other memberships.
   */
  async resolveFallbackOrganization(
    userId: string,
    excludedOrgId?: string,
  ): Promise<OrganizationMember | null> {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId, ...(excludedOrgId ? { orgId: { not: excludedOrgId } } : {}) },
      orderBy: { createdAt: 'asc' },
    });
    return memberships[0] ?? null;
  }

  private async assertOwnershipSafe(orgId: string, role: Role): Promise<void> {
    if (role !== 'Owner') return;
    const ownerCount = await this.countOwners(orgId);
    if (ownerCount <= 1) {
      this.events.log('organization_last_owner_action_denied', { orgId });
      throw new ConflictException(
        'This organization must keep at least one Owner. Transfer ownership before downgrading, leaving, or removing the last Owner.',
      );
    }
  }

  // ─── Membership Management ─────────────────────────────────────

  async listMembers(userId: string, orgId: string): Promise<OrganizationMemberSummary[]> {
    await this.requireMembership(userId, orgId);
    const members = await this.prisma.organizationMember.findMany({
      where: { orgId },
      include: { user: { select: { id: true, email: true, displayName: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return members.map((m) => ({
      membershipId: m.id,
      userId: m.userId,
      email: m.user.email,
      displayName: m.user.displayName,
      role: m.role,
      createdAt: m.createdAt,
      isSelf: m.userId === userId,
    }));
  }

  /**
   * Updates a member's role in the target org. Membership row is authoritative;
   * User.role is only a snapshot synced when the target org is the user's active
   * org. Last-Owner safety is enforced before any Owner is downgraded.
   */
  async updateMemberRole(
    actorId: string,
    orgId: string,
    targetUserId: string,
    newRole: Role,
  ): Promise<OrganizationMemberSummary> {
    const actor = await this.requireMembership(actorId, orgId);
    const target = await this.prisma.organizationMember.findUnique({
      where: { userId_orgId: { userId: targetUserId, orgId } },
      include: { user: true },
    });
    if (!target) throw new NotFoundException('User is not a member of this organization');

    // Technician/Viewer cannot manage roles.
    if (actor.role === 'Technician' || actor.role === 'Viewer') {
      this.events.log('organization_access_denied', { userId: actorId, orgId });
      throw new ForbiddenException('Insufficient role in this organization');
    }

    // No-op when the role is unchanged.
    if (target.role === newRole) {
      return this.toMemberSummary(target, actorId);
    }

    // Promoting to Owner is Owner-only.
    if (newRole === 'Owner' && actor.role !== 'Owner') {
      throw new ForbiddenException('Only an Owner can grant the Owner role');
    }

    // An Admin may only manage strictly-lower roles (Technician/Viewer) and may
    // never touch an Owner.
    if (actor.role === 'Admin') {
      const canManage =
        target.role !== 'Owner' &&
        ROLE_HIERARCHY[target.role] < ROLE_HIERARCHY.Admin &&
        newRole !== 'Owner' &&
        ROLE_HIERARCHY[newRole] < ROLE_HIERARCHY.Admin;
      if (!canManage) {
        this.events.log('organization_access_denied', { userId: actorId, orgId });
        throw new ForbiddenException('Admins can only manage Technician and Viewer roles');
      }
    }

    // Downgrading an Owner (including self) requires another Owner to remain.
    if (target.role === 'Owner') {
      if (targetUserId !== actorId) {
        throw new BadRequestException('Cannot change the role of another Owner');
      }
      await this.assertOwnershipSafe(orgId, 'Owner');
    }

    const updated = await this.prisma.organizationMember.update({
      where: { id: target.id },
      data: { role: newRole },
    });

    // Sync the legacy User.role snapshot only when this org is the user's active org.
    if (target.user.orgId === orgId) {
      await this.prisma.user.update({
        where: { id: targetUserId },
        data: { role: newRole },
      });
    }

    this.events.log('organization_member_role_changed', {
      userId: actorId,
      orgId,
      event: `member:${targetUserId}:${newRole}`,
    });

    return this.toMemberSummary({ ...target, role: newRole }, actorId);
  }

  /**
   * Removes a member from an organization. Deletes the OrganizationMember row
   * only — never the global User. Last-Owner safety is enforced and the removed
   * user's active org falls back deterministically when possible.
   */
  async removeMember(actorId: string, orgId: string, targetUserId: string) {
    await this.requireMembershipRole(actorId, orgId, 'Owner');
    if (targetUserId === actorId) {
      throw new BadRequestException('Cannot remove yourself; use Leave Organization instead');
    }

    const target = await this.prisma.organizationMember.findUnique({
      where: { userId_orgId: { userId: targetUserId, orgId } },
      include: { user: true },
    });
    if (!target) throw new NotFoundException('User is not a member of this organization');

    if (target.role === 'Owner') {
      await this.assertOwnershipSafe(orgId, 'Owner');
    }

    await this.prisma.organizationMember.delete({ where: { id: target.id } });

    // Immediately revoke stored refresh sessions bound to the removed org so a
    // removed member's JWT cannot refresh back into this organization.
    await this.prisma.refreshToken.updateMany({
      where: { userId: targetUserId, orgId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // If the removed org was the user's active org, fall back deterministically.
    if (target.user.orgId === orgId) {
      const fallback = await this.resolveFallbackOrganization(targetUserId, orgId);
      if (fallback) {
        await this.prisma.user.update({
          where: { id: targetUserId },
          data: { orgId: fallback.orgId, role: fallback.role },
        });
      }
    }

    this.events.log('organization_member_removed', { userId: actorId, orgId });

    return { message: 'Member removed', userId: targetUserId };
  }

  /**
   * Voluntary leave. Sole Owners cannot leave, and a user cannot leave their
   * last organization in V1. Leaving the active org switches to the deterministic
   * fallback and issues a fresh auth state for it.
   */
  async leaveOrganization(userId: string, orgId: string) {
    const membership = await this.requireMembership(userId, orgId);

    if (membership.role === 'Owner') {
      await this.assertOwnershipSafe(orgId, 'Owner');
    }

    const remaining = await this.prisma.organizationMember.count({ where: { userId } });
    if (remaining <= 1) {
      throw new ConflictException(
        'You cannot leave your last organization in this build. Create or join another organization first.',
      );
    }

    await this.prisma.organizationMember.delete({ where: { id: membership.id } });

    // Leaving the active org requires a safe fallback with fresh auth state.
    if (await this.isActiveOrg(userId, orgId)) {
      const fallback = await this.resolveFallbackOrganization(userId, orgId);
      if (!fallback) {
        throw new ConflictException('No fallback organization available');
      }

      await this.prisma.refreshToken.updateMany({
        where: { userId, orgId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      const user = await this.prisma.user.update({
        where: { id: userId },
        data: { orgId: fallback.orgId, role: fallback.role },
      });

      const tokens = await this.auth.issueTokensForOrg(user.id, fallback.orgId, fallback.role);

      this.events.log('organization_left', { userId, orgId });

      return {
        message: 'Left organization',
        switchedTo: fallback.orgId,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: fallback.role,
          orgId: fallback.orgId,
        },
        ...tokens,
      };
    }

    this.events.log('organization_left', { userId, orgId });
    return { message: 'Left organization' };
  }

  private async isActiveOrg(userId: string, orgId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { orgId: true },
    });
    return user?.orgId === orgId;
  }

  private toMemberSummary(
    membership: { id: string; userId: string; role: Role; createdAt: Date } & { user?: { email?: string; displayName?: string } },
    actorId: string,
  ): OrganizationMemberSummary {
    return {
      membershipId: membership.id,
      userId: membership.userId,
      email: membership.user?.email ?? '',
      displayName: membership.user?.displayName ?? '',
      role: membership.role,
      createdAt: membership.createdAt,
      isSelf: membership.userId === actorId,
    };
  }

  async getCurrent(userId: string, activeOrgId: string): Promise<OrganizationSummary> {
    const membership = await this.requireMembership(userId, activeOrgId);
    const org = await this.prisma.organization.findUnique({ where: { id: activeOrgId } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    return this.toSummary(org, membership.role, true);
  }

  async createOrganization(userId: string, name: string): Promise<OrganizationSummary> {
    const baseSlug = normalizeSlug(name);
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= MAX_SLUG_RETRIES; attempt++) {
      const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;

      try {
        const { org, membership } = await this.prisma.$transaction(async (tx) => {
          const created = await tx.organization.create({ data: { name, slug } });
          const owner = await tx.organizationMember.create({
            data: { userId, orgId: created.id, role: 'Owner' },
          });
          return { org: created, membership: owner };
        });

        this.events.log('organization_created', { userId, orgId: org.id });
        return this.toSummary(org, membership.role, false);
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        if (code === 'P2002' && attempt < MAX_SLUG_RETRIES) {
          this.logger.debug(`Slug collision on "${slug}", retrying (attempt ${attempt + 1})`);
          lastError = err;
          continue;
        }
        throw err;
      }
    }

    this.logger.error(`Failed to generate unique slug after ${MAX_SLUG_RETRIES + 1} attempts`);
    throw lastError || new Error('Failed to generate unique slug');
  }

  async renameOrganization(
    userId: string,
    orgId: string,
    name: string,
    activeOrgId?: string,
  ): Promise<OrganizationSummary> {
    await this.requireMembershipRole(userId, orgId, 'Owner');

    // Slug is preserved: it is a stable identity referenced by SSO JIT
    // provisioning (sso.service.ts looks up organizations by slug).
    const org = await this.prisma.organization.update({
      where: { id: orgId },
      data: { name },
    });
    const membership = await this.requireMembership(userId, orgId);
    return this.toSummary(org, membership.role, orgId === activeOrgId);
  }

  async switchOrganization(userId: string, orgId: string) {
    const membership = await this.requireMembership(userId, orgId);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { orgId, role: membership.role },
    });

    // Keep the refresh-session metadata bound to the selected active org so no
    // stored refresh token silently points at a previous organization.
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { orgId },
    });

    const tokens = await this.auth.issueTokensForOrg(user.id, orgId, membership.role);

    this.events.log('organization_switched', { userId, orgId });

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: membership.role,
        orgId,
      },
      ...tokens,
    };
  }

  private toSummary(
    org: Organization,
    membershipRole: Role,
    isActive: boolean,
  ): OrganizationSummary {
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      createdAt: org.createdAt,
      membershipRole,
      isActive,
    };
  }
}
