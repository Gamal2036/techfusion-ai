'use client';

/**
 * V1-RBAC-01 client-side permission mirror.
 *
 * UX-only convenience: this mirror drives navigation and button visibility.
 * The backend PermissionsGuard remains the authoritative enforcer — the UI
 * mirror must never be relied on for security. Keep the catalog and matrix in
 * sync with apps/api-gateway/src/common/permissions.ts.
 */

import type { JwtPayload } from '@/lib/auth-client';

export const Permission = {
  ORGANIZATION_VIEW: 'organization:view',
  ORGANIZATION_UPDATE: 'organization:update',
  ORGANIZATION_SETTINGS: 'organization:settings',

  MEMBERS_VIEW: 'members:view',
  MEMBERS_MANAGE: 'members:manage',
  MEMBERS_REMOVE: 'members:remove',

  DEVICES_VIEW: 'devices:view',
  DEVICES_ENROLL: 'devices:enroll',
  DEVICES_MANAGE: 'devices:manage',

  MONITORING_VIEW: 'monitoring:view',

  ALERTS_VIEW: 'alerts:view',
  ALERTS_ACKNOWLEDGE: 'alerts:acknowledge',
  ALERTS_RESOLVE: 'alerts:resolve',
  ALERT_RULES_MANAGE: 'alert_rules:manage',

  SECURITY_VIEW: 'security:view',
  SECURITY_SCAN_TRIGGER: 'security:scan_trigger',

  NETWORK_VIEW: 'network:view',
  NETWORK_SCAN_TRIGGER: 'network:scan_trigger',

  REMOTE_SUPPORT_VIEW: 'remote_support:view',
  REMOTE_SUPPORT_START: 'remote_support:start',
  REMOTE_SUPPORT_CONTROL: 'remote_support:control',

  INVENTORY_VIEW: 'inventory:view',

  SOFTWARE_VIEW: 'software:view',
  SOFTWARE_MANAGE: 'software:manage',

  BACKUPS_VIEW: 'backups:view',
  BACKUPS_RUN: 'backups:run',
  BACKUPS_MANAGE: 'backups:manage',

  REPORTS_VIEW: 'reports:view',
  REPORTS_CREATE: 'reports:create',
  REPORTS_MANAGE: 'reports:manage',

  AUDIT_VIEW: 'audit:view',

  BILLING_VIEW: 'billing:view',
  BILLING_MANAGE: 'billing:manage',
} as const;

export type ClientPermission = (typeof Permission)[keyof typeof Permission];

export type ClientRole = 'Owner' | 'Admin' | 'Technician' | 'Viewer';

const ROLE_PERMISSIONS: Record<ClientRole, ReadonlySet<ClientPermission>> = {
  Owner: new Set<ClientPermission>(Object.values(Permission)),

  Admin: new Set<ClientPermission>([
    Permission.ORGANIZATION_VIEW,
    Permission.ORGANIZATION_SETTINGS,
    Permission.MEMBERS_VIEW,
    Permission.MEMBERS_MANAGE,
    Permission.DEVICES_VIEW,
    Permission.DEVICES_ENROLL,
    Permission.DEVICES_MANAGE,
    Permission.MONITORING_VIEW,
    Permission.ALERTS_VIEW,
    Permission.ALERTS_ACKNOWLEDGE,
    Permission.ALERTS_RESOLVE,
    Permission.ALERT_RULES_MANAGE,
    Permission.SECURITY_VIEW,
    Permission.SECURITY_SCAN_TRIGGER,
    Permission.NETWORK_VIEW,
    Permission.NETWORK_SCAN_TRIGGER,
    Permission.REMOTE_SUPPORT_VIEW,
    Permission.REMOTE_SUPPORT_START,
    Permission.REMOTE_SUPPORT_CONTROL,
    Permission.INVENTORY_VIEW,
    Permission.SOFTWARE_VIEW,
    Permission.SOFTWARE_MANAGE,
    Permission.BACKUPS_VIEW,
    Permission.BACKUPS_RUN,
    Permission.BACKUPS_MANAGE,
    Permission.REPORTS_VIEW,
    Permission.REPORTS_CREATE,
    Permission.REPORTS_MANAGE,
    Permission.AUDIT_VIEW,
    Permission.BILLING_VIEW,
  ]),

  Technician: new Set<ClientPermission>([
    Permission.ORGANIZATION_VIEW,
    Permission.MEMBERS_VIEW,
    Permission.DEVICES_VIEW,
    Permission.DEVICES_MANAGE,
    Permission.MONITORING_VIEW,
    Permission.ALERTS_VIEW,
    Permission.ALERTS_ACKNOWLEDGE,
    Permission.ALERTS_RESOLVE,
    Permission.SECURITY_VIEW,
    Permission.SECURITY_SCAN_TRIGGER,
    Permission.NETWORK_VIEW,
    Permission.NETWORK_SCAN_TRIGGER,
    Permission.REMOTE_SUPPORT_VIEW,
    Permission.REMOTE_SUPPORT_START,
    Permission.REMOTE_SUPPORT_CONTROL,
    Permission.INVENTORY_VIEW,
    Permission.SOFTWARE_VIEW,
    Permission.SOFTWARE_MANAGE,
    Permission.BACKUPS_VIEW,
    Permission.BACKUPS_RUN,
    Permission.REPORTS_VIEW,
    Permission.REPORTS_CREATE,
    Permission.BILLING_VIEW,
  ]),

  Viewer: new Set<ClientPermission>([
    Permission.ORGANIZATION_VIEW,
    Permission.DEVICES_VIEW,
    Permission.MONITORING_VIEW,
    Permission.ALERTS_VIEW,
    Permission.SECURITY_VIEW,
    Permission.NETWORK_VIEW,
    Permission.REMOTE_SUPPORT_VIEW,
    Permission.INVENTORY_VIEW,
    Permission.SOFTWARE_VIEW,
    Permission.BACKUPS_VIEW,
    Permission.REPORTS_VIEW,
    Permission.BILLING_VIEW,
  ]),
};

/**
 * UX-only capability check against the JWT role snapshot. Requires ALL listed
 * permissions (AND). Returns false for unauthenticated users.
 */
export function can(
  user: JwtPayload | null,
  ...permissions: ClientPermission[]
): boolean {
  if (!user) return false;
  const allowed = ROLE_PERMISSIONS[user.role];
  if (!allowed) return false;
  return permissions.every((p) => allowed.has(p));
}

/** UX-only capability check for a bare role string. */
export function canRole(
  role: ClientRole | undefined | null,
  ...permissions: ClientPermission[]
): boolean {
  if (!role) return false;
  const allowed = ROLE_PERMISSIONS[role];
  if (!allowed) return false;
  return permissions.every((p) => allowed.has(p));
}
