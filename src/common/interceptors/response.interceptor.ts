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
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, EnvelopeResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<EnvelopeResponse<T>> {
    const httpContext = context.switchToHttp();
    const method = httpContext.getRequest<{ method: string }>().method;
    const statusCode = httpContext.getResponse<{ statusCode: number }>().statusCode;

    return next.handle().pipe(
      map((data) => ({
        success: true as const,
        code: statusCode,
        message: defaultMessage(method),
        data: data ?? null,
        meta: { timestamp: Math.floor(Date.now() / 1000) },
      })),
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
