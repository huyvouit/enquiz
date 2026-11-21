import { io, type Socket } from 'socket.io-client'

/**
 * Origin of the live quiz socket server (plan 5, D19).
 * - Dev: empty → same origin; Vite forwards /socket.io to the API (ws: true).
 * - Production: the Cloud Run URL. Firebase Hosting rewrites do not forward
 *   WebSocket, so the socket cannot use /api like REST calls do.
 */
export const LIVE_URL = String(import.meta.env.VITE_LIVE_URL ?? '').replace(/\/$/, '')

/**
 * Opens the `/live` namespace. The JWT goes in the handshake (`auth.token`),
 * checked once by the server; null = anonymous (guest, plan 5.3).
 * WebSocket first; long-polling only when a school network blocks it.
 * Refusals arrive as `connect_error` with message `unauthorized` | `pending`.
 */
export function connectLive(token: string | null): Socket {
  return io(`${LIVE_URL}/live`, {
    auth: token ? { token } : {},
    transports: ['websocket', 'polling'],
    tryAllTransports: true,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 5_000,
    timeout: 10_000,
  })
}

export interface LiveWhoAmI {
  user: { userId: string; role: 'student' | 'teacher' | 'admin' } | null
  clientIp: string
  serverNow: string
}

/** Who the server thinks this socket is (also used to check TRUST_PROXY). */
export const liveWhoAmI = (socket: Socket) =>
  socket.timeout(5_000).emitWithAck('session:whoami') as Promise<LiveWhoAmI>
