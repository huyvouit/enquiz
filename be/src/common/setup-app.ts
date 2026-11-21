import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { LiveIoAdapter } from '../modules/live/live-io.adapter.js';
import { HttpExceptionFilter } from './filters/http-exception.filter.js';
import { ResponseInterceptor } from './interceptors/response.interceptor.js';

export const API_PREFIX = 'api/v1';

/** Shared HTTP setup used by main.ts and the e2e tests so both behave the same. */
export function setupApp(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX);
  // CSV imports send up to 500 questions as JSON (default limit: 100 kB).
  (app as NestExpressApplication).useBodyParser('json', { limit: '2mb' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  // Live quiz sockets (plan 5): CORS and timeouts of the /live namespace.
  app.useWebSocketAdapter(new LiveIoAdapter(app));
}
