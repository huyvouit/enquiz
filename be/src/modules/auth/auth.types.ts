import type { PublicUser } from '../users/users.mapper.js';

export interface AuthResult {
  accessToken: string;
  user: PublicUser;
}
