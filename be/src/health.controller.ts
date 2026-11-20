import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from './common/decorators/public.decorator.js';

@Public()
@Controller('health')
export class HealthController {
  /**
   * `clientIp` is the caller's own address as the rate limits see it. After a
   * deploy, it must match your real public IP; otherwise adjust TRUST_PROXY.
   */
  @Get()
  check(@Req() req: Request) {
    return { status: 'ok', clientIp: req.ip ?? null };
  }
}
