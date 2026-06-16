import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class SanitizePipe implements PipeTransform<string> {
  transform(value: string): string {
    if (!value || typeof value !== 'string') {
      throw new BadRequestException('Input must be a non-empty string');
    }
    if (value.length > 10000) {
      throw new BadRequestException('Input exceeds maximum length of 10000 characters');
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      throw new BadRequestException('Input must not be empty');
    }
    return trimmed;
  }
}
