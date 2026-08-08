import {
  Permission,
  PermissionType,
  ALL_PERMISSIONS,
  ROLES,
  ROLE_PERMISSIONS,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
} from './permissions';
import { Role } from '@prisma/client';

/**
 * V1-RBAC-01 permission catalog + role → permission matrix tests.
 *
 * These tests pin the V1 policy surface: the exact permission catalog and the
 * exact capabilities of the four fixed roles (Owner / Admin / Technician /
 * Viewer). Changing the matrix is a product decision and must be reflected
 * here first.
 */

describe('V1 permission catalog', () => {
  it('defines exactly the four fixed roles', () => {
    expect(ROLES).toEqual(['Owner', 'Admin', 'Technician', 'Viewer']);
  });

  it('uses unique, namespaced <domain>:<action> identifiers', () => {
    const values = [...new Set(ALL_PERMISSIONS)];
    expect(values.length).toBe(ALL_PERMISSIONS.length);
    for (const permission of ALL_PERMISSIONS) {
      expect(permission).toMatch(/^[a-z_]+:[a-z_]+$/);
    }
  });

  it('keeps the V1 catalog within 20-35 permissions', () => {
    expect(ALL_PERMISSIONS.length).toBeGreaterThanOrEqual(20);
    expect(ALL_PERMISSIONS.length).toBeLessThanOrEqual(35);
  });

  it('defines a permission set for every role', () => {
    for (const role of ROLES) {
      expect(ROLE_PERMISSIONS[role]).toBeInstanceOf(Set);
      expect(ROLE_PERMISSIONS[role].size).toBeGreaterThan(0);
    }
  });
});

describe('Owner', () => {
  it('has every permission in the catalog', () => {
    for (const permission of ALL_PERMISSIONS) {
      expect(hasPermission('Owner', permission)).toBe(true);
    }
  });
});

describe('Admin', () => {
  const OWNER_ONLY: PermissionType[] = [
    Permission.ORGANIZATION_UPDATE,
    Permission.MEMBERS_REMOVE,
    Permission.BILLING_MANAGE,
  ];

  it('has all permissions except the Owner-only lifecycle powers', () => {
    for (const permission of ALL_PERMISSIONS) {
      if (OWNER_ONLY.includes(permission)) {
        expect(hasPermission('Admin', permission)).toBe(false);
      } else {
        expect(hasPermission('Admin', permission)).toBe(true);
      }
    }
  });
});

describe('Technician', () => {
  it('is a subset of Admin capabilities', () => {
    for (const permission of ALL_PERMISSIONS) {
      if (hasPermission('Technician', permission)) {
        expect(hasPermission('Admin', permission)).toBe(true);
      }
    }
  });

  it('has operational capabilities but not settings/owner powers', () => {
    expect(hasPermission('Technician', Permission.DEVICES_MANAGE)).toBe(true);
    expect(hasPermission('Technician', Permission.SECURITY_SCAN_TRIGGER)).toBe(true);
    expect(hasPermission('Technician', Permission.NETWORK_SCAN_TRIGGER)).toBe(true);
    expect(hasPermission('Technician', Permission.REMOTE_SUPPORT_CONTROL)).toBe(true);
    expect(hasPermission('Technician', Permission.REMOTE_SUPPORT_START)).toBe(true);
    expect(hasPermission('Technician', Permission.ALERTS_ACKNOWLEDGE)).toBe(true);
    expect(hasPermission('Technician', Permission.ALERTS_RESOLVE)).toBe(true);
    expect(hasPermission('Technician', Permission.BACKUPS_RUN)).toBe(true);
    expect(hasPermission('Technician', Permission.REPORTS_CREATE)).toBe(true);

    expect(hasPermission('Technician', Permission.ORGANIZATION_UPDATE)).toBe(false);
    expect(hasPermission('Technician', Permission.ORGANIZATION_SETTINGS)).toBe(false);
    expect(hasPermission('Technician', Permission.MEMBERS_MANAGE)).toBe(false);
    expect(hasPermission('Technician', Permission.MEMBERS_REMOVE)).toBe(false);
    expect(hasPermission('Technician', Permission.DEVICES_ENROLL)).toBe(false);
    expect(hasPermission('Technician', Permission.ALERT_RULES_MANAGE)).toBe(false);
    expect(hasPermission('Technician', Permission.BACKUPS_MANAGE)).toBe(false);
    expect(hasPermission('Technician', Permission.REPORTS_MANAGE)).toBe(false);
    expect(hasPermission('Technician', Permission.AUDIT_VIEW)).toBe(false);
    expect(hasPermission('Technician', Permission.BILLING_MANAGE)).toBe(false);
  });
});

describe('Viewer', () => {
  it('is read-only across the product domains plus billing view', () => {
    const readOnlyViews = [
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
    ];
    for (const permission of readOnlyViews) {
      expect(hasPermission('Viewer', permission)).toBe(true);
    }
  });

  it('is server-enforced read-only: every non-read capability is denied', () => {
    const mutatingOrManagePermissions = [
      Permission.ORGANIZATION_UPDATE,
      Permission.ORGANIZATION_SETTINGS,
      Permission.MEMBERS_VIEW,
      Permission.MEMBERS_MANAGE,
      Permission.MEMBERS_REMOVE,
      Permission.DEVICES_ENROLL,
      Permission.DEVICES_MANAGE,
      Permission.ALERTS_ACKNOWLEDGE,
      Permission.ALERTS_RESOLVE,
      Permission.ALERT_RULES_MANAGE,
      Permission.SECURITY_SCAN_TRIGGER,
      Permission.NETWORK_SCAN_TRIGGER,
      Permission.REMOTE_SUPPORT_START,
      Permission.REMOTE_SUPPORT_CONTROL,
      Permission.SOFTWARE_MANAGE,
      Permission.BACKUPS_RUN,
      Permission.BACKUPS_MANAGE,
      Permission.REPORTS_CREATE,
      Permission.REPORTS_MANAGE,
      Permission.AUDIT_VIEW,
      Permission.BILLING_MANAGE,
    ];
    for (const permission of mutatingOrManagePermissions) {
      expect(hasPermission('Viewer', permission)).toBe(false);
    }
  });

  it('is a subset of Technician capabilities', () => {
    for (const permission of ALL_PERMISSIONS) {
      if (hasPermission('Viewer', permission)) {
        expect(hasPermission('Technician', permission)).toBe(true);
      }
    }
  });
});

describe('permission helpers', () => {
  it('hasPermission returns false for unknown roles', () => {
    expect(hasPermission('SuperAdmin' as Role, Permission.DEVICES_VIEW)).toBe(false);
  });

  it('hasAllPermissions requires every listed permission (AND)', () => {
    expect(hasAllPermissions('Owner', [Permission.DEVICES_VIEW, Permission.MEMBERS_REMOVE])).toBe(true);
    expect(hasAllPermissions('Admin', [Permission.DEVICES_VIEW, Permission.MEMBERS_REMOVE])).toBe(false);
    expect(hasAllPermissions('Viewer', [Permission.DEVICES_VIEW])).toBe(true);
    expect(hasAllPermissions('Viewer', [Permission.DEVICES_VIEW, Permission.ALERTS_RESOLVE])).toBe(false);
  });

  it('hasAnyPermission allows any listed permission (OR)', () => {
    expect(hasAnyPermission('Viewer', [Permission.DEVICES_VIEW, Permission.ALERTS_RESOLVE])).toBe(true);
    expect(hasAnyPermission('Viewer', [Permission.MEMBERS_REMOVE, Permission.BILLING_MANAGE])).toBe(false);
  });

  it('every declared permission is present in the catalog type', () => {
    const catalog = new Set<string>(ALL_PERMISSIONS as readonly string[]);
    for (const key of Object.keys(Permission) as Array<keyof typeof Permission>) {
      expect(catalog.has(Permission[key] as string)).toBe(true);
    }
  });
});
