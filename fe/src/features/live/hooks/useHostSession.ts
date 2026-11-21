import { useState } from 'react'
import { useAuthStore } from '@/features/auth'
import type { LiveHostView } from '../types'
import { useLiveSocket } from './useLiveSocket'

/**
 * The projector's side of a match: attaches to the room (again after every
 * reconnect or F5, plan L10) and keeps the latest `host:state` snapshot.
 */
export function useHostSession(matchId: string) {
  const token = useAuthStore((s) => s.token)
  const [view, setView] = useState<LiveHostView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [closed, setClosed] = useState(false)

  const live = useLiveSocket(token, {
    onConnect: async (socket) => {
      const ack = (await socket.timeout(10_000).emitWithAck('host:attach', { matchId }).catch(() => null)) as
        | { ok: true; state: LiveHostView }
        | { ok: false; message: string }
        | null
      if (!ack) setError('Máy chủ chưa trả lời, đang thử lại...')
      else if (ack.ok) {
        setView(ack.state)
        setError(null)
      } else setError(ack.message)
    },
    events: {
      'host:state': (state: LiveHostView) => setView(state),
      'room:closed': () => setClosed(true),
    },
  })

  /** host:start | host:next | host:end | host:kick; returns an error message or null. */
  async function command(event: 'host:start' | 'host:next' | 'host:end' | 'host:kick', payload?: object) {
    const ack = await live.emit(event, payload)
    return ack.ok ? null : ack.message
  }

  return {
    view,
    error,
    closed,
    connection: live.connection,
    start: () => command('host:start'),
    next: () => command('host:next'),
    end: () => command('host:end'),
    kick: (playerId: string) => command('host:kick', { playerId }),
  }
}
