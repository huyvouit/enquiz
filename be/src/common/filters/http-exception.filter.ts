import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

/**
 * Normalises every error into `{ success: false, statusCode, message, errors? }`.
 * `message` is always one human-readable string; validation details go to `errors`.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    let statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Đã có lỗi xảy ra, vui lòng thử lại';
    let errors: string[] | undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else {
        const raw = (body as { message?: string | string[] }).message;
        if (Array.isArray(raw)) {
          errors = raw;
          message = raw[0] ?? exception.message;
        } else if (raw) {
          message = raw;
        }
      }
    } else if (isDuplicateKeyError(exception)) {
      statusCode = HttpStatus.CONFLICT;
      message = 'Dữ liệu đã tồn tại';
    } else {
      this.logger.error(exception);
    }

    res
      .status(statusCode)
      .json({ success: false, statusCode, message, errors });
  }
}

function isDuplicateKeyError(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    (e as { code?: number }).code === 11000
  );
}
