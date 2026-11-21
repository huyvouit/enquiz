import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { CloudLogger } from './common/logging/cloud-logger.js';
import { API_PREFIX, setupApp } from './common/setup-app.js';

async function bootstrap() {
  // Cloud Run sets K_SERVICE: log JSON lines with a severity, so Cloud Error
  // Reporting picks up errors (launch checklist C3). Locally: Nest's logger.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: process.env.K_SERVICE ? new CloudLogger() : undefined,
  });
  const config = app.get(ConfigService);

  // Behind Firebase Hosting + Cloud Run, req.ip (used by the rate limits) is
  // only the real client when Express trusts exactly that many proxies.
  const proxies = config.getOrThrow<number>('TRUST_PROXY');
  if (proxies > 0) app.set('trust proxy', proxies);

  // Question images are public and may be shown by a frontend on another origin.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  setupApp(app);
  app.enableCors({
    origin: config
      .getOrThrow<string>('CORS_ORIGIN')
      .split(',')
      .map((o) => o.trim()),
  });
  app.enableShutdownHooks();

  const port = config.getOrThrow<number>('PORT');
  await app.listen(port);
  console.log(`EnQuiz API ready at http://localhost:${port}/${API_PREFIX}`);
}
await bootstrap();
