import { IsString, IsOptional, IsEnum, IsArray } from 'class-validator';

export enum ReportType {
  DEVICE_HEALTH = 'device_health',
  SECURITY_EXECUTIVE = 'security_executive',
  FLEET_SUMMARY = 'fleet_summary',
}

export enum ReportFormat {
  PDF = 'pdf',
  DOCX = 'docx',
  HTML = 'html',
}

export class GenerateReportDto {
  @IsEnum(ReportType)
  type!: ReportType;

  @IsEnum(ReportFormat)
  format!: ReportFormat;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsOptional()
  deviceIds?: string[];

  @IsString()
  @IsOptional()
  scanId?: string;

  @IsOptional()
  generateAiSummary?: boolean;
}

export class CreateTemplateDto {
  @IsString()
  @IsOptional()
  companyName?: string;

  @IsString()
  @IsOptional()
  logoPath?: string;

  @IsString()
  @IsOptional()
  accentColor?: string;
}

export class CreateScheduleDto {
  @IsEnum(ReportType)
  type!: ReportType;

  @IsString()
  formats!: string;

  @IsString()
  cron!: string;

  @IsArray()
  @IsOptional()
  deviceIds?: string[];
}
