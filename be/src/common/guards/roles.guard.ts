import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { Role } from '../enums/role.enum.js';
import type { AuthUser } from '../types/auth-user.js';

/** Registered globally after JwtAuthGuard. No @Roles() => any logged-in user. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const user = context.switchToHttp().getRequest().user as
      AuthUser | undefined;
    if (user && requiredRoles.includes(user.role)) return true;
    throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
  }
}
