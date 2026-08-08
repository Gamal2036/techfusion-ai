import { Role } from '@prisma/client';

/**
 * V1 Permission Catalog (V1-RBAC-01).
 *
 * The complete set of product-level capabilities for the four fixed roles
 * (Owner, Admin, Technician, Viewer). Permissions are static V1 product policy:
 * there is no Permission table, no RolePermission table and no custom-role
 * machinery in this version.
 *
 * Convention: "<domain>:<action>". Micro-permissions are intentionally avoided.
 */

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

export type PermissionType = (typeof Permission)[keyof typeof Permission];

export const ALL_PERMISSIONS: readonly PermissionType[] = Object.values(Permission);

export const ROLES: readonly Role[] = ['Owner', 'Admin', 'Technician', 'Viewer'];

/**
 * Centralized V1 role → permission matrix. Single source of truth for what each
 * of the four fixed roles may do. The membership-derived `req.user.role`
 * (ORG-01A3) is the only role value ever evaluated against this matrix.
 */
export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<PermissionType>> = {
  Owner: new Set<PermissionType>(ALL_PERMISSIONS),

  Admin: new Set<PermissionType>([
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

  Technician: new Set<PermissionType>([
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

  Viewer: new Set<PermissionType>([
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

export function hasPermission(role: Role, permission: PermissionType): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export function hasAnyPermission(role: Role, permissions: readonly PermissionType[]): boolean {
  const allowed = ROLE_PERMISSIONS[role];
  if (!allowed) return false;
  return permissions.some((p) => allowed.has(p));
}

export function hasAllPermissions(role: Role, permissions: readonly PermissionType[]): boolean {
  const allowed = ROLE_PERMISSIONS[role];
  if (!allowed) return false;
  return permissions.every((p) => allowed.has(p));
}
