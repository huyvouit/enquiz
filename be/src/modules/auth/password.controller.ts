import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { AllowPending } from '../../common/decorators/allow-pending.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RateLimit } from '../../common/rate-limit/rate-limit.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { ChangePasswordCommand } from './commands/impl/change-password.command.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';

/** Logged-in actions on one's own credentials (AuthController is public). */
@Controller('auth')
export class PasswordController {
  constructor(private readonly commandBus: CommandBus) {}

  /**
   * POST /api/v1/auth/change-password — any role, also pending teachers.
   * Returns { accessToken, user }: other devices are logged out (D20).
   */
  @AllowPending()
  @RateLimit('change-password', 10)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  change(@Body() dto: ChangePasswordDto, @CurrentUser() user: AuthUser) {
    return this.commandBus.execute(
      new ChangePasswordCommand(user, dto.currentPassword, dto.newPassword),
    );
  }
}
