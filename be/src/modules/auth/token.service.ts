import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtPayload } from '../../common/types/auth-user.js';
import type { PublicUser } from '../users/users.mapper.js';
import type { AuthResult } from './auth.types.js';

/** Issues access tokens. Shared by the register and login handlers. */
@Injectable()
export class TokenService {
  constructor(private readonly jwtService: JwtService) {}

  async issue(user: PublicUser): Promise<AuthResult> {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };
    return { accessToken: await this.jwtService.signAsync(payload), user };
  }
}
