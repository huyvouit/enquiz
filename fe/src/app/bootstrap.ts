import { useAuthStore } from '@/features/auth'
import { configureHttp } from '@/shared/api/http'
import { forgetChunkReload } from './chunk-reload'

/** Wires app-wide concerns that `shared/` must not import directly. */
export function bootstrap() {
  configureHttp({
    getToken: () => useAuthStore.getState().token,
    // Expired/invalid token: drop the session; route guards send the user to /login.
    onUnauthorized: () => useAuthStore.getState().logout(),
  })
  forgetChunkReload()
}
