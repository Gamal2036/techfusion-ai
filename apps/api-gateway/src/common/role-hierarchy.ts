import { Role } from '@prisma/client';

export const ROLE_HIERARCHY: Record<Role, number> = {
  Owner: 4,
  Admin: 3,
  Technician: 2,
  Viewer: 1,
};

export function hasMinimumRole(role: Role, minimum: Role): boolean {
  const level = ROLE_HIERARCHY[role] ?? 0;
  const required = ROLE_HIERARCHY[minimum] ?? 0;
  return level >= required;
}
