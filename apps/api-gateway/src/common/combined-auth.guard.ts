import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { IS_PUBLIC_KEY } from './public.decorator';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class CombinedAuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
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
    let user: any;
    try {
      const secret = process.env.JWT_SECRET || 'dev-secret-change-in-production-abc123';
      user = jwt.verify(token, secret);
      request.user = user;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const roleHierarchy: Record<string, number> = {
      Owner: 4,
      Admin: 3,
      Technician: 2,
      Viewer: 1,
    };
    const userLevel = roleHierarchy[user.role] ?? 0;
    const minLevel = Math.min(...requiredRoles.map((r) => roleHierarchy[r] ?? 0));
    if (userLevel < minLevel) {
      throw new ForbiddenException('Insufficient role permissions');
    }
    return true;
  }
}
