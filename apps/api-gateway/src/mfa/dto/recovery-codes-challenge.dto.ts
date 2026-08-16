import { IsString, IsNotEmpty, Length } from 'class-validator';

/**
 * Generation and regeneration of MFA recovery codes both require password
 * re-authentication plus a valid current TOTP token. Identity is always derived
 * from the authenticated session (req.user.sub).
 */
export class RecoveryCodesChallengeDto {
  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  token: string;
}
