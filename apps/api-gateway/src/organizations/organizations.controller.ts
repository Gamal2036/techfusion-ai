import { Controller, Get, Post, Patch, Delete, Param, Body, Req } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { RequirePermissions } from '../common/permissions.decorator';
import { Permission } from '../common/permissions';

@Controller('organizations')
export class OrganizationsController {
  constructor(private organizationsService: OrganizationsService) {}

  @Get()
  async list(@Req() req: any) {
    return this.organizationsService.listOrganizations(req.user.sub, req.user.orgId);
  }

  @Post()
  async create(@Req() req: any, @Body() dto: CreateOrganizationDto) {
    return this.organizationsService.createOrganization(req.user.sub, dto.name);
  }

  @Get('current')
  async current(@Req() req: any) {
    return this.organizationsService.getCurrent(req.user.sub, req.user.orgId);
  }

  @RequirePermissions(Permission.ORGANIZATION_VIEW)
  @Get(':id')
  async getOne(@Req() req: any, @Param('id') id: string) {
    return this.organizationsService.getOrganization(req.user.sub, id, req.user.orgId);
  }

  @RequirePermissions(Permission.ORGANIZATION_UPDATE)
  @Patch(':id')
  async rename(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.renameOrganization(
      req.user.sub,
      id,
      dto.name,
      req.user.orgId,
    );
  }

  @Post(':id/switch')
  async switchOrg(@Req() req: any, @Param('id') id: string) {
    return this.organizationsService.switchOrganization(req.user.sub, id);
  }

  @RequirePermissions(Permission.MEMBERS_VIEW)
  @Get(':id/members')
  async listMembers(@Req() req: any, @Param('id') id: string) {
    return this.organizationsService.listMembers(req.user.sub, id);
  }

  @RequirePermissions(Permission.MEMBERS_MANAGE)
  @Patch(':id/members/:userId')
  async updateMemberRole(
    @Req() req: any,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.organizationsService.updateMemberRole(req.user.sub, id, userId, dto.role);
  }

  @RequirePermissions(Permission.MEMBERS_REMOVE)
  @Delete(':id/members/:userId')
  async removeMember(@Req() req: any, @Param('id') id: string, @Param('userId') userId: string) {
    return this.organizationsService.removeMember(req.user.sub, id, userId);
  }

  @Post(':id/leave')
  async leaveOrganization(@Req() req: any, @Param('id') id: string) {
    return this.organizationsService.leaveOrganization(req.user.sub, id);
  }
}
