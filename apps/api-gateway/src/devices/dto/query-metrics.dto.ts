import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryMetricsDto {
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(10080)
  minutes?: number = 60;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(1000)
  limit?: number = 100;
}
