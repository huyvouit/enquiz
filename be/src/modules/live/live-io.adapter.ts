import type { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';

/**
 * Socket.io server options for the live quiz (plan 5, D19).
 * The browser opens the socket straight on the Cloud Run domain (Firebase
 * Hosting does not forward WebSocket), so the Firebase origin must be
 * allowed here: LIVE_CORS_ORIGINS, comma separated.
 */
export class LiveIoAdapter extends IoAdapter {
  private readonly origins: string[];

  constructor(app: INestApplicationContext) {
    super(app);
    this.origins = app
      .get(ConfigService)
      .getOrThrow<string>('LIVE_CORS_ORIGINS')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
  }

  override createIOServer(port: number, options?: Partial<ServerOptions>) {
    return super.createIOServer(port, {
      ...options,
      cors: { origin: this.origins },
      // Small messages only (no images over the socket).
      maxHttpBufferSize: 64 * 1024,
      // Detect a dead tablet within ~25 s (Socket.io default is 45 s).
      pingInterval: 10_000,
      pingTimeout: 15_000,
    } as ServerOptions);
  }
}
