import { IsString, IsOptional, IsUUID, MinLength, MaxLength } from 'class-validator';

export class TroubleshootDto {
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  query: string;

  @IsOptional()
  @IsUUID()
  deviceId?: string;

  @IsOptional()
  @IsUUID()
  conversationId?: string;
}
