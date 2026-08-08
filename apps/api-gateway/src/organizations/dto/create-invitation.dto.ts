import { IsEmail, IsEnum, MaxLength } from 'class-validator';
import { Role } from '@prisma/client';

/**
 * Create-invitation body. The server derives the organization, the inviter and
 * the authorization from the authenticated request; the client may only supply
 * the target email and the requested role. invitedByUserId, organizationId and
 * any permission arrays are intentionally not part of this DTO and are stripped
 * by the whitelisting ValidationPipe.
 */
export class CreateInvitationDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsEnum(Role)
  role: Role;
}
