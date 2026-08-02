import { IsString, IsOptional, IsEnum, IsArray, ArrayNotEmpty, IsBoolean, IsNotEmpty } from 'class-validator';

export enum ReportType {
  DEVICE_HEALTH = 'device_health',
  SECURITY_EXECUTIVE = 'security_executive',
  FLEET_SUMMARY = 'fleet_summary',
  NETWORK = 'network',
  INVENTORY = 'inventory',
  REMOTE_SUPPORT = 'remote_support',
}

export enum ReportFormat {
  PDF = 'pdf',
  DOCX = 'docx',
  HTML = 'html',
  CSV = 'csv',
  JSON = 'json',
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

  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(ReportFormat, { each: true })
  formats!: ReportFormat[];

  @IsString()
  @IsNotEmpty()
  cron!: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  deviceIds?: string[];
}

export class UpdateScheduleDto {
  @IsEnum(ReportType)
  @IsOptional()
  type?: ReportType;

  @IsArray()
  @IsOptional()
  @ArrayNotEmpty()
  @IsEnum(ReportFormat, { each: true })
  formats?: ReportFormat[];

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  cron?: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  deviceIds?: string[];

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;
}
