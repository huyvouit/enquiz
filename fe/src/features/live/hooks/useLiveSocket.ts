import { useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { useAuthStore } from '@/features/auth'
import { connectLive } from '@/shared/live/socket'
import type { LiveAck } from '../types'

export type ConnectionState = 'connecting' | 'online' | 'reconnecting' | 'refused'

/**
 * One `/live` socket for the lifetime of a screen.
 * `onConnect` runs on the first connection AND after every automatic
 * reconnection (F5 is a new mount): that is where the screen attaches
 * itself again (host:attach / player:join / player:rejoin, plan L10).
 */
export function useLiveSocket(
  /** Logged-in user id, or null for a guest. Not the token: it changes every 15 min. */
  userId: string | null,
  handlers: {
    onConnect: (socket: Socket) => void
    /** Server events: room:state, host:state, player:kicked… */
    events: Record<string, (payload: never) => void>
  },
) {
  const [connection, setConnection] = useState<ConnectionState>('connecting')
  const [refusal, setRefusal] = useState<string | null>(null)
  const socketRef = useRef<Socket | null>(null)
  // Latest handlers without reconnecting when they change.
  const handlersRef = useRef(handlers)
  useEffect(() => {
    handlersRef.current = handlers
  })

  useEffect(() => {
    const socket = connectLive(userId ? () => useAuthStore.getState().freshToken() : null)
    socketRef.current = socket
    socket.on('connect', () => {
      setConnection('online')
      setRefusal(null)
      handlersRef.current.onConnect(socket)
    })
    socket.on('disconnect', (reason) => {
      // Kicked, replaced or closed by the server: no automatic retry.
      setConnection(reason === 'io server disconnect' ? 'refused' : 'reconnecting')
    })
    socket.on('connect_error', (err) => {
      if (err.message === 'unauthorized' || err.message === 'pending') {
        setConnection('refused')
        setRefusal(err.message)
      } else {
        setConnection('reconnecting')
      }
    })
    socket.onAny((event: string, payload: unknown) => handlersRef.current.events[event]?.(payload as never))
    return () => {
      socket.removeAllListeners()
      socket.disconnect()
      socketRef.current = null
    }
  }, [userId])

  /** Sends an event and waits for the server's acknowledgement (10 s). */
  async function emit<T extends object = object>(event: string, payload: object = {}): Promise<LiveAck<T>> {
    const socket = socketRef.current
    if (!socket?.connected) {
      return { ok: false, error: 'offline', message: 'Mất kết nối, đang kết nối lại...' }
    }
    try {
      return (await socket.timeout(10_000).emitWithAck(event, payload)) as LiveAck<T>
    } catch {
      return { ok: false, error: 'timeout', message: 'Máy chủ chưa trả lời, em thử lại nhé' }
    }
  }

  return { connection, refusal, emit }
}
