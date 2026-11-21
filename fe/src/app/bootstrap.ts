import { useAuthStore } from '@/features/auth'
import { configureHttp } from '@/shared/api/http'
import { forgetChunkReload } from './chunk-reload'

/** Wires app-wide concerns that `shared/` must not import directly. */
export function bootstrap() {
  configureHttp({
    getToken: () => useAuthStore.getState().token,
    renewToken: () => useAuthStore.getState().renew(),
    // Session over or revoked: forget it; route guards send the user to /login.
    onUnauthorized: () => useAuthStore.getState().clear(),
  })
  forgetChunkReload()
}
