import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/features/auth'
import { MultipleChoiceGame } from '@/features/play'
import { invalidateProgress } from '@/features/progress'
import { Button, Card, ErrorBox, Mascot, Spinner } from '@/shared/components'
import { confettiBurst } from '@/shared/lib/celebrate'
import { cn } from '@/shared/lib/cn'
import { playSfx } from '@/shared/sound'
import { readStoredPlayer, usePlayerSession, type PlayerExit, type StoredPlayer } from '../hooks/usePlayerSession'
import { useSecondsLeft } from '../hooks/useServerClock'
import type { LivePlayerView, LiveStanding } from '../types'

/**
 * /live/play — a player's device during a match (plan 5.1): full screen,
 * outside AppLayout, works for guests. Everything comes from the latest
 * `room:state` snapshot, so F5 or a dropped connection just redraws (L10).
 */
export function LivePlayPage() {
  const [stored] = useState(readStoredPlayer)
  if (!stored?.pin) return <Navigate to="/live" replace />
  return <Match stored={stored} />
}

function Match({ stored }: { stored: StoredPlayer }) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const session = usePlayerSession(stored)
  const { view } = session

  const leave = () => {
    session.leave()
    navigate(user?.role === 'student' ? '/home' : '/live')
  }

  // Sounds and confetti once per question / match.
  const played = useRef('')
  useEffect(() => {
    if (!view) return
    const key = `${view.phase}:${view.questionIndex}`
    if (played.current === key) return
    played.current = key
    if (view.phase === 'reveal' && view.me.lastResult) {
      playSfx(view.me.lastResult.isCorrect ? 'correct' : 'wrong')
    }
    if (view.phase === 'podium') {
      playSfx('finish')
      if ((view.me.rank ?? 99) <= 3) confettiBurst()
      // XP and history changed for students (L8).
      if (!view.me.isGuest) void invalidateProgress()
    }
  }, [view])

  if (session.exit && !(session.exit === 'closed' && view?.phase === 'podium')) {
    return <Exit reason={session.exit} onLeave={leave} />
  }
  if (session.joinError) {
    return (
      <Shell>
        <Card className="flex max-w-md flex-col items-center gap-4 text-center">
          <ErrorBox message={session.joinError} />
          <Button onClick={() => navigate('/live')}>← Nhập lại mã PIN</Button>
        </Card>
      </Shell>
    )
  }
  if (session.refusal) {
    return (
      <Shell>
        <Card className="flex max-w-md flex-col items-center gap-4 text-center">
          <ErrorBox message="Phiên đăng nhập đã hết hạn. Em đăng nhập lại nhé." />
          <Button onClick={() => navigate('/login', { state: { from: '/live' } })}>Đăng nhập</Button>
        </Card>
      </Shell>
    )
  }
  if (!view) {
    return (
      <Shell>
        <Spinner label="Đang vào phòng..." />
      </Shell>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="flex items-center gap-3 border-b-2 border-line bg-surface px-4 py-3">
        <p className="min-w-0 flex-1 truncate font-extrabold">
          {view.coverEmoji} {view.quizTitle}
        </p>
        {view.questionIndex >= 0 && view.phase !== 'podium' ? (
          <span className="rounded-full bg-brand-soft px-3 py-1 text-sm font-bold text-brand-dark">
            Câu {view.questionIndex + 1}/{view.totalQuestions}
          </span>
        ) : null}
        <span className="rounded-full bg-sunny-soft px-3 py-1 text-sm font-bold">
          {view.me.nickname} · {view.me.score} điểm
        </span>
      </header>
      {session.connection === 'reconnecting' ? (
        <p role="status" className="bg-coral-soft px-4 py-2 text-center font-bold text-rose-900">
          📶 Mất kết nối, đang kết nối lại... Điểm của em vẫn được giữ.
        </p>
      ) : null}
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-5 px-4 py-6">
        <PhaseScreen view={view} chosen={session.chosen} onAnswer={session.answer} onLeave={leave} />
        {session.answerError ? <ErrorBox message={session.answerError} /> : null}
      </main>
    </div>
  )
}

function PhaseScreen({
  view,
  chosen,
  onAnswer,
  onLeave,
}: {
  view: LivePlayerView
  chosen: number | null
  onAnswer: (choice: number) => void
  onLeave: () => void
}) {
  switch (view.phase) {
    case 'lobby':
      return (
        <Card className="flex flex-col items-center gap-4 text-center">
          <motion.p
            className="text-6xl"
            animate={{ y: [0, -10, 0] }}
            transition={{ repeat: Infinity, duration: 1.4 }}
            aria-hidden
          >
            🎉
          </motion.p>
          <h1 className="text-3xl font-extrabold">Em đã vào phòng!</h1>
          <p className="font-display text-4xl font-extrabold text-brand">{view.me.nickname}</p>
          <p className="text-lg font-semibold text-ink-soft">
            Nhìn lên màn hình của cô nhé. Đang chờ bắt đầu... ({view.playerCount} bạn)
          </p>
        </Card>
      )
    case 'countdown':
      return <Countdown view={view} />
    case 'answering':
      return <Answering view={view} chosen={chosen} onAnswer={onAnswer} />
    case 'reveal':
      return <Reveal view={view} />
    case 'leaderboard':
      return <Board view={view} title="Bảng xếp hạng" />
    case 'podium':
      return (
        <>
          <Board view={view} title="Kết thúc trận! 🏆" />
          <Button size="lg" className="min-h-14 self-center" onClick={onLeave}>
            {view.me.isGuest ? 'Chơi phòng khác' : '🏠 Về trang chủ'}
          </Button>
        </>
      )
    default:
      return <Exit reason="closed" onLeave={onLeave} />
  }
}

function QuestionCard({ view }: { view: LivePlayerView }) {
  const q = view.question
  if (!q) return null
  return (
    <Card className="flex flex-col items-center gap-3 text-center">
      {q.mediaUrl ? <img src={q.mediaUrl} alt="" className="max-h-48 w-auto rounded-2xl object-contain" /> : null}
      {q.audioUrl ? <AudioButton url={q.audioUrl} /> : null}
      <h1 className="font-display text-2xl font-extrabold sm:text-3xl">{q.questionText}</h1>
    </Card>
  )
}

function AudioButton({ url }: { url: string }) {
  return (
    <Button variant="secondary" className="min-h-12" onClick={() => void new Audio(url).play().catch(() => {})}>
      🔊 Nghe
    </Button>
  )
}

function Countdown({ view }: { view: LivePlayerView }) {
  const left = useSecondsLeft(view.phaseEndsAt, view.serverNow)
  return (
    <>
      <QuestionCard view={view} />
      <p className="text-center font-display text-3xl font-extrabold text-brand">Chuẩn bị... {left ?? ''}</p>
    </>
  )
}

function Answering({
  view,
  chosen,
  onAnswer,
}: {
  view: LivePlayerView
  chosen: number | null
  onAnswer: (choice: number) => void
}) {
  const left = useSecondsLeft(view.answerEndsAt, view.serverNow)
  const options = view.question?.options ?? []
  return (
    <>
      <div className="flex items-center justify-center">
        <span
          role="timer"
          className={cn(
            'rounded-2xl px-5 py-2 font-display text-3xl font-extrabold tabular-nums',
            (left ?? 99) <= 5 ? 'bg-coral text-white' : 'bg-sky-soft text-sky-900',
          )}
        >
          ⏱ {left ?? ''}
        </span>
      </div>
      <QuestionCard view={view} />
      <MultipleChoiceGame
        options={options}
        value={chosen === null ? undefined : options[chosen]}
        onChange={(option) => onAnswer(options.indexOf(option))}
        disabled={chosen !== null || left === 0}
        selectedIcon="✔️"
      />
      <AnimatePresence>
        {chosen !== null ? (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center text-xl font-bold text-ink-soft"
            role="status"
          >
            Đã chọn ✔️ Chờ các bạn khác nhé...
          </motion.p>
        ) : null}
      </AnimatePresence>
    </>
  )
}

function Reveal({ view }: { view: LivePlayerView }) {
  const result = view.me.lastResult
  const options = view.question?.options ?? []
  const correct = view.reveal ? options[view.reveal.correctIndex] : undefined
  const answered = view.me.answer !== null
  return (
    <>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={cn(
          'rounded-blob px-6 py-5 text-center text-white shadow-pop',
          result?.isCorrect ? 'bg-grass' : 'bg-coral',
        )}
        role="status"
      >
        <p className="font-display text-4xl font-extrabold">
          {result?.isCorrect ? 'Đúng rồi! 🎉' : answered ? 'Chưa đúng 😢' : 'Hết giờ ⏰'}
        </p>
        {result?.isCorrect ? <p className="text-2xl font-bold">+{result.points} điểm</p> : null}
      </motion.div>
      <MultipleChoiceGame
        options={options}
        value={view.me.answer === null ? undefined : options[view.me.answer]}
        onChange={() => {}}
        disabled
        correctAnswer={correct}
      />
      <p className="text-center text-lg font-bold">
        Tổng: {view.me.score} điểm{view.me.rank ? ` · Hạng ${view.me.rank}/${view.playerCount}` : ''}
      </p>
    </>
  )
}

function Board({ view, title }: { view: LivePlayerView; title: string }) {
  const inTop = view.top.some((t) => t.playerId === view.me.playerId)
  return (
    <Card className="flex flex-col gap-3">
      <h1 className="text-center text-3xl font-extrabold">{title}</h1>
      <ol className="flex flex-col gap-2">
        {view.top.map((t, i) => (
          <StandingRow key={t.playerId} standing={t} mine={t.playerId === view.me.playerId} delay={i * 0.08} />
        ))}
      </ol>
      {!inTop && view.me.rank ? (
        <p className="rounded-2xl bg-brand-soft px-4 py-3 text-center text-lg font-bold">
          Em: hạng {view.me.rank}/{view.playerCount} · {view.me.score} điểm
        </p>
      ) : null}
    </Card>
  )
}

const MEDALS = ['🥇', '🥈', '🥉']

function StandingRow({ standing, mine, delay }: { standing: LiveStanding; mine: boolean; delay: number }) {
  return (
    <motion.li
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className={cn(
        'flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-lg font-bold',
        mine ? 'border-brand bg-brand-soft' : 'border-line bg-surface',
      )}
    >
      <span className="w-10 text-center text-2xl">{MEDALS[standing.rank - 1] ?? standing.rank}</span>
      <span className="min-w-0 flex-1 truncate">{standing.nickname}</span>
      <span className="font-display tabular-nums text-brand">{standing.score}</span>
    </motion.li>
  )
}

const EXIT_TEXT: Record<PlayerExit, string> = {
  kicked: 'Cô đã mời em ra khỏi phòng này.',
  replaced: 'Em đã vào phòng từ một máy hoặc tab khác.',
  closed: 'Phòng đã đóng. Cảm ơn em đã tham gia!',
}

function Exit({ reason, onLeave }: { reason: PlayerExit; onLeave: () => void }) {
  return (
    <Shell>
      <Card className="flex max-w-md flex-col items-center gap-4 text-center">
        <Mascot mood="happy" message={EXIT_TEXT[reason]} />
        <Button size="lg" onClick={onLeave}>
          Xong
        </Button>
      </Card>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-10">{children}</div>
}
