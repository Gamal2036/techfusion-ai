import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      return false;
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
