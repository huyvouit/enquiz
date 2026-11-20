import { useCallback, useEffect, useRef, useState } from 'react'
import { isAnswered, type PlayAnswer } from '@/features/play'
import { examApi, type SheetPayload } from '../api/exam.api'
import type { AnswerSheet, ExamSession } from '../types'

/** Server save at most this long after the last change (plan E2). */
const SAVE_DEBOUNCE_MS = 10_000

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

export interface Draft {
  answers: AnswerSheet
  flagged: string[]
  /** Index of the question on screen. */
  current: number
}

interface LocalCopy extends Draft {
  savedAt: number
}

const storageKey = (sessionId: string) => `enquiz.exam.${sessionId}`

function readLocal(sessionId: string): LocalCopy | null {
  try {
    const raw = localStorage.getItem(storageKey(sessionId))
    return raw ? (JSON.parse(raw) as LocalCopy) : null
  } catch {
    return null
  }
}

function writeLocal(sessionId: string, draft: Draft) {
  try {
    localStorage.setItem(storageKey(sessionId), JSON.stringify({ ...draft, savedAt: Date.now() }))
  } catch {
    // Private mode / full storage: the server draft still works.
  }
}

export function clearLocalDraft(sessionId: string) {
  try {
    localStorage.removeItem(storageKey(sessionId))
  } catch {
    // ignore
  }
}

/** Something was entered (a half-built sentence counts too). */
export function hasAnswer(answer: PlayAnswer | undefined): boolean {
  if (answer === undefined) return false
  return typeof answer === 'string' ? answer.trim() !== '' : answer.length > 0
}

/** What the server stores: questions with something entered. */
export function toPayload(draft: Draft): SheetPayload {
  return {
    answers: Object.entries(draft.answers)
      .filter(([, a]) => hasAnswer(a))
      .map(([questionId, answer]) => ({ questionId, answer })),
    flagged: draft.flagged,
  }
}

/**
 * Starting point: the server draft, or this device's copy when it is newer
 * (saved locally after the last server save). The second value says the
 * server is behind.
 */
function initialDraft(session: ExamSession): [Draft, boolean] {
  const fromServer: AnswerSheet = Object.fromEntries(
    session.answers.map((a) => [a.questionId, a.answer as PlayAnswer]),
  )
  const local = readLocal(session.sessionId)
  const serverAt = session.draftSavedAt ? new Date(session.draftSavedAt).getTime() : 0
  const localNewer = local !== null && local.savedAt > serverAt
  const answers = localNewer ? local.answers : fromServer
  const firstOpen = session.questions.findIndex((q) => !isAnswered(q, answers[q.id]))
  const current = local?.current ?? (firstOpen === -1 ? 0 : firstOpen)
  return [
    {
      answers,
      flagged: localNewer ? local.flagged : session.flagged,
      current: Math.min(Math.max(current, 0), session.questions.length - 1),
    },
    localNewer,
  ]
}

/**
 * The answer sheet of the exam room (plan E2): every change is kept on the
 * device at once and sent to the server when moving between questions,
 * when flagging, 10 seconds after the last change, and when the tab is
 * hidden. If the tab is closed, the server grades the saved draft (E5).
 */
export function useExamDraft(session: ExamSession) {
  const { sessionId } = session
  const [init] = useState(() => initialDraft(session))
  const [draft, setDraft] = useState<Draft>(init[0])
  const [saveState, setSaveState] = useState<SaveState>(init[1] ? 'dirty' : 'saved')
  const latest = useRef(draft)
  const dirty = useRef(init[1])
  const inFlight = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  const stopped = useRef(false)

  const saveNow = useCallback(async () => {
    window.clearTimeout(timer.current)
    if (stopped.current || !dirty.current || inFlight.current) return
    dirty.current = false
    inFlight.current = true
    setSaveState('saving')
    try {
      await examApi.saveDraft(sessionId, toPayload(latest.current))
      setSaveState(dirty.current ? 'dirty' : 'saved')
    } catch {
      // Time is up or offline: the local copy stays, the next try resends.
      dirty.current = true
      setSaveState('error')
    } finally {
      inFlight.current = false
    }
  }, [sessionId])

  /** `toServer: false` for moves that only change the question on screen. */
  const update = useCallback(
    (change: (d: Draft) => Draft, toServer = true) => {
      const next = change(latest.current)
      latest.current = next
      setDraft(next)
      writeLocal(sessionId, next)
      if (!toServer) return
      dirty.current = true
      setSaveState('dirty')
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => void saveNow(), SAVE_DEBOUNCE_MS)
    },
    [sessionId, saveNow],
  )

  useEffect(() => {
    // A newer local copy than the server's: send it right away.
    if (dirty.current) void saveNow()
    const onHide = () => document.visibilityState === 'hidden' && void saveNow()
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      void saveNow()
    }
  }, [saveNow])

  return {
    draft,
    saveState,
    /** The freshest sheet, for the hand-in. */
    latest,
    setAnswer: (questionId: string, answer: PlayAnswer) =>
      update((d) => ({ ...d, answers: { ...d.answers, [questionId]: answer } })),
    toggleFlag: (questionId: string) => {
      update((d) => ({
        ...d,
        flagged: d.flagged.includes(questionId)
          ? d.flagged.filter((id) => id !== questionId)
          : [...d.flagged, questionId],
      }))
      void saveNow()
    },
    goTo: (index: number) => {
      update((d) => ({ ...d, current: index }), false)
      void saveNow()
    },
    /** After the hand-in: no more saves, forget the local copy. */
    stop: () => {
      stopped.current = true
      window.clearTimeout(timer.current)
      clearLocalDraft(sessionId)
    },
  }
}
