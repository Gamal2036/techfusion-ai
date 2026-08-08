import { Controller, Get, Post, Body, Param, Req } from '@nestjs/common';
import { AdminService } from './admin.service';
import { RequirePermissions } from '../common/permissions.decorator';
import { Permission } from '../common/permissions';

@Controller('admin')
@RequirePermissions(Permission.ORGANIZATION_SETTINGS)
export class AdminController {
  constructor(private adminService: AdminService) {}

  // ─── Dashboard ────────────────────────────────────────────────

  @Get('dashboard')
  async getDashboard(@Req() req: any) {
    return this.adminService.getDashboardStats(req.user.orgId);
  }

  @Get('org')
  async getOrgInfo(@Req() req: any) {
    return this.adminService.getOrgInfo(req.user.orgId);
  }

  // ─── User Management ──────────────────────────────────────────

  @Get('users')
  async listUsers(@Req() req: any) {
    return this.adminService.listUsers(req.user.orgId);
  }

  @Get('users/:userId')
  async getUser(@Req() req: any, @Param('userId') userId: string) {
    return this.adminService.getUser(req.user.orgId, userId);
  }

  @RequirePermissions(Permission.MEMBERS_MANAGE)
  @Post('users/:userId/role')
  async updateUserRole(
    @Req() req: any,
    @Param('userId') userId: string,
    @Body() body: { role: string },
  ) {
    return this.adminService.updateUserRole(req.user.orgId, req.user.sub, userId, body.role);
  }

  @RequirePermissions(Permission.MEMBERS_REMOVE)
  @Post('users/:userId/remove')
  async removeUser(@Req() req: any, @Param('userId') userId: string) {
    return this.adminService.removeUser(req.user.orgId, req.user.sub, userId);
  }
}
