import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '../types/auth-user.js';

/** Injects the authenticated user (`request.user`) into a handler param. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest().user,
);
