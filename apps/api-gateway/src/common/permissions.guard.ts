import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { hasAllPermissions, PermissionType } from './permissions';
import { createStructuredLogger } from './structured-logger';
import { Role } from '@prisma/client';

/**
 * Centralized PermissionsGuard (V1-RBAC-01).
 *
 * Reads the permission metadata declared with @RequirePermissions and checks the
 * centralized role → permission matrix using the membership-authoritative role
 * already resolved onto `req.user` by CombinedAuthGuard (ORG-01A3). No database
 * lookup happens here: the role is the live OrganizationMember role.
 *
 * - Endpoint with a permission decorator → denied with 403 when the role lacks
 *   the permission.
 * - Endpoint without a decorator → authentication behavior is unchanged and the
 *   guard returns true (it never widens an endpoint to public).
 *
 * The guard runs as a global APP_GUARD registered after CombinedAuthGuard.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly events = createStructuredLogger('Permissions');

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<PermissionType[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as { sub?: string; orgId?: string; role?: Role } | undefined;

    if (!user || !user.role) {
      // CombinedAuthGuard always sets a user before this guard runs; a missing
      // principal here means the auth layer was bypassed, which must never be
      // silently treated as "authorized".
      throw new ForbiddenException('Authentication required');
    }

    if (!hasAllPermissions(user.role, requiredPermissions)) {
      this.events.warn('rbac_permission_denied', {
        event: 'rbac_permission_denied',
        userId: user.sub,
        orgId: user.orgId,
        reason: `role=${user.role} missing_permissions:${requiredPermissions.join(',')}`,
        route: `${context.getClass().name}.${context.getHandler().name}`,
      });
      throw new ForbiddenException('You do not have permission to perform this action');
    }

    return true;
  }
}
