import { IsString, IsIn, IsOptional, IsArray, ValidateNested, MinLength, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class FindingDto {
  @IsString()
  @IsIn(['updates', 'firewall', 'weak_config', 'open_ports', 'password_policy'])
  category: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  finding: string;

  @IsString()
  @IsIn(['low', 'medium', 'high', 'critical'])
  severity: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  remediation: string;

  @IsOptional()
  details?: Record<string, unknown>;
}

export class SubmitFindingsDto {
  @IsString()
  deviceToken: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FindingDto)
  findings: FindingDto[];
}
