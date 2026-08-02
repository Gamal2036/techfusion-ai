import { IsString, IsOptional, IsInt, IsDateString, Min, Max, MaxLength } from 'class-validator';

export class CreateEnrollmentTokenDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  label?: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(100)
  maxUses?: number;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}
