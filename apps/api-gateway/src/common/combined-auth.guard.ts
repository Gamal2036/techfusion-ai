import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { verifyAndValidateJwt, resolveMembershipUser } from './membership-auth';

/**
 * Global authentication guard (ORG-01A3). Verifies the JWT and resolves the
 * authenticated principal from the authoritative OrganizationMember row; the
 * membership role/org are copied onto `req.user` live. Role-based capability
 * enforcement is delegated to PermissionsGuard (V1-RBAC-01) which runs after
 * this guard and never re-queries the database.
 */
@Injectable()
export class CombinedAuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }
    const token = authHeader.slice(7);

    const payload = verifyAndValidateJwt(token);
    const user = await resolveMembershipUser(this.prisma, payload);
    request.user = user;
    return true;
  }
}
