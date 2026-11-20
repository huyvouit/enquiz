import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { API_PREFIX, setupApp } from './common/setup-app.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

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
