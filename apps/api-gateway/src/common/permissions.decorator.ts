import { SetMetadata } from '@nestjs/common';
import { PermissionType } from './permissions';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Declares the permissions required to run a handler (or an entire controller).
 *
 * Semantics: ALL listed permissions are required (logical AND). When no
 * decorator is present the endpoint stays authenticated-only — it is never
 * implicitly public — but no permission check is applied.
 *
 * @example
 * @RequirePermissions(Permission.DEVICES_VIEW)
 * @RequirePermissions(Permission.MEMBERS_MANAGE)
 */
export const RequirePermissions = (...permissions: PermissionType[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
