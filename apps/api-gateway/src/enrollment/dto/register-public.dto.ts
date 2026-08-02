import { IsString, IsOptional, IsInt, IsBoolean, IsObject, IsNotEmpty, MaxLength, MinLength, Matches } from 'class-validator';

export class RegisterPublicDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  hostname?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  os?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  osVersion?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  cpuModel?: string;

  @IsInt()
  @IsOptional()
  cpuCores?: number;

  @IsInt()
  @IsOptional()
  cpuLogical?: number;

  @IsOptional()
  ramTotal?: number;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  gpuInfo?: string;

  @IsOptional()
  diskTotal?: number;

  @IsBoolean()
  @IsOptional()
  isLaptop?: boolean;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  identityFingerprint: string;

  @IsInt()
  @IsOptional()
  identityVersion?: number;

  @IsString()
  @IsOptional()
  @MaxLength(128)
  installationId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  agentVersion?: string;

  @IsString()
  @IsOptional()
  @MaxLength(512)
  enrollmentToken?: string;
}
