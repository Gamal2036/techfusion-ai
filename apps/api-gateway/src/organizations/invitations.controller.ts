import { Controller, Get, Post, Delete, Body, Param, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { throttle } from '../config/rate-limits';
import { Public } from '../common/public.decorator';
import { RequirePermissions } from '../common/permissions.decorator';
import { Permission } from '../common/permissions';
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { getWebAppBaseUrl } from './invitation-token';

/**
 * Human-facing invitation links must resolve to the WEB application. The API
 * gateway's own request origin is never used: the browser calls the API on the
 * API host/port where no /invite route exists.
 */
function originOf(): string {
  return getWebAppBaseUrl();
}

/**
 * Org-scoped invitation endpoints. The target organization is derived from the
 * URL and validated against the authenticated user's membership; the inviter is
 * always the authenticated user. Authorization is the membership role, never a
 * client-supplied field.
 */
@Controller('organizations')
export class OrganizationInvitationsController {
  constructor(private invitationsService: InvitationsService) {}

  @RequirePermissions(Permission.MEMBERS_MANAGE)
  @Post(':orgId/invitations')
  create(
    @Req() req: any,
    @Param('orgId') orgId: string,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.invitationsService.createInvitation(
      req.user.sub,
      orgId,
      dto.email,
      dto.role,
      originOf(),
    );
  }

  @RequirePermissions(Permission.MEMBERS_VIEW)
  @Get(':orgId/invitations')
  list(@Req() req: any, @Param('orgId') orgId: string) {
    return this.invitationsService.listInvitations(req.user.sub, orgId);
  }

  @RequirePermissions(Permission.MEMBERS_MANAGE)
  @Delete(':orgId/invitations/:invitationId')
  revoke(
    @Req() req: any,
    @Param('orgId') orgId: string,
    @Param('invitationId') invitationId: string,
  ) {
    return this.invitationsService.revokeInvitation(
      req.user.sub,
      orgId,
      invitationId,
    );
  }

  @RequirePermissions(Permission.MEMBERS_MANAGE)
  @Post(':orgId/invitations/:invitationId/resend')
  resend(
    @Req() req: any,
    @Param('orgId') orgId: string,
    @Param('invitationId') invitationId: string,
  ) {
    return this.invitationsService.resendInvitation(
      req.user.sub,
      orgId,
      invitationId,
      originOf(),
    );
  }
}

/**
 * Public token entry points. Possession of the invitation token permits only
 * inspection of safe metadata and, for an authenticated user whose account
 * email matches the invited email, acceptance. It grants no general
 * organization access.
 */
@Controller('invitations')
export class InvitationsController {
  constructor(private invitationsService: InvitationsService) {}

  @Public()
  @Throttle(throttle(10, 60000))
  @Get(':token')
  inspect(@Param('token') token: string) {
    return this.invitationsService.inspectInvitation(token);
  }

  @Throttle(throttle(5, 60000))
  @Post(':token/accept')
  accept(@Req() req: any, @Param('token') token: string) {
    return this.invitationsService.acceptInvitation(req.user.sub, token);
  }
}
