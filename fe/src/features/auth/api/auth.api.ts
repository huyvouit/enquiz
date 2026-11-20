import { api } from '@/shared/api/http'
import type { AuthResult, LoginPayload, RegisterPayload, User } from '../types'

export const authApi = {
  login: (payload: LoginPayload) => api.post<AuthResult>('/auth/login', payload),
  register: (payload: RegisterPayload) => api.post<AuthResult>('/auth/register', payload),
  profile: () => api.get<User>('/users/profile'),
}
