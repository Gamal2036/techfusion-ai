import { Injectable, NestInterceptor, ExecutionContext, CallHandler, StreamableFile } from '@nestjs/common';
import { Observable, map } from 'rxjs';

function serializeBigInts(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof StreamableFile) return value;
  if (value instanceof Date) return value;
  if (typeof value === 'bigint') return Number(value);
  if (Array.isArray(value)) return value.map(serializeBigInts);
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = serializeBigInts(val);
    }
    return result;
  }
  return value;
}

@Injectable()
export class BigIntSerializerInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data) => serializeBigInts(data)),
    );
  }
}
