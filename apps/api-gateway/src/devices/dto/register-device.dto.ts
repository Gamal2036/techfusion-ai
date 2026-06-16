import { IsString, IsOptional, IsInt, IsBoolean, IsObject } from 'class-validator';

export class RegisterDeviceDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  hostname?: string;

  @IsString()
  @IsOptional()
  os?: string;

  @IsString()
  @IsOptional()
  osVersion?: string;

  @IsString()
  @IsOptional()
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
  gpuInfo?: string;

  @IsOptional()
  diskTotal?: number;

  @IsBoolean()
  @IsOptional()
  isLaptop?: boolean;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
