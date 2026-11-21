import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

/**
 * Wraps every successful response as `{ success: true, data }`.
 * File downloads (StreamableFile, e.g. Excel/PDF exports) and socket
 * acknowledgements pass through as-is.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiSuccess<T> | StreamableFile
> {
  intercept(
    ctx: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccess<T> | StreamableFile> {
    // Socket acknowledgements (live quiz, plan 5) keep their own shape.
    if (ctx.getType() !== 'http') {
      return next.handle() as Observable<ApiSuccess<T>>;
    }
    return next
      .handle()
      .pipe(
        map((data) =>
          data instanceof StreamableFile ? data : { success: true, data },
        ),
      );
  }
}
