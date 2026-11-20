import { Controller, Get } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { AllowPending } from '../../common/decorators/allow-pending.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { GetProfileQuery } from './queries/impl/get-profile.query.js';

@Controller('users')
export class UsersController {
  constructor(private readonly queryBus: QueryBus) {}

  /** GET /api/v1/users/profile — current user's profile (any role, also pending teachers). */
  @AllowPending()
  @Get('profile')
  getProfile(@CurrentUser() user: AuthUser) {
    return this.queryBus.execute(new GetProfileQuery(user.userId));
  }
}
