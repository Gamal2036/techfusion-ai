import { Controller, Get, Patch, Delete, Body, Req } from '@nestjs/common';
import { AccountDeletionService } from './account-deletion.service';
import { AccountProfileService } from './account-profile.service';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { UpdateAccountProfileDto } from './dto/update-account-profile.dto';

/**
 * V1-STAGE-00A — Delete My Account.
 * ACC-FOUND-01 — Account summary & display-name editing.
 *
 * Every route operates on the authenticated principal (req.user.sub) resolved
 * by the membership-authoritative JWT guard. A client-supplied userId in the
 * body is whitelisted away by the global ValidationPipe and never consulted.
 */
@Controller('auth/account')
export class AccountController {
  constructor(
    private accountDeletionService: AccountDeletionService,
    private accountProfileService: AccountProfileService,
  ) {}

  @Get('summary')
  async summary(@Req() req: any) {
    return this.accountProfileService.getSummary(req.user.sub);
  }

  @Patch('summary')
  async updateSummary(@Req() req: any, @Body() dto: UpdateAccountProfileDto) {
    return this.accountProfileService.updateDisplayName(req.user.sub, dto.displayName);
  }

  @Get('deletion-preview')
  async preview(@Req() req: any) {
    return this.accountDeletionService.previewDeletion(req.user.sub);
  }

  @Delete()
  async delete(@Req() req: any, @Body() dto: DeleteAccountDto) {
    return this.accountDeletionService.deleteAccount(req.user.sub, dto.confirmation);
  }
}
