import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';

interface ErrorEnvelope {
  success: false;
  code: number;
  message: string;
  data: null;
  meta: { timestamp: number };
}

/**
 * Terjemahkan exception NestJS ke envelope konsisten (DESIGN.md §8.2).
 * Daftar kode: 400 (validasi), 401 (belum login), 403 (ditolak/lintas divisi),
 * 404, 409 (konflik integritas), 500.
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost): void {
    const httpContext = host.switchToHttp();
    const response = httpContext.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const message = this.resolveMessage(exceptionResponse, exception);
    const body: ErrorEnvelope = {
      success: false,
      code: status,
      message,
      data: null,
      meta: { timestamp: Math.floor(Date.now() / 1000) },
    };

    if (status >= 500) {
      this.logger.error(`${status} ${exception.message}`, exception.stack);
    }
    response.status(status).json(body);
  }

  private resolveMessage(exceptionResponse: string | object, exception: HttpException): string {
    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }
    const record = exceptionResponse as Record<string, unknown>;
    const rawMessage = record['message'];
    if (typeof rawMessage === 'string') {
      return rawMessage;
    }
    if (Array.isArray(rawMessage)) {
      // Detail validasi (mis. dari ZodValidationException) dirangkai jadi satu kalimat.
      return rawMessage.map((part) => String(part)).join('; ');
    }
    return exception.message;
  }
}
