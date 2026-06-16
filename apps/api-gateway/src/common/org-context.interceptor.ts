import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrgContextInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const orgId = request.user?.orgId;
    if (orgId) {
      this.prisma.$executeRawUnsafe(`SELECT set_config('app.current_org_id', $1, true)`, orgId);
    }
    return next.handle();
  }
}
