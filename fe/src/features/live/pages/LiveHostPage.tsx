import QRCode from 'qrcode'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, ErrorBox, Spinner } from '@/shared/components'
import { cn } from '@/shared/lib/cn'
import { confettiShower } from '@/shared/lib/celebrate'
import { playSfx } from '@/shared/sound'
import { DistributionBars, Leaderboard, OptionTiles, Podium } from '../components/LiveBoards'
import { useHostSession } from '../hooks/useHostSession'
import { useSecondsLeft } from '../hooks/useServerClock'
import type { LiveHostView } from '../types'

/**
 * /teacher/live/:matchId/host — the projector (plan 5, UC2–UC4).
 * Full screen, outside AppLayout, very large text. Reattaches by itself
 * after F5 or a dropped connection (L10).
 */
export function LiveHostPage() {
  const { matchId = '' } = useParams()
  const host = useHostSession(matchId)
  const { view } = host
  const [actionError, setActionError] = useState<string | null>(null)

  async function run(action: () => Promise<string | null>) {
    setActionError(null)
    const err = await action()
    if (err) setActionError(err)
  }

  if (host.closed || view?.phase === 'ended') return <Closed matchId={matchId} />
  if (!view) {
    return (
      <Screen>
        {host.error ? (
          <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-16">
            <ErrorBox message={host.error} />
            <Link to="/teacher/live" className="font-bold text-brand hover:underline">
              ← Về Đấu trường
            </Link>
          </div>
        ) : (
          <Spinner label="Đang mở phòng..." />
        )}
      </Screen>
    )
  }

  const inGame = view.phase !== 'lobby' && view.phase !== 'podium'
  return (
    <Screen>
      <header className="flex flex-wrap items-center gap-3 border-b-2 border-line bg-surface px-6 py-3">
        <p className="min-w-0 flex-1 truncate text-xl font-extrabold">
          <span aria-hidden>{view.coverEmoji} </span>
          {view.quizTitle}
          {view.className ? <span className="font-semibold text-ink-soft"> · {view.className}</span> : null}
        </p>
        {view.questionIndex >= 0 ? (
          <span className="rounded-full bg-brand-soft px-4 py-1 text-lg font-bold text-brand-dark">
            Câu {view.questionIndex + 1}/{view.totalQuestions}
          </span>
        ) : null}
        <span className="rounded-full bg-sky-soft px-4 py-1 text-lg font-bold text-sky-900">
          PIN {view.pin}
        </span>
        {inGame ? (
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              if (window.confirm('Kết thúc trận ngay? Chỉ các câu đã công bố đáp án được tính điểm.')) {
                void run(host.end)
              }
            }}
          >
            Kết thúc trận
          </Button>
        ) : null}
      </header>
      {host.connection === 'reconnecting' ? (
        <p className="bg-sunny-soft px-6 py-2 text-center font-bold text-amber-900" role="status">
          📡 Mất kết nối, đang kết nối lại... Trận đấu vẫn tiếp tục trên máy chủ.
        </p>
      ) : null}
      {actionError ? (
        <div className="mx-auto mt-4 w-full max-w-3xl px-6">
          <ErrorBox message={actionError} />
        </div>
      ) : null}

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-6 py-6">
        {view.phase === 'lobby' ? (
          <Lobby view={view} onStart={() => run(host.start)} onEnd={() => run(host.end)} onKick={(id) => run(() => host.kick(id))} />
        ) : view.phase === 'countdown' ? (
          <Countdown view={view} />
        ) : view.phase === 'answering' ? (
          <Answering view={view} onSkip={() => run(host.next)} />
        ) : view.phase === 'reveal' ? (
          <Reveal view={view} onNext={() => run(host.next)} />
        ) : view.phase === 'leaderboard' ? (
          <LeaderboardPhase view={view} onNext={() => run(host.next)} />
        ) : (
          <PodiumPhase view={view} matchId={matchId} onEnd={() => run(host.end)} />
        )}
      </main>
    </Screen>
  )
}

function Screen({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh flex-col bg-canvas">{children}</div>
}

function Closed({ matchId }: { matchId: string }) {
  return (
    <Screen>
      <div className="mx-auto flex max-w-xl flex-col items-center gap-5 px-6 py-24 text-center">
        <p className="text-6xl" aria-hidden>
          🏁
        </p>
        <h1 className="text-4xl font-extrabold">Phòng đã đóng</h1>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to={`/teacher/live/${matchId}`}>
            <Button size="lg">📊 Xem báo cáo</Button>
          </Link>
          <Link to="/teacher/live">
            <Button size="lg" variant="secondary">
              ⚔️ Về Đấu trường
            </Button>
          </Link>
        </div>
      </div>
    </Screen>
  )
}

function Lobby({
  view,
  onStart,
  onEnd,
  onKick,
}: {
  view: LiveHostView
  onStart: () => void
  onEnd: () => void
  onKick: (playerId: string) => void
}) {
  const joinUrl = `${window.location.origin}/live?pin=${view.pin}`
  const [qr, setQr] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    QRCode.toDataURL(joinUrl, { width: 320, margin: 1 })
      .then((url) => alive && setQr(url))
      .catch(() => alive && setQr(null))
    return () => {
      alive = false
    }
  }, [joinUrl])

  return (
    <>
      <div className="grid items-center gap-6 lg:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-3 text-center lg:text-left">
          <p className="text-2xl font-bold text-ink-soft">Vào trang</p>
          <p className="break-all font-display text-3xl font-extrabold text-brand">{joinUrl.replace(/\?pin=.*/, '')}</p>
          <p className="text-2xl font-bold text-ink-soft">và nhập mã PIN</p>
          <p
            className="font-display text-7xl font-extrabold tracking-[0.25em] text-ink sm:text-8xl lg:text-9xl"
            aria-label={`Mã PIN ${view.pin.split('').join(' ')}`}
          >
            {view.pin}
          </p>
          <div className="flex flex-wrap justify-center gap-2 text-lg font-bold lg:justify-start">
            <span className="rounded-full bg-grape-soft px-4 py-1 text-purple-900">
              {view.className ? `🏫 ${view.className}` : '🌐 Phòng mở'}
            </span>
            <span className={cn('rounded-full px-4 py-1', view.allowGuests ? 'bg-grass-soft text-green-900' : 'bg-slate-100 text-ink-soft')}>
              {view.allowGuests ? '🧒 Khách vào được' : '🔒 Chỉ tài khoản học sinh'}
            </span>
            <span className="rounded-full bg-sunny-soft px-4 py-1 text-amber-900">⏱ {view.questionTimeSec} giây/câu</span>
            <span className="rounded-full bg-brand-soft px-4 py-1 text-brand-dark">❓ {view.totalQuestions} câu</span>
          </div>
          {view.skippedCount > 0 ? (
            <p className="font-semibold text-ink-soft">
              ℹ️ {view.skippedCount} câu không phải trắc nghiệm được bỏ qua.
            </p>
          ) : null}
        </div>
        <div className="mx-auto rounded-blob border-4 border-line bg-white p-4">
          {qr ? (
            <img src={qr} alt={`Mã QR vào phòng ${view.pin}`} className="size-64 lg:size-80" />
          ) : (
            <div className="flex size-64 items-center justify-center text-ink-soft lg:size-80">Đang tạo mã QR...</div>
          )}
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="flex-1 text-3xl font-extrabold">
            👧 {view.players.length} người chơi
            {view.players.length !== view.onlineCount ? (
              <span className="text-xl font-semibold text-ink-soft"> ({view.onlineCount} đang online)</span>
            ) : null}
          </h2>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => {
              if (window.confirm('Đóng phòng? Học sinh sẽ bị đưa ra ngoài.')) onEnd()
            }}
          >
            Đóng phòng
          </Button>
          <Button variant="success" size="lg" className="min-h-14 text-2xl" disabled={view.onlineCount === 0} onClick={onStart}>
            Bắt đầu ▶
          </Button>
        </div>
        {view.players.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-line py-10 text-center text-2xl font-semibold text-ink-soft">
            Đang chờ học sinh vào phòng...
          </p>
        ) : (
          <PlayerChips view={view} onKick={onKick} />
        )}
      </section>
    </>
  )
}

function PlayerChips({ view, onKick }: { view: LiveHostView; onKick: (playerId: string) => void }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {view.players.map((p) => (
        <li
          key={p.playerId}
          className={cn(
            'flex items-center gap-2 rounded-full border-2 py-1 pl-4 pr-1 text-xl font-bold',
            p.online ? 'border-brand bg-brand-soft text-brand-dark' : 'border-line bg-slate-100 text-ink-soft opacity-60',
          )}
          title={p.online ? undefined : 'Mất kết nối'}
        >
          {p.isGuest ? <span aria-label="Khách">🧒</span> : null}
          {p.nickname}
          <button
            type="button"
            aria-label={`Mời ${p.nickname} ra khỏi phòng`}
            onClick={() => {
              if (window.confirm(`Mời "${p.nickname}" ra khỏi phòng? Em ấy sẽ không vào lại được trận này.`)) {
                onKick(p.playerId)
              }
            }}
            className="flex size-8 items-center justify-center rounded-full text-base hover:bg-coral hover:text-white"
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  )
}

function BigTimer({ seconds, total }: { seconds: number | null; total?: number }) {
  const low = seconds !== null && seconds <= 5
  return (
    <div
      role="timer"
      className={cn(
        'flex size-28 shrink-0 items-center justify-center rounded-full border-8 font-display text-5xl font-extrabold tabular-nums',
        low ? 'border-coral bg-coral text-white motion-safe:animate-pulse' : 'border-brand bg-surface text-brand',
      )}
      aria-label={seconds === null ? undefined : `Còn ${seconds} giây${total ? ` trên ${total}` : ''}`}
    >
      {seconds ?? '–'}
    </div>
  )
}

function QuestionHeader({ view, timer }: { view: LiveHostView; timer?: React.ReactNode }) {
  const q = view.question
  if (!q) return null
  return (
    <div className="flex items-start gap-6">
      <div className="flex min-w-0 flex-1 flex-col items-center gap-4 text-center">
        {q.mediaUrl ? <img src={q.mediaUrl} alt="" className="max-h-64 w-auto max-w-full rounded-2xl object-contain" /> : null}
        {q.audioUrl ? <AudioButton url={q.audioUrl} /> : null}
        <h1 className="font-display text-4xl font-extrabold leading-tight lg:text-6xl">{q.questionText}</h1>
      </div>
      {timer}
    </div>
  )
}

/** Plays the listening audio on the room's speakers. */
function AudioButton({ url }: { url: string }) {
  const audio = useRef<HTMLAudioElement | null>(null)
  return (
    <Button
      variant="secondary"
      size="lg"
      onClick={() => {
        audio.current?.pause()
        audio.current = new Audio(url)
        void audio.current.play().catch(() => {})
      }}
    >
      🔊 Nghe
    </Button>
  )
}

function Countdown({ view }: { view: LiveHostView }) {
  const seconds = useSecondsLeft(view.phaseEndsAt, view.serverNow)
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8">
      <QuestionHeader view={view} />
      <p className="font-display text-3xl font-bold text-ink-soft">Chuẩn bị... {seconds ?? ''}</p>
    </div>
  )
}

function Answering({ view, onSkip }: { view: LiveHostView; onSkip: () => void }) {
  const seconds = useSecondsLeft(view.answerEndsAt, view.serverNow)
  return (
    <>
      <QuestionHeader view={view} timer={<BigTimer seconds={seconds} total={view.questionTimeSec} />} />
      <OptionTiles options={view.question?.options ?? []} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="font-display text-4xl font-extrabold">
          <span className="text-brand">{view.answeredCount}</span>/{view.onlineCount} em đã trả lời
        </p>
        <Button variant="secondary" size="lg" onClick={onSkip}>
          Bỏ qua ⏭
        </Button>
      </div>
    </>
  )
}

function AutoNext({ view, onNext, label }: { view: LiveHostView; onNext: () => void; label: string }) {
  const seconds = useSecondsLeft(view.autoAdvanceSec ? view.phaseEndsAt : null, view.serverNow)
  return (
    <div className="flex justify-end">
      {view.autoAdvanceSec ? (
        <p className="text-2xl font-bold text-ink-soft">Tự chuyển sau {seconds ?? view.autoAdvanceSec}s</p>
      ) : (
        <Button size="lg" className="min-h-14 text-2xl" onClick={onNext}>
          {label}
        </Button>
      )}
    </div>
  )
}

function Reveal({ view, onNext }: { view: LiveHostView; onNext: () => void }) {
  const options = view.question?.options ?? []
  const reveal = view.reveal
  const last = view.questionIndex >= view.totalQuestions - 1
  return (
    <>
      <QuestionHeader view={view} />
      {reveal ? (
        <>
          <DistributionBars options={options} distribution={reveal.distribution} correctIndex={reveal.correctIndex} />
          <OptionTiles options={options} correctIndex={reveal.correctIndex} size="md" />
        </>
      ) : null}
      <AutoNext view={view} onNext={onNext} label={last ? 'Xem bục vinh quang 🏆' : 'Tiếp ▶'} />
    </>
  )
}

function LeaderboardPhase({ view, onNext }: { view: LiveHostView; onNext: () => void }) {
  return (
    <>
      <h1 className="text-center font-display text-5xl font-extrabold">🏆 Bảng xếp hạng</h1>
      <Leaderboard top={view.top} />
      <AutoNext view={view} onNext={onNext} label="Câu tiếp ▶" />
    </>
  )
}

function PodiumPhase({ view, matchId, onEnd }: { view: LiveHostView; matchId: string; onEnd: () => void }) {
  const navigate = useNavigate()
  const celebrated = useRef(false)
  useEffect(() => {
    if (celebrated.current) return
    celebrated.current = true
    playSfx('levelUp')
    confettiShower(2500)
  }, [])
  const standings = view.standings.length > 0 ? view.standings : view.top
  return (
    <>
      <h1 className="text-center font-display text-5xl font-extrabold">🎉 Bục vinh quang</h1>
      <Podium top={standings.slice(0, 3)} />
      {standings.length > 3 ? (
        <ol className="mx-auto grid w-full max-w-4xl gap-2 sm:grid-cols-2">
          {standings.slice(3).map((s) => (
            <li key={s.playerId} className="flex items-center gap-3 rounded-xl bg-surface px-4 py-2 text-lg font-semibold">
              <span className="w-8 text-center font-bold text-ink-soft">{s.rank}</span>
              <span className="min-w-0 flex-1 truncate">{s.nickname}</span>
              <span className="tabular-nums">{s.score}</span>
            </li>
          ))}
        </ol>
      ) : null}
      <div className="flex flex-wrap justify-center gap-3">
        <Button size="lg" onClick={() => navigate(`/teacher/live/${matchId}`)}>
          📊 Xem báo cáo
        </Button>
        <Button
          variant="secondary"
          size="lg"
          onClick={() => {
            if (window.confirm('Đóng phòng? Màn hình học sinh sẽ kết thúc.')) onEnd()
          }}
        >
          Đóng phòng
        </Button>
      </div>
    </>
  )
}
