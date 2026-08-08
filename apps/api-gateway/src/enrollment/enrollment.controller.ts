import { Controller, Post, Get, Delete, Patch, Param, Body, Req, HttpCode } from '@nestjs/common';
import { EnrollmentService } from './enrollment.service';
import { CreateEnrollmentTokenDto } from './dto/create-enrollment-token.dto';
import { RequirePermissions } from '../common/permissions.decorator';
import { Permission } from '../common/permissions';

@Controller('enrollment')
export class EnrollmentController {
  constructor(private enrollmentService: EnrollmentService) {}

  @RequirePermissions(Permission.DEVICES_ENROLL)
  @Post('tokens')
  async createToken(@Req() req: any, @Body() dto: CreateEnrollmentTokenDto) {
    return this.enrollmentService.createToken(
      req.user.orgId,
      dto.label,
      dto.maxUses,
      dto.expiresAt,
      req.user.sub,
      { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
    );
  }

  @RequirePermissions(Permission.DEVICES_ENROLL)
  @Get('tokens')
  async listTokens(@Req() req: any) {
    return this.enrollmentService.listTokens(req.user.orgId);
  }

  @RequirePermissions(Permission.DEVICES_ENROLL)
  @Delete('tokens/:id')
  @HttpCode(204)
  async revokeToken(@Req() req: any, @Param('id') id: string) {
    await this.enrollmentService.revokeToken(
      id,
      req.user.orgId,
      req.user.sub,
      { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
    );
  }

  @RequirePermissions(Permission.DEVICES_ENROLL)
  @Patch('tokens/:id/regenerate')
  async regenerateToken(@Req() req: any, @Param('id') id: string) {
    return this.enrollmentService.regenerateToken(
      id,
      req.user.orgId,
      req.user.sub,
      { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
    );
  }

  @RequirePermissions(Permission.AUDIT_VIEW)
  @Get('audit')
  async getAuditLogs(@Req() req: any) {
    return this.enrollmentService.getAuditLogs(req.user.orgId);
  }
}
