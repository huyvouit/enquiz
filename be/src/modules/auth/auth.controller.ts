import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator.js';
import type { AuthResult, SessionResult } from './auth.types.js';
import { LoginCommand } from './commands/impl/login.command.js';
import { RegisterCommand } from './commands/impl/register.command.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { SessionCookie } from './session-cookie.js';

/** Rate limited per username and per IP against password guessing (see auth-throttle.ts). */
@Public()
@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly cookie: SessionCookie,
  ) {}

  /**
   * POST /api/v1/auth/register — student or teacher self sign-up.
   * Returns { accessToken, user } and sets the session cookie (12 h).
   */
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResult> {
    const result = await this.commandBus.execute(
      new RegisterCommand(dto, {
        remember: false,
        userAgent: req.headers['user-agent'],
      }),
    );
    return this.withCookie(result, res);
  }

  /**
   * POST /api/v1/auth/login — returns { accessToken, user } and sets the
   * session cookie (plan D22): 12 h, or 7 days sliding with `remember`.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResult> {
    const result = await this.commandBus.execute(
      new LoginCommand(dto.username, dto.password, {
        remember: dto.remember === true,
        userAgent: req.headers['user-agent'],
      }),
    );
    return this.withCookie(result, res);
  }

  private withCookie(
    { refresh, ...result }: SessionResult,
    res: Response,
  ): AuthResult {
    this.cookie.set(res, refresh);
    return result;
  }
}
