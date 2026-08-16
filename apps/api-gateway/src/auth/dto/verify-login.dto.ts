import { IsOptional, IsString, IsNotEmpty, Length } from 'class-validator';

/**
 * MFA login challenge. Additively accepts an unused recovery code in place of a
 * TOTP token (ACC-SEC-02B2); the response contract is unchanged and token-only
 * requests remain fully supported. At least one of `token` / `recoveryCode`
 * must be present — enforced by the service.
 */
export class VerifyLoginDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  token?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  recoveryCode?: string;
}
