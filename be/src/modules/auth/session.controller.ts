import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Request, Response } from 'express';
import { Model } from 'mongoose';
import { AllowPending } from '../../common/decorators/allow-pending.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { AccountStatus } from '../../common/enums/account-status.enum.js';
import { RateLimit } from '../../common/rate-limit/rate-limit.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { AccountStatusService } from '../users/account-status.service.js';
import { User } from '../users/schemas/user.schema.js';
import {
  AuthSessionService,
  SESSION_EXPIRED,
} from '../users/sessions/auth-session.service.js';
import { toPublicUser } from '../users/users.mapper.js';
import type { AuthResult } from './auth.types.js';
import { SessionCookie } from './session-cookie.js';
import { TokenService } from './token.service.js';

/**
 * The session cookie endpoints (plan D22). Refresh and logout work without
 * an access token (it may have expired); they read only the cookie.
 * Rate limited per IP (a school shares one), well above what a class needs.
 */
@Controller('auth')
export class SessionController {
  constructor(
    private readonly sessions: AuthSessionService,
    private readonly tokens: TokenService,
    private readonly statuses: AccountStatusService,
    private readonly cookie: SessionCookie,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  /**
   * POST /api/v1/auth/refresh — swaps the session cookie for a new one and
   * returns { accessToken, user }. 401 when there is no live session.
   */
  @Public()
  @RateLimit('auth-refresh', 300)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResult> {
    this.cookie.checkOrigin(req);
    const token = this.cookie.read(req);
    if (!token) throw new UnauthorizedException(SESSION_EXPIRED);
    try {
      const refresh = await this.sessions.rotate(token);
      const state = await this.statuses.getState(refresh.userId);
      const account =
        state && state.status !== AccountStatus.DISABLED
          ? await this.userModel.findById(refresh.userId).lean()
          : null;
      if (!account) {
        await this.sessions.revoke(refresh.sessionId);
        throw new UnauthorizedException(
          'Tài khoản đã bị khoá hoặc không còn tồn tại',
        );
      }
      this.cookie.set(res, refresh);
      return await this.tokens.issue(toPublicUser(account), refresh.sessionId);
    } catch (error) {
      this.cookie.clear(res);
      throw error;
    }
  }

  /** POST /api/v1/auth/logout — ends this browser's session. */
  @Public()
  @RateLimit('auth-refresh', 300)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ loggedOut: true }> {
    this.cookie.checkOrigin(req);
    const token = this.cookie.read(req);
    if (token) await this.sessions.revokeByToken(token);
    this.cookie.clear(res);
    return { loggedOut: true };
  }

  /**
   * POST /api/v1/auth/logout-all — "Đăng xuất mọi thiết bị": ends every
   * session of the user, this one included.
   */
  @AllowPending()
  @RateLimit('auth-logout-all', 10)
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ sessions: number }> {
    const sessions = await this.sessions.revokeAll(user.userId);
    this.cookie.clear(res);
    return { sessions };
  }
}
