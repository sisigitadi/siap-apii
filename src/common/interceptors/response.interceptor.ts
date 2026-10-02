import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';

export interface EnvelopeResponse<T> {
  success: true;
  code: number;
  message: string;
  data: T | null;
  meta: { timestamp: number };
}

/**
 * Bungkus setiap response sukses dengan envelope standar (DESIGN.md §8.2).
 * `meta.timestamp` = epoch detik UTC.
 *
 * Catatan: response biner (Buffer — mis. PDF hasil render) dilewatkan apa adanya
 * tanpa envelope; membungkusnya sebagai JSON merusak byte stream (FR-LETTER-04/09).
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, EnvelopeResponse<T> | Buffer> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<EnvelopeResponse<T> | Buffer> {
    const httpContext = context.switchToHttp();
    const method = httpContext.getRequest<{ method: string }>().method;
    const statusCode = httpContext.getResponse<{ statusCode: number }>().statusCode;

    return next.handle().pipe(
      map((data) => {
        if (Buffer.isBuffer(data)) {
          return data;
        }
        return {
          success: true as const,
          code: statusCode,
          message: defaultMessage(method),
          data: data ?? null,
          meta: { timestamp: Math.floor(Date.now() / 1000) },
        };
      }),
    );
  }
}

function defaultMessage(method: string): string {
  switch (method) {
    case 'POST':
      return 'Resource successfully created';
    case 'PATCH':
    case 'PUT':
      return 'Resource successfully updated';
    case 'DELETE':
      return 'Resource successfully deleted';
    default:
      return 'Resource successfully fetched';
  }
}
