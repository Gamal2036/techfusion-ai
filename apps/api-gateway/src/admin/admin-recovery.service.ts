import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getRequestId, getCorrelationId } from '../common/correlation-id';
import { createStructuredLogger } from '../common/structured-logger';

export const REVOKE_ACTION = 'device_revoked';
export const DEVICE_NOT_FOUND_CODE = 'DEVICE_NOT_FOUND';
export const AMBIGUOUS_IDENTITY_CODE = 'AMBIGUOUS_DEVICE_IDENTITY';

const REVOKE_SCAN_CANCEL_ERROR = 'Cancelled — device credential revoked';

export interface RevokeAndUnlinkInput {
  deviceId?: string;
  identityFingerprint?: string;
  installationId?: string;
  reason?: string;
  actorId: string;
  request?: { ipAddress?: string; userAgent?: string };
}

/**
 * DEV-REV-01 — Administrative/support stale-device recovery.
 *
 * Cross-organization recovery operation restricted to the trusted support
 * boundary (SupportAdminGuard; never reachable by an organization Owner or a
 * normal membership principal). Identifies a Device globally by deviceId
 * (preferred), identityFingerprint, or installationId — never by a plaintext
 * credential — and:
 *
 *  1. revokes the stored credential (revokedAt set, inactive, presence record
 *     terminated) so the old credential is IMMEDIATELY invalid;
 *  2. fails pending network and security scans;
 *  3. terminates active/pending remote sessions;
 *  4. records a structured audit event (actorId, deviceId, previous
 *     organizationId, action, timestamp, reason, requestId/correlationId);
 *  5. never logs credential hashes or plaintext credentials.
 *
 * The operation is idempotent: revoking an already-revoked device succeeds and
 * reports `alreadyRevoked`. The deviceTokenHash verifier is retained so the
 * revoked credential remains identifiable, but it can never authenticate again
 * while revokedAt is set.
 *
 * No per-device enrollment token exists in the schema (EnrollmentToken is
 * org-scoped only), so there is no recovery-workflow token to invalidate;
 * generic org enrollment tokens are deliberately left untouched.
 */
@Injectable()
export class AdminRecoveryService {
  private readonly logger = new Logger(AdminRecoveryService.name);
  private readonly events = createStructuredLogger('DeviceRecovery');

  constructor(private prisma: PrismaService) {}

  async revokeAndUnlink(input: RevokeAndUnlinkInput) {
    if (!input.actorId) {
      throw new UnauthorizedException('Support authorization required');
    }

    const device = await this.locateDevice(input);
    const orgId = device.orgId;
    const reason = (input.reason ?? '').trim() || 'stale device recovery';
    const now = new Date();

    const outcome = await this.prisma.$transaction(async (tx) => {
      // Idempotent conditional revocation: only a not-yet-revoked device is
      // transitioned; a repeated call matches zero rows and reports it.
      const revokedUpdate = await tx.device.updateMany({
        where: { id: device.id, revokedAt: null },
        data: {
          revokedAt: now,
          revokedReason: reason,
          inactive: true,
          lastSeenAt: null,
        },
      });
      const alreadyRevoked = revokedUpdate.count === 0;

      // Cancel/fail pending device work — network discovery commands and
      // security scan commands still awaiting the (now revoked) agent.
      const cancelledNetwork = await tx.networkScan.updateMany({
        where: { orgId, deviceId: device.id, status: { in: ['pending', 'running'] } },
        data: { status: 'failed', error: REVOKE_SCAN_CANCEL_ERROR, completedAt: now },
      });
      const cancelledSecurity = await tx.securityScan.updateMany({
        where: { orgId, deviceId: device.id, status: { in: ['pending', 'running'] } },
        data: { status: 'failed', error: REVOKE_SCAN_CANCEL_ERROR, completedAt: now },
      });

      // Terminate active device sessions.
      const terminatedSessions = await tx.remoteSession.updateMany({
        where: { orgId, deviceId: device.id, status: { in: ['pending', 'active'] } },
        data: { status: 'ended', endedAt: now },
      });

      const current = await tx.device.findUnique({ where: { id: device.id } });

      // Structured audit event. Contains NO credential material: no plaintext
      // token and no credential hash (hashes are never logged per DEV-REV-01).
      const audit = await tx.auditLog.create({
        data: {
          orgId,
          action: REVOKE_ACTION,
          actorId: input.actorId,
          targetId: device.id,
          details: {
            deviceId: device.id,
            previousOrganizationId: orgId,
            action: REVOKE_ACTION,
            reason,
            requestId: getRequestId() ?? null,
            correlationId: getCorrelationId() ?? null,
            identifiersProvided: {
              deviceId: input.deviceId ?? null,
              identityFingerprint: input.identityFingerprint ?? null,
              installationId: input.installationId ?? null,
            },
            lastSeenAtAtRevocation: device.lastSeenAt
              ? device.lastSeenAt.toISOString()
              : null,
            credentialRevoked: true,
          },
          ipAddress: input.request?.ipAddress ?? null,
          userAgent: input.request?.userAgent ?? null,
        },
      });

      return {
        alreadyRevoked,
        revokedAt: current?.revokedAt ?? null,
        cancelledNetwork: cancelledNetwork.count,
        cancelledSecurity: cancelledSecurity.count,
        terminatedSessions: terminatedSessions.count,
        auditId: audit.id,
      };
    });

    this.events.log('device_revoked', {
      event: 'device_revoked',
      deviceId: device.id,
      orgId,
      reason,
      alreadyRevoked: outcome.alreadyRevoked,
    });

    return {
      deviceId: device.id,
      organizationId: orgId,
      action: REVOKE_ACTION,
      revokedAt: outcome.revokedAt,
      alreadyRevoked: outcome.alreadyRevoked,
      pendingNetworkScansCancelled: outcome.cancelledNetwork,
      pendingSecurityScansCancelled: outcome.cancelledSecurity,
      activeRemoteSessionsTerminated: outcome.terminatedSessions,
      auditEventId: outcome.auditId,
    };
  }

  private async locateDevice(input: RevokeAndUnlinkInput) {
    if (input.deviceId) {
      const device = await this.prisma.device.findUnique({
        where: { id: input.deviceId },
      });
      if (!device) {
        throw new NotFoundException({
          message: 'Device not found',
          error: 'Not Found',
          code: DEVICE_NOT_FOUND_CODE,
        });
      }
      return device;
    }

    if (input.identityFingerprint) {
      return this.locateByIdentityField('identityFingerprint', input.identityFingerprint);
    }

    if (input.installationId) {
      return this.locateByIdentityField('installationId', input.installationId);
    }

    throw new BadRequestException({
      message: 'At least one of deviceId, identityFingerprint, or installationId is required',
      error: 'Bad Request',
      code: 'IDENTIFIER_REQUIRED',
    });
  }

  private async locateByIdentityField(
    field: 'identityFingerprint' | 'installationId',
    value: string,
  ) {
    const matches = await this.prisma.device.findMany({
      where: { [field]: value },
      take: 2,
      orderBy: { registeredAt: 'asc' },
    });
    if (matches.length === 0) {
      throw new NotFoundException({
        message: 'Device not found',
        error: 'Not Found',
        code: DEVICE_NOT_FOUND_CODE,
      });
    }
    if (matches.length > 1) {
      // The same physical identity may legitimately exist in multiple
      // organizations; never guess which one to revoke.
      throw new BadRequestException({
        message: 'Multiple devices match the provided identity; retry with deviceId',
        error: 'Bad Request',
        code: AMBIGUOUS_IDENTITY_CODE,
      });
    }
    return matches[0];
  }
}
