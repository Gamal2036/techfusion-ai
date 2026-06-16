import { IsString, IsNumber, IsOptional, IsBoolean, IsIn, Min, Max } from 'class-validator';

export class CreateAlertRuleDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  metricName: string;

  @IsNumber()
  threshold: number;

  @IsString()
  @IsIn(['gt', 'lt', 'gte', 'lte', 'eq'])
  operator: string = 'gt';

  @IsString()
  @IsIn(['info', 'warning', 'critical'])
  severity: string = 'warning';

  @IsNumber()
  @Min(0)
  @Max(86400)
  debounceSeconds: number = 300;

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
