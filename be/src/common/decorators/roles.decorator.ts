import { SetMetadata } from '@nestjs/common';
import { Role } from '../enums/role.enum.js';

export const ROLES_KEY = 'roles';

/** Restricts an endpoint (or a whole controller) to the given roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
