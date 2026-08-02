import { Controller, Post, Get, Delete, Patch, Param, Body, Req, HttpCode } from '@nestjs/common';
import { EnrollmentService } from './enrollment.service';
import { CreateEnrollmentTokenDto } from './dto/create-enrollment-token.dto';
import { Roles } from '../common/roles.decorator';

@Controller('enrollment')
export class EnrollmentController {
  constructor(private enrollmentService: EnrollmentService) {}

  @Post('tokens')
  @Roles('Owner', 'Admin')
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

  @Get('tokens')
  @Roles('Owner', 'Admin')
  async listTokens(@Req() req: any) {
    return this.enrollmentService.listTokens(req.user.orgId);
  }

  @Delete('tokens/:id')
  @HttpCode(204)
  @Roles('Owner', 'Admin')
  async revokeToken(@Req() req: any, @Param('id') id: string) {
    await this.enrollmentService.revokeToken(
      id,
      req.user.orgId,
      req.user.sub,
      { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
    );
  }

  @Patch('tokens/:id/regenerate')
  @Roles('Owner', 'Admin')
  async regenerateToken(@Req() req: any, @Param('id') id: string) {
    return this.enrollmentService.regenerateToken(
      id,
      req.user.orgId,
      req.user.sub,
      { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
    );
  }

  @Get('audit')
  @Roles('Owner', 'Admin')
  async getAuditLogs(@Req() req: any) {
    return this.enrollmentService.getAuditLogs(req.user.orgId);
  }
}
