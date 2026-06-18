import {
  IsString, IsNumber, IsOptional, IsInt, Min, Max, IsArray, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CpuMetricsDto {
  @IsNumber() @Min(0) @Max(100)
  usage: number;

  @IsInt() @IsOptional()
  cores?: number;

  @IsOptional()
  loadAverage1Min?: number;

  @IsOptional()
  loadAverage5Min?: number;

  @IsOptional()
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
  @IsOptional()
  total?: number;

  @IsOptional()
  used?: number;

  @IsOptional()
  readBytes?: number;

  @IsOptional()
  writeBytes?: number;

  @IsString()
  @IsOptional()
  smartStatus?: string;

  @IsInt()
  @IsOptional()
  smartReallocatedSectors?: number;

  @IsOptional()
  smartTemperature?: number;
}

export class GpuMetricsDto {
  @IsNumber() @Min(0) @Max(100) @IsOptional()
  usage?: number;

  @IsOptional()
  temp?: number;

  @IsOptional()
  memoryUsed?: number;
}

export class BatteryMetricsDto {
  @IsInt() @Min(0) @Max(100) @IsOptional()
  percent?: number;

  @IsString() @IsOptional()
  status?: string;
}

export class TemperaturesDto {
  @IsOptional()
  cpu?: number;

  @IsOptional()
  gpu?: number;

  @IsOptional()
  motherboard?: number;
}

export class NetworkMetricsDto {
  @IsOptional()
  rxBytes?: number;

  @IsOptional()
  txBytes?: number;
}

export class MetricsPayloadDto {
  @IsString()
  @IsOptional()
  deviceToken?: string;

  @IsOptional()
  timestamp?: string;

  @IsOptional()
  cpu?: CpuMetricsDto;

  @IsOptional()
  memory?: MemoryMetricsDto;

  @IsOptional()
  disk?: DiskMetricsDto;

  @IsOptional()
  gpu?: GpuMetricsDto;

  @IsOptional()
  battery?: BatteryMetricsDto;

  @IsOptional()
  temperatures?: TemperaturesDto;

  @IsOptional()
  fans?: { rpm?: number };

  @IsOptional()
  network?: NetworkMetricsDto;

  @IsInt()
  @IsOptional()
  processes?: number;

  @IsOptional()
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
