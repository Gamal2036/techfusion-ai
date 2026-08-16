import { IsString, Length, Matches } from 'class-validator';

export class UpdateAccountProfileDto {
  // Display-name editing is self-scoped and additive: only the authenticated
  // user's own displayName may be updated. The DTO is whitelisted server-side,
  // so any client-supplied userId/orgId field in the body is stripped and
  // never trusted. A value with at least one non-whitespace character is
  // required; the service trims before persisting.
  @IsString()
  @Length(1, 100)
  @Matches(/\S/, { message: 'displayName must contain at least one non-whitespace character' })
  displayName: string;
}
