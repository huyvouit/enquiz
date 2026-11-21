import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi } from '../api/auth.api'
import type { LoginPayload, RegisterPayload, User } from '../types'
import { queryClient } from '@/shared/api/query-client'

interface AuthState {
  token: string | null
  user: User | null
  login: (payload: LoginPayload) => Promise<User>
  register: (payload: RegisterPayload) => Promise<User>
  /**
   * Re-reads the profile (level/XP after a quiz, account status after an admin
   * approved a teacher). Logs out if the token is invalid or the account is disabled.
   */
  refreshProfile: () => Promise<void>
  /** Keeps this device logged in with the new token; others must log in again. */
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  logout: () => void
}

/** Persisted in localStorage so a page reload keeps the session. */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,

      async login(payload) {
        const { accessToken, user } = await authApi.login(payload)
        set({ token: accessToken, user })
        return user
      },

      async register(payload) {
        const { accessToken, user } = await authApi.register(payload)
        set({ token: accessToken, user })
        return user
      },

      async refreshProfile() {
        const user = await authApi.profile()
        set({ user })
      },

      async changePassword(currentPassword, newPassword) {
        const { accessToken, user } = await authApi.changePassword(currentPassword, newPassword)
        set({ token: accessToken, user })
      },

      logout() {
        // Another account may log in next: drop every cached response.
        queryClient.clear()
        set({ token: null, user: null })
      },
    }),
    {
      name: 'enquiz-auth',
      partialize: (s) => ({ token: s.token, user: s.user }),
    },
  ),
)

/** Where each role lands after login. */
export function homePathFor(user: Pick<User, 'role'> | null): string {
  if (!user) return '/login'
  return user.role === 'student' ? '/home' : '/teacher'
}
