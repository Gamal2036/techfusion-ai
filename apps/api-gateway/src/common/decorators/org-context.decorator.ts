import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const OrgContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.orgId || request.user?.orgId;
  },
);
