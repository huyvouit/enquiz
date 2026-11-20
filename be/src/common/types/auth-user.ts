import { Role } from '../enums/role.enum.js';

/** Shape of `request.user` after JwtStrategy validates the token. */
export interface AuthUser {
  userId: string;
  username: string;
  role: Role;
}

/** Payload signed into the JWT access token. */
export interface JwtPayload {
  sub: string;
  username: string;
  role: Role;
}
