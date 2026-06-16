import { IsString, IsNumber, IsOptional, IsBoolean, IsIn, Min, Max } from 'class-validator';

export class UpdateAlertRuleDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  metricName?: string;

  @IsNumber()
  @IsOptional()
  threshold?: number;

  @IsString()
  @IsOptional()
  @IsIn(['gt', 'lt', 'gte', 'lte', 'eq'])
  operator?: string;

  @IsString()
  @IsOptional()
  @IsIn(['info', 'warning', 'critical'])
  severity?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(86400)
  debounceSeconds?: number;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsString()
  @IsOptional()
  deviceSelector?: string;

  @IsString()
  @IsOptional()
  webhookUrl?: string;
}
