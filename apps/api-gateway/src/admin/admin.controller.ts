import { Controller, Get, Post, Body, Param, Req } from '@nestjs/common';
import { AdminService } from './admin.service';
import { Roles } from '../common/roles.decorator';

@Controller('admin')
@Roles('Owner', 'Admin')
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

  @Post('users/:userId/role')
  @Roles('Owner')
  async updateUserRole(
    @Req() req: any,
    @Param('userId') userId: string,
    @Body() body: { role: string },
  ) {
    return this.adminService.updateUserRole(req.user.orgId, req.user.sub, userId, body.role);
  }

  @Post('users/:userId/remove')
  @Roles('Owner')
  async removeUser(@Req() req: any, @Param('userId') userId: string) {
    return this.adminService.removeUser(req.user.orgId, req.user.sub, userId);
  }
}
