import { create } from 'zustand'
import { ApiError } from '@/shared/api/http'
import { queryClient } from '@/shared/api/query-client'
import { authApi } from '../api/auth.api'
import type { AuthResult, LoginPayload, RegisterPayload, User } from '../types'

/** Key of the 7-day token kept before v1.1.0; removed on start-up. */
const LEGACY_STORAGE_KEY = 'enquiz-auth'
/** Renew this long before the access token expires (sockets, plan D22). */
const RENEW_MARGIN_MS = 60_000

interface AuthState {
  /** Access token (15 min), in memory only: never in localStorage (plan D22). */
  token: string | null
  user: User | null
  /** `loading` until the start-up refresh has answered. */
  status: 'loading' | 'ready'
  /** On app start: resumes the session from the cookie, if any. */
  init: () => Promise<void>
  login: (payload: LoginPayload) => Promise<User>
  register: (payload: RegisterPayload) => Promise<User>
  /**
   * New access token from the session cookie (shared by concurrent callers
   * and by other tabs). null = no session any more (state cleared).
   * Throws on network errors, keeping the current state.
   */
  renew: () => Promise<string | null>
  /** A token valid for at least another minute (socket handshakes). */
  freshToken: () => Promise<string | null>
  /**
   * Re-reads the profile (level/XP after a quiz, account status after an admin
   * approved a teacher). Logs out if the session is over or the account is disabled.
   */
  refreshProfile: () => Promise<void>
  /** Keeps this device logged in; others must log in again. */
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  /** Ends this browser's session on the server, then locally. */
  logout: () => Promise<void>
  /** "Đăng xuất mọi thiết bị". */
  logoutEverywhere: () => Promise<void>
  /** Local only: the server already said the session is over. */
  clear: () => void
}

/** Seconds-since-epoch `exp` of a JWT, without verifying it (the server does). */
function expiresAt(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number }
    return (payload.exp ?? 0) * 1000
  } catch {
    return 0
  }
}

/**
 * One refresh at a time, across tabs too: the cookie is rotated on every
 * refresh, so two tabs racing with the same cookie would look like a replay.
 */
function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  return locks ? locks.request('enquiz-session-refresh', fn) : fn()
}

let inflight: Promise<string | null> | null = null

export const useAuthStore = create<AuthState>()((set, get) => {
  const apply = ({ accessToken, user }: AuthResult) => {
    set({ token: accessToken, user, status: 'ready' })
    return accessToken
  }

  return {
    token: null,
    user: null,
    status: 'loading',

    async init() {
      try {
        localStorage.removeItem(LEGACY_STORAGE_KEY)
      } catch {
        // Storage blocked: nothing to clean.
      }
      try {
        await get().renew()
      } catch {
        // Offline at start-up: show the login page; logging in will retry.
      } finally {
        set({ status: 'ready' })
      }
    },

    async login(payload) {
      const result = await authApi.login(payload)
      apply(result)
      return result.user
    },

    async register(payload) {
      const result = await authApi.register(payload)
      apply(result)
      return result.user
    },

    renew() {
      inflight ??= withRefreshLock(() => authApi.refresh())
        .then(apply, (err: unknown) => {
          if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
            get().clear()
            return null
          }
          throw err
        })
        .finally(() => {
          inflight = null
        })
      return inflight
    },

    async freshToken() {
      const token = get().token
      if (!token) return null
      if (expiresAt(token) - Date.now() > RENEW_MARGIN_MS) return token
      return get().renew()
    },

    async refreshProfile() {
      const user = await authApi.profile()
      set({ user })
    },

    async changePassword(currentPassword, newPassword) {
      const username = get().user?.username ?? ''
      apply(await authApi.changePassword(username, currentPassword, newPassword))
    },

    async logout() {
      try {
        await authApi.logout()
      } catch {
        // Offline: the session ends by itself (12 h / 7 days); forget it here anyway.
      }
      get().clear()
    },

    async logoutEverywhere() {
      await authApi.logoutAll()
      get().clear()
    },

    clear() {
      // Another account may log in next: drop every cached response.
      queryClient.clear()
      set({ token: null, user: null, status: 'ready' })
    },
  }
})

/** Where each role lands after login. */
export function homePathFor(user: Pick<User, 'role'> | null): string {
  if (!user) return '/login'
  return user.role === 'student' ? '/home' : '/teacher'
}
