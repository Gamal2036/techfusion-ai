import { IsString, Matches } from 'class-validator';

export class DeleteAccountDto {
  // Explicit destructive confirmation. The value must be the literal string
  // "DELETE". The DTO is whitelisted server-side, so any client-supplied
  // userId/orgId field in the body is stripped and never trusted.
  @IsString()
  @Matches(/^DELETE$/, { message: 'confirmation must be exactly "DELETE"' })
  confirmation: string;
}
