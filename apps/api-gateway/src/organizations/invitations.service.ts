import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ConflictException,
  GoneException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from './organizations.service';
import {
  generateInvitationToken,
  hashInvitationToken,
  getWebAppBaseUrl,
  isInvitationLive,
  maskEmail,
  INVITATION_TTL_MS,
} from './invitation-token';
import { createStructuredLogger } from '../common/structured-logger';
import { InvitationStatus, Role } from '@prisma/client';

/**
 * V1 role policy for invitations (V1-TEAM-01).
 *
 * Ownership is sensitive and is intentionally never granted through an
 * invitation: only an existing Owner may promote an accepted member to Owner
 * through the protected membership role-management flow. An Admin may invite
 * strictly-lower roles (Technician/Viewer) and may never invite Admin or Owner.
 */
const ALLOWED_INVITE_ROLES: Record<Role, readonly Role[]> = {
  Owner: ['Admin', 'Technician', 'Viewer'],
  Admin: ['Technician', 'Viewer'],
  Technician: [],
  Viewer: [],
};

const INVITEABLE_ROLES = new Set<Role>(['Admin', 'Technician', 'Viewer']);

export interface InvitationSummary {
  id: string;
  organizationId: string;
  email: string;
  role: Role;
  status: InvitationStatus;
  expiresAt: Date;
  createdAt: Date;
  invitedBy: { userId: string; email: string; displayName: string } | null;
}

export interface InvitationInspection {
  organization: { id: string; name: string };
  role: Role;
  email: string;
  status: InvitationStatus;
  expiresAt: Date;
}

export interface InvitationAcceptResult {
  organization: { id: string; name: string; slug: string };
  membership: { id: string; userId: string; orgId: string; role: Role };
}

@Injectable()
export class InvitationsService {
  private readonly events = createStructuredLogger('Invitations');

  constructor(
    private prisma: PrismaService,
    private organizations: OrganizationsService,
  ) {}

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private safeSummary(
    inv: {
      id: string;
      organizationId: string;
      email: string;
      role: Role;
      status: InvitationStatus;
      expiresAt: Date;
      createdAt: Date;
      invitedByUserId: string;
    },
    inviter?: { userId: string; email: string; displayName: string },
  ): InvitationSummary {
    return {
      id: inv.id,
      organizationId: inv.organizationId,
      email: inv.email,
      role: inv.role,
      status: inv.status,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
      invitedBy: inviter ?? { userId: inv.invitedByUserId, email: '', displayName: '' },
    };
  }

  /**
   * Creates a PENDING invitation. Duplicate live PENDING invitations for the
   * same (organization, email) are returned idempotently instead of duplicated;
   * an expired PENDING invitation is regenerated with a fresh token + expiry.
   */
  async createInvitation(
    actorId: string,
    orgId: string,
    emailInput: string,
    role: Role,
    origin: string,
  ): Promise<InvitationSummary & { devInvitationUrl?: string }> {
    const actor = await this.requireInviter(actorId, orgId, role);
    const email = this.normalizeEmail(emailInput);
    const actorUser = await this.getUserIdentity(actorId);

    await this.assertNotMember(orgId, email);

    const existing = await this.prisma.organizationInvitation.findFirst({
      where: { organizationId: orgId, email, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      const now = new Date();
      if (existing.expiresAt.getTime() > now.getTime()) {
        // Policy A: a live pending invitation already exists — return it
        // unchanged (no new token, no new link). Use the resend endpoint to
        // regenerate a fresh invitation link.
        return this.safeSummary(existing, actorUser);
      }
      // Expired pending row: regenerate token + expiry in place.
      const token = generateInvitationToken();
      const refreshed = await this.prisma.organizationInvitation.update({
        where: { id: existing.id },
        data: { tokenHash: hashInvitationToken(token), expiresAt: new Date(Date.now() + INVITATION_TTL_MS) },
      });
      this.events.log('organization_invitation_created', {
        userId: actorId,
        orgId,
        event: `invitation:${refreshed.id}:${email}`,
      });
      return {
        ...this.safeSummary(refreshed, actorUser),
        ...(this.devLinkFor(token, origin)),
      };
    }

    const token = generateInvitationToken();
    const invitation = await this.prisma.organizationInvitation.create({
      data: {
        organizationId: orgId,
        email,
        role,
        tokenHash: hashInvitationToken(token),
        status: 'PENDING',
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
        invitedByUserId: actorId,
      },
    });

    this.events.log('organization_invitation_created', {
      userId: actorId,
      orgId,
      event: `invitation:${invitation.id}:${email}`,
    });

    return {
      ...this.safeSummary(invitation, actorUser),
      ...(this.devLinkFor(token, origin)),
    };
  }

  async listInvitations(actorId: string, orgId: string): Promise<InvitationSummary[]> {
    await this.organizations.requireMembershipRole(actorId, orgId, 'Admin');

    const invitations = await this.prisma.organizationInvitation.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });

    const inviters = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(invitations.map((i) => i.invitedByUserId))] } },
      select: { id: true, email: true, displayName: true },
    });
    const inviterById = new Map(inviters.map((u) => [u.id, u]));

    return invitations.map((inv) => ({
      id: inv.id,
      organizationId: inv.organizationId,
      email: inv.email,
      role: inv.role,
      status: inv.status,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
      invitedBy: inviterById.get(inv.invitedByUserId)
        ? { userId: inv.invitedByUserId, email: inviterById.get(inv.invitedByUserId)!.email, displayName: inviterById.get(inv.invitedByUserId)!.displayName }
        : null,
    }));
  }

  async revokeInvitation(actorId: string, orgId: string, invitationId: string) {
    const actor = await this.organizations.requireMembershipRole(actorId, orgId, 'Admin');
    const invitation = await this.findInOrg(orgId, invitationId);
    this.assertActorCanManage(actor.role, invitation);

    if (invitation.status === 'ACCEPTED') {
      throw new BadRequestException(
        'Invitation has already been accepted; remove the member to change membership',
      );
    }
    if (invitation.status === 'REVOKED') {
      return { message: 'Invitation revoked' };
    }

    await this.prisma.organizationInvitation.update({
      where: { id: invitation.id },
      data: { status: 'REVOKED' },
    });

    this.events.log('organization_invitation_revoked', {
      userId: actorId,
      orgId,
      event: `invitation:${invitation.id}`,
    });

    return { message: 'Invitation revoked', invitationId: invitation.id };
  }

  async resendInvitation(
    actorId: string,
    orgId: string,
    invitationId: string,
    origin: string,
  ) {
    const actor = await this.organizations.requireMembershipRole(actorId, orgId, 'Admin');
    const invitation = await this.findInOrg(orgId, invitationId);
    this.assertActorCanManage(actor.role, invitation);

    if (invitation.status === 'ACCEPTED') {
      throw new BadRequestException('Invitation has already been accepted');
    }
    if (invitation.status === 'REVOKED') {
      throw new BadRequestException(
        'Invitation was revoked; create a new invitation for this email',
      );
    }

    const actorUser = await this.getUserIdentity(actorId);

    // Regenerating the token hash invalidates the previous token immediately.
    const rawToken = generateInvitationToken();
    const refreshed = await this.prisma.organizationInvitation.update({
      where: { id: invitation.id },
      data: {
        tokenHash: hashInvitationToken(rawToken),
        status: 'PENDING',
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      },
    });

    this.events.log('organization_invitation_resent', {
      userId: actorId,
      orgId,
      event: `invitation:${invitation.id}`,
    });

    return {
      ...this.safeSummary(refreshed, actorUser),
      ...(this.devLinkFor(rawToken, origin)),
    };
  }

  /** Public token inspection — returns only safe, non-sensitive metadata. */
  async inspectInvitation(token: string): Promise<InvitationInspection> {
    const invitation = await this.prisma.organizationInvitation.findUnique({
      where: { tokenHash: hashInvitationToken(token) },
      include: { organization: { select: { id: true, name: true } } },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found or expired');
    }

    const effectiveStatus = isInvitationLive(invitation.status, invitation.expiresAt)
      ? 'PENDING'
      : invitation.status === 'PENDING'
        ? 'EXPIRED'
        : invitation.status;

    return {
      organization: invitation.organization,
      role: invitation.role,
      email: maskEmail(invitation.email),
      status: effectiveStatus as InvitationStatus,
      expiresAt: invitation.expiresAt,
    };
  }

  /**
   * Accepts an invitation for the authenticated user. Membership creation and
   * invitation consumption are atomic (single transaction). The invitation is
   * single-use and bound to the invited email; possession of the token alone is
   * never sufficient.
   */
  async acceptInvitation(
    userId: string,
    token: string,
  ): Promise<InvitationAcceptResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const invitation = await this.prisma.organizationInvitation.findUnique({
      where: { tokenHash: hashInvitationToken(token) },
      include: { organization: { select: { id: true, name: true, slug: true } } },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found or expired');
    }

    const now = new Date();
    if (invitation.status === 'PENDING' && invitation.expiresAt.getTime() <= now.getTime()) {
      await this.prisma.organizationInvitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });
      this.events.log('organization_invitation_expired', {
        userId,
        orgId: invitation.organizationId,
      });
      throw new GoneException('Invitation has expired');
    }

    if (invitation.status === 'ACCEPTED') {
      throw new ConflictException('Invitation has already been accepted');
    }
    if (invitation.status === 'REVOKED') {
      throw new ConflictException('Invitation has been revoked');
    }

    // Email ownership binding: the authenticated account email must match the
    // invited email (case-insensitive normalized comparison).
    if (this.normalizeEmail(user.email) !== invitation.email) {
      this.events.log('organization_invitation_accept_denied', {
        userId,
        orgId: invitation.organizationId,
        reason: 'email_mismatch',
      });
      throw new ForbiddenException('This invitation is for a different email address');
    }

    if (!INVITEABLE_ROLES.has(invitation.role)) {
      throw new BadRequestException('Invitation role is not supported');
    }

    const existing = await this.prisma.organizationMember.findUnique({
      where: { userId_orgId: { userId, orgId: invitation.organizationId } },
    });
    if (existing) {
      throw new ConflictException('You are already a member of this organization');
    }

    const { membership } = await this.prisma.$transaction(async (tx) => {
      const created = await tx.organizationMember.create({
        data: {
          userId,
          orgId: invitation.organizationId,
          role: invitation.role,
        },
      });
      await tx.organizationInvitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED', acceptedAt: now },
      });
      return { membership: created };
    });

    this.events.log('organization_invitation_accepted', {
      userId,
      orgId: invitation.organizationId,
      event: `member:${membership.id}:${invitation.role}`,
    });

    return {
      organization: invitation.organization,
      membership: {
        id: membership.id,
        userId: membership.userId,
        orgId: membership.orgId,
        role: membership.role,
      },
    };
  }

  // ─── Private helpers ────────────────────────────────────────────

  /**
   * Enforces the invite role hierarchy. Backend is authoritative: an Owner may
   * invite Admin/Technician/Viewer; an Admin only Technician/Viewer; a
   * Technician or Viewer can never invite.
   */
  private async requireInviter(
    actorId: string,
    orgId: string,
    requestedRole: Role,
  ) {
    const actor = await this.organizations.requireMembership(actorId, orgId);
    const allowed = ALLOWED_INVITE_ROLES[actor.role] ?? [];
    if (!allowed.includes(requestedRole)) {
      this.events.log('organization_invitation_create_denied', {
        userId: actorId,
        orgId,
        reason: `role=${actor.role} requested=${requestedRole}`,
      });
      throw new ForbiddenException(
        'You do not have permission to invite members with that role',
      );
    }
    return actor;
  }

  private async assertNotMember(orgId: string, email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return;
    const membership = await this.prisma.organizationMember.findUnique({
      where: { userId_orgId: { userId: user.id, orgId } },
    });
    if (membership) {
      throw new ConflictException('User is already a member of this organization');
    }
  }

  private async getUserIdentity(
    userId: string,
  ): Promise<{ userId: string; email: string; displayName: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, displayName: true },
    });
    return { userId, email: user?.email ?? '', displayName: user?.displayName ?? '' };
  }

  private async findInOrg(orgId: string, invitationId: string) {
    const invitation = await this.prisma.organizationInvitation.findFirst({
      where: { id: invitationId, organizationId: orgId },
    });
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    return invitation;
  }

  /**
   * Admins may only revoke/resend invitations for strictly-lower roles
   * (Technician/Viewer). Owner-created Admin invitations are Owner-only.
   */
  private assertActorCanManage(actorRole: Role, invitation: { role: Role }): void {
    if (actorRole === 'Admin' && invitation.role !== 'Technician' && invitation.role !== 'Viewer') {
      this.events.log('organization_invitation_manage_denied', {
        reason: `actor=Admin targetRole=${invitation.role}`,
      });
      throw new ForbiddenException(
        'Admins can only manage Technician and Viewer invitations',
      );
    }
  }

  /**
   * Development-only invitation link. The raw token is returned exactly once to
   * an authorized inviter so the V1 local certification flow can proceed without
   * a mail provider; it is never exposed through list APIs and never persisted.
   *
   * The link always targets the WEB application (WEB_APP_URL), never the API
   * gateway origin — opening it must render the /invite/[token] page.
   */
  private devLinkFor(
    rawToken: string,
    origin: string,
  ): { devInvitationUrl?: string } {
    if (process.env.NODE_ENV === 'production') {
      return {};
    }
    return { devInvitationUrl: `${getWebAppBaseUrl(origin)}/invite/${rawToken}` };
  }
}
