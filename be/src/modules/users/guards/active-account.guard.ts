import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALLOW_PENDING_KEY } from '../../../common/decorators/allow-pending.decorator.js';
import { AccountStatus } from '../../../common/enums/account-status.enum.js';
import type { AuthUser } from '../../../common/types/auth-user.js';
import { AccountStatusService } from '../account-status.service.js';

/**
 * Registered globally after JwtAuthGuard:
 * - disabled or deleted account -> 401 (the token is no longer honoured)
 * - pending account -> 403 except on endpoints marked @AllowPending()
 */
@Injectable()
export class ActiveAccountGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly statuses: AccountStatusService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // HTTP only. Socket events (live quiz, plan 5) are authenticated once at
    // the handshake by LiveAuthService: there are no headers per message.
    if (context.getType() !== 'http') return true;
    const user = context.switchToHttp().getRequest().user as
      AuthUser | undefined;
    if (!user) return true; // @Public() endpoint

    const status = await this.statuses.get(user.userId);
    if (status === null || status === AccountStatus.DISABLED) {
      throw new UnauthorizedException(
        'Tài khoản đã bị khoá hoặc không còn tồn tại',
      );
    }
    if (status === AccountStatus.PENDING) {
      const allowed = this.reflector.getAllAndOverride<boolean>(
        ALLOW_PENDING_KEY,
        [context.getHandler(), context.getClass()],
      );
      if (!allowed) {
        throw new ForbiddenException(
          'Tài khoản giáo viên đang chờ quản trị viên duyệt',
        );
      }
    }
    return true;
  }
}
