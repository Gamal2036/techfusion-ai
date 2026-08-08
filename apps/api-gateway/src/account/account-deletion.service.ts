import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { createStructuredLogger } from '../common/structured-logger';

const DELETE_CONFIRMATION = 'DELETE';

export type DeletionBlockerReason = 'SOLE_OWNER';

export interface DeletionBlocker {
  organizationId: string;
  organizationName: string;
  reason: DeletionBlockerReason;
}

export interface DeletionPreview {
  canDelete: boolean;
  blockers: DeletionBlocker[];
  membershipsCount: number;
  ownedOrganizationsCount: number;
  /** Organizations that would be hard-deleted together with the account because
   *  they are provably empty personal organizations. */
  emptyOrganizationsToRemove: { organizationId: string; organizationName: string }[];
}

type DbClient = PrismaService | Prisma.TransactionClient;

/**
 * V1-STAGE-00A — Delete My Account.
 *
 * The endpoint operates exclusively on the authenticated user (req.user.sub).
 * A body-supplied userId is never consulted. Ownership safety is proven inside
 * the deletion transaction: an account that is the sole Owner of any
 * organization that must continue to exist (non-empty, or shared) cannot be
 * deleted. Organizations that are provably empty AND solely owned by the user
 * may be hard-deleted together with the account.
 *
 * No migration is required: every reference from the User model is either a
 * cascade relation (RefreshToken, OrganizationMember) or a plain string column
 * with no FK (AuditLog.actorId, OrganizationInvitation.invitedByUserId,
 * EnrollmentToken.createdByUserId, RemoteSession.technicianId,
 * Report.createdBy, SecurityScan.triggeredBy) that safely outlives the account.
 */
@Injectable()
export class AccountDeletionService {
  private readonly events = createStructuredLogger('Account');

  constructor(private prisma: PrismaService) {}

  // ─── Preview / eligibility ─────────────────────────────────────

  /**
   * GET /auth/account/deletion-preview
   *
   * Returns only data scoped to the caller's own memberships. No unrelated
   * tenant details are exposed. Blockers identify the organizations the user
   * is the sole Owner of that must be kept alive.
   */
  async previewDeletion(userId: string): Promise<DeletionPreview> {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      include: { org: { select: { id: true, name: true } } },
    });

    const blockers: DeletionBlocker[] = [];
    const emptyOrganizationsToRemove: DeletionPreview['emptyOrganizationsToRemove'] = [];

    for (const membership of memberships) {
      if (membership.role !== 'Owner') continue;
      const ownerCount = await this.prisma.organizationMember.count({
        where: { orgId: membership.orgId, role: 'Owner' },
      });
      if (ownerCount <= 1) {
        if (await this.isEmptyOrganization(this.prisma, membership.orgId, userId)) {
          emptyOrganizationsToRemove.push({
            organizationId: membership.orgId,
            organizationName: membership.org.name,
          });
        } else {
          blockers.push({
            organizationId: membership.orgId,
            organizationName: membership.org.name,
            reason: 'SOLE_OWNER',
          });
        }
      }
    }

    return {
      canDelete: blockers.length === 0,
      blockers,
      membershipsCount: memberships.length,
      ownedOrganizationsCount: memberships.filter((m) => m.role === 'Owner').length,
      emptyOrganizationsToRemove,
    };
  }

  // ─── Deletion ───────────────────────────────────────────────────

  /**
   * DELETE /auth/account
   *
   * Transactional, idempotent, and ownership-safe:
   *
   * 1. verify the explicit confirmation value
   * 2. verify ownership safety (sole Owner of a non-empty/shared org → blocked)
   * 3. write org-scoped audit history
   * 4. revoke every refresh session
   * 5. revoke pending invitations addressed to the account email
   * 6. remove all memberships
   * 7. hard-delete provably-empty solely-owned organizations
   * 8. delete the User row
   *
   * Any failure rolls back the whole transaction — a blocked or failed deletion
   * never leaves half-deleted state. A body-supplied userId is never trusted.
   */
  async deleteAccount(userId: string, confirmation: string) {
    if (confirmation !== DELETE_CONFIRMATION) {
      this.events.log('account_deletion_requested', { userId, reason: 'invalid_confirmation' });
      throw new BadRequestException('confirmation must be exactly "DELETE"');
    }
    this.events.log('account_deletion_requested', { userId });

    const outcome = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) {
        // Idempotent: the account no longer exists. The auth guard rejects the
        // request before this point once memberships are gone; this branch is a
        // defensive final answer for a raced call.
        throw new NotFoundException('Account not found');
      }

      const memberships = await tx.organizationMember.findMany({
        where: { userId },
        include: { org: { select: { id: true, name: true } } },
      });

      const blockers: DeletionBlocker[] = [];
      const removableOrgs: { id: string; name: string }[] = [];

      for (const membership of memberships) {
        if (membership.role !== 'Owner') continue;
        const ownerCount = await tx.organizationMember.count({
          where: { orgId: membership.orgId, role: 'Owner' },
        });
        if (ownerCount <= 1) {
          if (await this.isEmptyOrganization(tx, membership.orgId, userId)) {
            removableOrgs.push({ id: membership.orgId, name: membership.org.name });
          } else {
            blockers.push({
              organizationId: membership.orgId,
              organizationName: membership.org.name,
              reason: 'SOLE_OWNER',
            });
          }
        }
      }

      if (blockers.length > 0) {
        return { blocked: blockers, removedOrganizations: [] as string[] };
      }

      const removableOrgIds = new Set(removableOrgs.map((o) => o.id));

      // Preserve organization-owned history in orgs that survive. AuditLog.actorId
      // is a plain string column (no FK) so rows survive the account deletion and
      // read back as a deleted actor in org-scoped audit queries. Orgs removed
      // under the empty-org policy have no audit history by definition.
      const now = new Date();
      for (const membership of memberships) {
        if (removableOrgIds.has(membership.orgId)) continue;
        await tx.auditLog.create({
          data: {
            orgId: membership.orgId,
            action: 'account_deleted',
            actorId: userId,
            details: { event: 'account_deletion', scope: 'user' },
            createdAt: now,
          },
        });
      }

      // Remove every stored refresh session for the account. The rows are
      // deleted rather than merely revoked because the account itself is
      // removed; the RefreshToken onDelete Cascade would do this anyway.
      await tx.refreshToken.deleteMany({ where: { userId } });

      // Revoke pending invitations addressed to the deleted account email.
      await tx.organizationInvitation.updateMany({
        where: { email: user.email, status: 'PENDING' },
        data: { status: 'REVOKED', updatedAt: now },
      });

      // Remove all memberships. Invitations created BY the user are preserved:
      // invitedByUserId has no FK and acceptance is bound to the invitee email,
      // so an invitation does not become invalid because the inviter vanished.
      await tx.organizationMember.deleteMany({ where: { userId } });

      // Delete the account BEFORE hard-deleting empty personal orgs: User.orgId
      // references the default org with an onDelete Restrict constraint, so the
      // reference must be gone first.
      await tx.user.delete({ where: { id: userId } });

      // Hard-delete provably-empty personal organizations. Every other
      // Organization relation is DB-restricted (onDelete Restrict), so this
      // delete is refused by the database if any child row remains, rolling the
      // whole transaction back safely.
      for (const org of removableOrgs) {
        await tx.organization.delete({ where: { id: org.id } });
      }

      return { blocked: null, removedOrganizations: removableOrgs.map((o) => o.id) };
    });

    if (outcome.blocked && outcome.blocked.length > 0) {
      this.events.log('account_deletion_blocked', {
        userId,
        reason: `sole_owner:${outcome.blocked.map((b) => b.organizationId).join(',')}`,
      });
      throw new ConflictException({
        message:
          'Account cannot be deleted. Assign another Owner before deleting your account.',
        blockers: outcome.blocked,
      });
    }

    this.events.log('account_deleted', { userId });
    return {
      message: 'Account deleted',
      removedOrganizations: outcome.removedOrganizations,
    };
  }

  // ─── Emptiness proof ────────────────────────────────────────────

  /**
   * A "genuinely empty" personal organization is the ONLY case where an
   * organization may be hard-deleted as part of account deletion. The rule is
   * never inferred from member count alone: every org-scoped child model is
   * counted, and the deletion is additionally guarded by the database's
   * onDelete Restrict constraints inside the transaction.
   *
   * An organization is deletable iff the user is its sole Owner AND there are:
   * - no other members
   * - no devices / metrics / health scores / credential rotations
   * - no alert rules or alerts
   * - no AI provider configs, usage logs, or conversations
   * - no security scans / findings / scores
   * - no network devices or scans
   * - no drivers or software inventory
   * - no backup jobs or runs
   * - no subscription / invoices
   * - no report template / reports / schedules
   * - no remote sessions
   * - no SSO config / retention policy
   * - no audit logs / KB articles / enrollment tokens
   * - no invitations
   * - no other User referencing the org as its default org
   */
  private async isEmptyOrganization(
    db: DbClient,
    orgId: string,
    userId: string,
  ): Promise<boolean> {
    const counts = await Promise.all([
      db.organizationMember.count({ where: { orgId, userId: { not: userId } } }),
      db.device.count({ where: { orgId } }),
      db.deviceMetric.count({ where: { orgId } }),
      db.deviceHealthScore.count({ where: { orgId } }),
      db.alertRule.count({ where: { orgId } }),
      db.alert.count({ where: { orgId } }),
      db.aiProviderConfig.count({ where: { orgId } }),
      db.aiUsageLog.count({ where: { orgId } }),
      db.aiConversation.count({ where: { orgId } }),
      db.securityScan.count({ where: { orgId } }),
      db.securityFinding.count({ where: { orgId } }),
      db.securityScore.count({ where: { orgId } }),
      db.networkDevice.count({ where: { orgId } }),
      db.networkScan.count({ where: { orgId } }),
      db.driver.count({ where: { orgId } }),
      db.softwareInventory.count({ where: { orgId } }),
      db.backupJob.count({ where: { orgId } }),
      db.backupRun.count({ where: { orgId } }),
      db.subscription.count({ where: { orgId } }),
      db.reportTemplate.count({ where: { orgId } }),
      db.report.count({ where: { orgId } }),
      db.reportSchedule.count({ where: { orgId } }),
      db.remoteSession.count({ where: { orgId } }),
      db.ssoConfig.count({ where: { orgId } }),
      db.dataRetentionPolicy.count({ where: { orgId } }),
      db.auditLog.count({ where: { orgId } }),
      db.kbArticle.count({ where: { orgId } }),
      db.enrollmentToken.count({ where: { orgId } }),
      db.credentialRotationEvent.count({ where: { orgId } }),
      db.organizationInvitation.count({ where: { organizationId: orgId } }),
      db.user.count({ where: { orgId, id: { not: userId } } }),
    ]);

    return counts.every((count) => count === 0);
  }
}
