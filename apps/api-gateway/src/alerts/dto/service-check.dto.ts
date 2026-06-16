import { IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ServiceCheckDto {
  @IsString()
  name: string;

  @IsString()
  status: string;
}

export class ServiceChecksDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceCheckDto)
  services: ServiceCheckDto[];
}
