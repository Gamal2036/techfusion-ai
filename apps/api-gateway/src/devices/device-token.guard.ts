import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class DeviceTokenGuard implements CanActivate {
  private readonly logger = new Logger(DeviceTokenGuard.name);

  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'] as string | undefined;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      if (process.env.NODE_ENV !== 'production') {
        this.logger.warn(
          `[DEV_DEVICE_AUTH] Rejected: authHeader present=${!!authHeader} scheme=${authHeader?.slice(0, 12) ?? 'none'}`
        );
      }
      throw new UnauthorizedException('Missing or invalid device token');
    }

    const token = authHeader.slice(7);

    if (process.env.NODE_ENV !== 'production') {
      this.logger.log(
        `[DEV_DEVICE_AUTH] Token received: length=${token.length} prefix=${token.slice(0, 4)}...`
      );
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Hash-only credential verification (S3). The plaintext Device.deviceToken
    // column no longer exists; a device authenticates ONLY when the SHA-256 of
    // the presented bearer matches the stored deviceTokenHash. Devices without a
    // verifier (or an unknown/malformed token) fail closed.
    const device = await this.prisma.device.findFirst({
      where: { deviceTokenHash: tokenHash },
    });

    if (!device) {
      if (process.env.NODE_ENV !== 'production') {
        const deviceCount = await this.prisma.device.count();
        this.logger.warn(
          `[DEV_DEVICE_AUTH] Rejected: no device found for hash prefix=${tokenHash.slice(0, 8)}... totalDevices=${deviceCount}`
        );
      }
      throw new UnauthorizedException('Invalid device token');
    }

    if (device.inactive) {
      if (process.env.NODE_ENV !== 'production') {
        this.logger.warn(
          `[DEV_DEVICE_AUTH] Rejected: device ${device.id} is inactive/disabled`
        );
      }
      throw new UnauthorizedException('Device is disabled');
    }

    request.device = device;
    request.orgId = device.orgId;

    if (process.env.NODE_ENV !== 'production') {
      this.logger.log(
        `[DEV_DEVICE_AUTH] Authenticated: deviceId=${device.id} hostname=${device.hostname} orgId=${device.orgId}`
      );
    }

    return true;
  }
}
