import { useState } from 'react'
import type { Socket } from 'socket.io-client'
import { useAuthStore } from '@/features/auth'
import type { LiveAck, LivePlayerView } from '../types'
import { useLiveSocket } from './useLiveSocket'

const STORAGE_KEY = 'enquiz.live.player'

/**
 * What survives F5 in this tab (plan L10): the PIN, the nickname typed by a
 * guest and, once joined, the guest's playerId + secret rejoinToken.
 * sessionStorage: per tab, gone when the tab closes.
 */
export interface StoredPlayer {
  pin: string
  nickname?: string
  playerId?: string
  rejoinToken?: string
}

export function readStoredPlayer(): StoredPlayer | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoredPlayer) : null
  } catch {
    return null
  }
}

export function storePlayer(value: StoredPlayer | null) {
  try {
    if (value) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Private mode: reconnecting after F5 then needs the PIN again.
  }
}

/** Why the player is out of the match, if they are. */
export type PlayerExit = 'kicked' | 'replaced' | 'closed'

type JoinAck = LiveAck<{ playerId: string; rejoinToken?: string; state: LivePlayerView }>

/**
 * A player's side of a match. Joins on connect and again after every
 * reconnect: a student by account (the server gives back the same place),
 * a guest with the stored rejoinToken (L10), falling back to a fresh join.
 */
export function usePlayerSession(stored: StoredPlayer) {
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const [view, setView] = useState<LivePlayerView | null>(null)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [exit, setExit] = useState<PlayerExit | null>(null)
  const [pending, setPending] = useState<{ questionIndex: number; choice: number } | null>(null)
  const [answerError, setAnswerError] = useState<string | null>(null)

  async function attach(socket: Socket) {
    const send = (event: string, payload: object) =>
      socket
        .timeout(10_000)
        .emitWithAck(event, payload)
        .catch(() => ({ ok: false, error: 'timeout', message: 'Máy chủ chưa trả lời, em thử lại nhé' })) as Promise<JoinAck>

    const current = readStoredPlayer() ?? stored
    let ack: JoinAck | null = null
    if (!userId && current.playerId && current.rejoinToken) {
      ack = await send('player:rejoin', {
        pin: current.pin,
        playerId: current.playerId,
        rejoinToken: current.rejoinToken,
      })
    }
    if (!ack?.ok) {
      ack = await send('player:join', { pin: current.pin, nickname: current.nickname })
    }
    if (!ack.ok) {
      setJoinError(ack.message)
      return
    }
    setJoinError(null)
    setView(ack.state)
    storePlayer({
      pin: current.pin,
      nickname: current.nickname,
      playerId: ack.playerId,
      rejoinToken: ack.rejoinToken ?? current.rejoinToken,
    })
  }

  const live = useLiveSocket(userId, {
    onConnect: (socket) => void attach(socket),
    events: {
      'room:state': (state: LivePlayerView) => setView(state),
      'player:kicked': () => setExit('kicked'),
      'player:replaced': () => setExit('replaced'),
      'room:closed': () => setExit('closed'),
    },
  })

  /** Sends the choice once; the tile shows it at once (optimistic). */
  async function answer(choice: number) {
    if (!view || view.phase !== 'answering' || view.me.answer !== null || pending) return
    const mine = { questionIndex: view.questionIndex, choice }
    setPending(mine)
    setAnswerError(null)
    const ack = await live.emit('player:answer', mine)
    if (!ack.ok) {
      setPending(null)
      if (ack.error !== 'already_answered') setAnswerError(ack.message)
    }
  }

  // The optimistic choice only applies to the question it was made for.
  const chosen =
    view?.me.answer ?? (pending && pending.questionIndex === view?.questionIndex ? pending.choice : null)

  return {
    view,
    chosen,
    joinError,
    exit,
    answerError,
    connection: live.connection,
    refusal: live.refusal,
    answer,
    leave: () => storePlayer(null),
  }
}
