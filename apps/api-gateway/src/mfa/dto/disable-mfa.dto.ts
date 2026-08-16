import { IsOptional, IsString, IsNotEmpty, Length } from 'class-validator';

/**
 * MFA disable requires the current account password plus one possession proof:
 * a valid TOTP token OR a valid unused recovery code. A password alone is never
 * sufficient. The client identity is always derived from the authenticated
 * session; no userId field exists here.
 */
export class DisableMfaDto {
  @IsString()
  @IsNotEmpty()
  password: string;

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
