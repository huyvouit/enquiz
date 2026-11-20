import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

const logger = new Logger('Database');

/**
 * `MONGODB_URI=memory` starts a throwaway in-memory MongoDB (dev/demo only,
 * data is lost on restart). Any other value is used as a connection string.
 */
async function resolveMongoUri(uri: string): Promise<string> {
  if (uri !== 'memory') return uri;
  // devDependency, loaded only in this mode.
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const server = await MongoMemoryServer.create();
  logger.warn('Using in-memory MongoDB: data will be lost on restart');
  return server.getUri('enquiz');
}

@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        uri: await resolveMongoUri(config.getOrThrow<string>('MONGODB_URI')),
      }),
    }),
  ],
})
export class DatabaseModule {}
