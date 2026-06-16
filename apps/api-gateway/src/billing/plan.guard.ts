import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { PLAN_KEY, FEATURE_KEY } from '../common/plan.decorator';
import { getPlanConfig, meetsPlanRequirement, PLAN_HIERARCHY, PLAN_CONFIGS } from './plan-features';

@Injectable()
export class PlanGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPlan = this.reflector.getAllAndOverride<string>(PLAN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredFeature = this.reflector.getAllAndOverride<string>(FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPlan && !requiredFeature) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user?.orgId) {
      throw new ForbiddenException('No organization context');
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: user.orgId },
    });

    if (!org) {
      throw new ForbiddenException('Organization not found');
    }

    if (requiredPlan) {
      if (!meetsPlanRequirement(org.plan, requiredPlan)) {
        const planConfig = getPlanConfig(requiredPlan);
        throw new ForbiddenException(
          `This action requires the ${planConfig.label} plan or higher. ` +
          `Current plan: ${getPlanConfig(org.plan).label}`,
        );
      }
    }

    if (requiredFeature) {
      const planConfig = getPlanConfig(org.plan);
      if (!planConfig.features[requiredFeature as keyof typeof planConfig.features]) {
        throw new ForbiddenException(
          `Your current plan (${planConfig.label}) does not include: ${requiredFeature}. ` +
          `Upgrade to access this feature.`,
        );
      }
    }

    return true;
  }
}

export function getPlanLevel(plan: string): number {
  return PLAN_HIERARCHY[plan] ?? 0;
}

export function getEffectiveLimits(plan: string) {
  return getPlanConfig(plan).limits;
}
