import { api } from '@/shared/api/http'
import { passwordHash } from '@/shared/lib/password-hash'
import type { AuthResult, LoginPayload, RegisterPayload, User } from '../types'

/**
 * Passwords leave the browser only as `passwordHash` (see that file).
 * Login and sign-up also set the `__session` cookie that `refresh` reads (D22).
 */
export const authApi = {
  login: async ({ username, password, remember }: LoginPayload) =>
    api.post<AuthResult>('/auth/login', {
      username,
      password: await passwordHash(username, password),
      remember,
    }),
  register: async (payload: RegisterPayload) =>
    api.post<AuthResult>('/auth/register', {
      ...payload,
      password: await passwordHash(payload.username, payload.password),
    }),
  /** New access token from the session cookie; 401 = no session. */
  refresh: () => api.post<AuthResult>('/auth/refresh', undefined, 8_000),
  logout: () => api.post<{ loggedOut: true }>('/auth/logout'),
  logoutAll: () => api.post<{ sessions: number }>('/auth/logout-all'),
  profile: () => api.get<User>('/users/profile'),
  /** Returns a fresh token: other devices are logged out (plan D20). */
  changePassword: async (username: string, currentPassword: string, newPassword: string) =>
    api.post<AuthResult>('/auth/change-password', {
      currentPassword: await passwordHash(username, currentPassword),
      newPassword: await passwordHash(username, newPassword),
    }),
}
