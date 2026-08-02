import {
  IsString, IsNumber, IsOptional, IsInt, Min, Max, IsArray, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CpuMetricsDto {
  @IsNumber() @Min(0) @Max(100)
  usage: number;

  @IsInt() @IsOptional() @Min(1)
  cores?: number;

  @IsOptional() @IsNumber() @Min(0)
  loadAverage1Min?: number;

  @IsOptional() @IsNumber() @Min(0)
  loadAverage5Min?: number;

  @IsOptional() @IsNumber() @Min(0)
  loadAverage15Min?: number;
}

export class MemoryMetricsDto {
  @IsNumber() @Min(0)
  total: number;

  @IsNumber() @Min(0)
  used: number;

  @IsNumber() @Min(0) @Max(100)
  percent: number;
}

export class DiskMetricsDto {
  @IsOptional() @IsNumber() @Min(0)
  total?: number;

  @IsOptional() @IsNumber() @Min(0)
  used?: number;

  @IsOptional() @IsNumber() @Min(0)
  readBytes?: number;

  @IsOptional() @IsNumber() @Min(0)
  writeBytes?: number;

  @IsString()
  @IsOptional()
  smartStatus?: string;

  @IsInt()
  @IsOptional() @Min(0)
  smartReallocatedSectors?: number;

  @IsOptional() @IsNumber()
  smartTemperature?: number;
}

export class GpuMetricsDto {
  @IsNumber() @Min(0) @Max(100) @IsOptional()
  usage?: number;

  @IsOptional() @IsNumber()
  temp?: number;

  @IsOptional() @IsNumber() @Min(0)
  memoryUsed?: number;
}

export class BatteryMetricsDto {
  @IsInt() @Min(0) @Max(100) @IsOptional()
  percent?: number;

  @IsString() @IsOptional()
  status?: string;
}

export class TemperaturesDto {
  @IsOptional() @IsNumber()
  cpu?: number;

  @IsOptional() @IsNumber()
  gpu?: number;

  @IsOptional() @IsNumber()
  motherboard?: number;
}

export class NetworkMetricsDto {
  @IsOptional() @IsNumber() @Min(0)
  rxBytes?: number;

  @IsOptional() @IsNumber() @Min(0)
  txBytes?: number;
}

export class MetricsPayloadDto {
  @IsString()
  @IsOptional()
  deviceToken?: string;

  @IsOptional()
  timestamp?: string;

  @ValidateNested()
  @Type(() => CpuMetricsDto)
  cpu: CpuMetricsDto;

  @ValidateNested()
  @Type(() => MemoryMetricsDto)
  memory: MemoryMetricsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DiskMetricsDto)
  disk?: DiskMetricsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => GpuMetricsDto)
  gpu?: GpuMetricsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BatteryMetricsDto)
  battery?: BatteryMetricsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TemperaturesDto)
  temperatures?: TemperaturesDto;

  @IsOptional()
  fans?: { rpm?: number };

  @IsOptional()
  @ValidateNested()
  @Type(() => NetworkMetricsDto)
  network?: NetworkMetricsDto;

  @IsInt() @IsOptional() @Min(0)
  processes?: number;

  @IsOptional() @IsNumber() @Min(0)
  uptime?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceCheckDto)
  services?: ServiceCheckDto[];
}

export class ServiceCheckDto {
  @IsString()
  name: string;

  @IsString()
  status: string;
}
