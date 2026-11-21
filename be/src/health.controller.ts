import { Controller, Get, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { Public } from './common/decorators/public.decorator.js';
import type { AppEnv } from './config/env.validation.js';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly config: ConfigService<AppEnv, true>) {}

  /**
   * - `clientIp`: the caller's own address as the rate limits see it. After a
   *   deploy, it must match your real public IP; otherwise adjust TRUST_PROXY.
   * - `version`, `commit`: the release this revision runs (plan D21); `dev`
   *   when not deployed by scripts/release.sh.
   * - `minClientVersion`: older frontends must update (plan D25).
   */
  @Get()
  check(@Req() req: Request) {
    return {
      status: 'ok',
      clientIp: req.ip ?? null,
      version: this.config.get('APP_VERSION'),
      commit: this.config.get('GIT_COMMIT'),
      minClientVersion: this.config.get('MIN_CLIENT_VERSION'),
    };
  }
}
