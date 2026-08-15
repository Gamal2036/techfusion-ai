import { Controller, Post, Param, Body, Req, UseGuards, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AdminRecoveryService } from './admin-recovery.service';
import { SupportAdminGuard } from './support-admin.guard';
import { RevokeDeviceDto } from './dto/revoke-device.dto';
import { Public } from '../common/public.decorator';
import { throttle } from '../config/rate-limits';

/**
 * DEV-REV-01 — Support-only stale-device recovery routes.
 *
 * Cross-organization recovery is restricted to the trusted support boundary
 * (SupportAdminGuard). These routes are @Public() to the normal membership JWT
 * flow ON PURPOSE: there is no system-level role, so the support key — never a
 * membership principal — is the sole authority. A normal Organization Owner
 * cannot reach them.
 */
@Controller('admin/devices')
export class AdminRecoveryController {
  constructor(private recoveryService: AdminRecoveryService) {}

  @Public()
  @UseGuards(SupportAdminGuard)
  @Throttle(throttle(5, 60000))
  @Post(':deviceId/revoke-and-unlink')
  async revokeByDeviceId(
    @Param('deviceId') deviceId: string,
    @Body() body: RevokeDeviceDto,
    @Req() req: any,
  ) {
    return this.recoveryService.revokeAndUnlink(this.inputFor(req, body, { deviceId }));
  }

  @Public()
  @UseGuards(SupportAdminGuard)
  @Throttle(throttle(5, 60000))
  @Post('revoke-and-unlink')
  async revokeByIdentifier(@Body() dto: RevokeDeviceDto, @Req() req: any) {
    return this.recoveryService.revokeAndUnlink(this.inputFor(req, dto));
  }

  private inputFor(req: any, dto: RevokeDeviceDto, extra?: { deviceId: string }) {
    const actorId = req?.supportAdmin?.subject as string | undefined;
    if (!actorId) {
      // Defense in depth: the guard always sets the principal; never proceed
      // without a verified support actor for audit attribution.
      throw new UnauthorizedException('Support authorization required');
    }
    return {
      deviceId: extra?.deviceId ?? dto.deviceId,
      identityFingerprint: dto.identityFingerprint,
      installationId: dto.installationId,
      reason: dto.reason,
      actorId,
      request: { ipAddress: req?.ip, userAgent: req?.headers?.['user-agent'] },
    };
  }
}
