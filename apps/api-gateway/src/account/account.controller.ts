import { Controller, Get, Delete, Body, Req } from '@nestjs/common';
import { AccountDeletionService } from './account-deletion.service';
import { DeleteAccountDto } from './dto/delete-account.dto';

/**
 * V1-STAGE-00A — Delete My Account.
 *
 * Both routes operate on the authenticated principal (req.user.sub) resolved by
 * the membership-authoritative JWT guard. A client-supplied userId in the body
 * is whitelisted away by the global ValidationPipe and never consulted.
 */
@Controller('auth/account')
export class AccountController {
  constructor(private accountDeletionService: AccountDeletionService) {}

  @Get('deletion-preview')
  async preview(@Req() req: any) {
    return this.accountDeletionService.previewDeletion(req.user.sub);
  }

  @Delete()
  async delete(@Req() req: any, @Body() dto: DeleteAccountDto) {
    return this.accountDeletionService.deleteAccount(req.user.sub, dto.confirmation);
  }
}
