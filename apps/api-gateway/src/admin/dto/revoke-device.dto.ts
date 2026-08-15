import { IsString, IsOptional, IsNotEmpty, MaxLength } from 'class-validator';

/**
 * DEV-REV-01 — Recovery input for the support-only revoke-and-unlink
 * operation. The device is identified by deviceId (preferred),
 * identityFingerprint, or installationId. At least one identifier is required;
 * the plaintext device credential is NEVER accepted or returned.
 */
export class RevokeDeviceDto {
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(64)
  deviceId?: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(512)
  identityFingerprint?: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(128)
  installationId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(512)
  reason?: string;
}
