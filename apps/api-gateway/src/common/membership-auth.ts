import { UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import * as jwt from 'jsonwebtoken';

/**
 * The authenticated principal after membership resolution. The org/role values
 * come from the authoritative OrganizationMember row, never from the JWT.
 */
export interface AuthenticatedUser {
  sub: string;
  orgId: string;
  role: Role;
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new UnauthorizedException('JWT_SECRET environment variable is not configured');
  }
  return secret;
}

/**
 * Verifies a JWT and validates the identity claims required for membership
 * resolution. The JWT org/role claims are snapshot data only; the membership
 * row is the source of truth for organization access and role.
 */
export function verifyAndValidateJwt(token: string): jwt.JwtPayload {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as jwt.JwtPayload;
    if (typeof payload.sub !== 'string' || typeof payload.orgId !== 'string') {
      throw new UnauthorizedException('Invalid token payload');
    }
    return payload;
  } catch (err) {
    if (err instanceof UnauthorizedException) {
      throw err;
    }
    throw new UnauthorizedException('Invalid or expired token');
  }
}

/**
 * Resolves the verified JWT identity against the authoritative
 * OrganizationMember record. Throws UnauthorizedException when the user has no
 * membership for the token's organization, so revoked access is denied even
 * while the JWT is still cryptographically valid.
 */
export async function resolveMembershipUser(
  prisma: PrismaService,
  payload: { sub?: string; orgId?: string },
): Promise<AuthenticatedUser> {
  if (typeof payload.sub !== 'string' || typeof payload.orgId !== 'string') {
    throw new UnauthorizedException('Invalid token payload');
  }

  const membership = await prisma.organizationMember.findUnique({
    where: { userId_orgId: { userId: payload.sub, orgId: payload.orgId } },
  });

  if (!membership) {
    throw new UnauthorizedException('No active membership for this organization');
  }

  return { sub: payload.sub, orgId: membership.orgId, role: membership.role };
}
