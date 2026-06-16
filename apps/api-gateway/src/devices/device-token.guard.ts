import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DeviceTokenGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'] as string | undefined;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid device token');
    }

    const token = authHeader.slice(7);

    const device = await this.prisma.device.findUnique({
      where: { deviceToken: token },
    });

    if (!device) {
      throw new UnauthorizedException('Invalid device token');
    }

    request.device = device;
    request.orgId = device.orgId;
    return true;
  }
}
