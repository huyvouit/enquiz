import { useMutation, useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTeachingClasses } from '@/features/classes'
import { quizzesApi, type QuizSummary } from '@/features/quizzes'
import { errorMessage } from '@/shared/api/http'
import { GRADE_LEVELS } from '@/shared/api/types'
import { Button, Card, ErrorBox, Field, Input, PageHeader, Select, Spinner, Toggle } from '@/shared/components'
import { cn } from '@/shared/lib/cn'
import { liveApi } from '../api/live.api'
import type { CreateLiveMatchInput } from '../types'

const TIMES = [10, 20, 30, 60] as const

/**
 * /teacher/live/new — open a live room (plan 5, UC1): quiz, optional class,
 * time per question, guests, auto-advance. Only multiple-choice questions
 * are played; the server refuses a quiz without any.
 */
export function LiveSetupPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [quizId, setQuizId] = useState(params.get('quizId') ?? '')
  const [picked, setPicked] = useState<QuizSummary | null>(null)
  const [classId, setClassId] = useState(params.get('classId') ?? '')
  const [questionTimeSec, setQuestionTimeSec] = useState<(typeof TIMES)[number]>(20)
  const [allowGuests, setAllowGuests] = useState(false)
  const [autoAdvance, setAutoAdvance] = useState(false)

  const classes = useTeachingClasses()
  // A quiz given in the URL (from the dashboard): show its title.
  const preset = useQuery({
    queryKey: ['live', 'setup', 'quiz', quizId],
    queryFn: () => quizzesApi.detail(quizId),
    enabled: quizId !== '' && picked?.id !== quizId,
  })
  const selected: Pick<QuizSummary, 'id' | 'title' | 'coverEmoji' | 'questionCount' | 'gradeLevel'> | null =
    picked?.id === quizId ? picked : preset.data ?? null

  const create = useMutation({
    mutationFn: (input: CreateLiveMatchInput) => liveApi.createMatch(input),
    onSuccess: (m) => navigate(`/teacher/live/${m.matchId}/host`),
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!quizId) return
    create.mutate({
      quizId,
      ...(classId ? { classId } : {}),
      questionTimeSec,
      allowGuests,
      autoAdvance,
    })
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="⚔️ Mở phòng Đấu trường"
        subtitle="Học sinh vào bằng mã PIN hoặc mã QR trên màn chiếu. Chỉ câu trắc nghiệm được chơi."
        actions={
          <Button variant="secondary" onClick={() => navigate('/teacher/live')}>
            ← Lịch sử trận
          </Button>
        }
      />
      <form onSubmit={submit} className="flex flex-col gap-5">
        <Card className="flex flex-col gap-4">
          <h2 className="text-xl font-bold">1. Chọn bài quiz</h2>
          {selected ? (
            <div className="flex items-center gap-3 rounded-2xl bg-brand-soft px-4 py-3">
              <span className="text-3xl" aria-hidden>
                {selected.coverEmoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{selected.title}</p>
                <p className="text-sm text-ink-soft">
                  Khối {selected.gradeLevel} · {selected.questionCount} câu
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setQuizId('')
                  setPicked(null)
                }}
              >
                Đổi bài
              </Button>
            </div>
          ) : quizId && preset.isPending ? (
            <Spinner label="Đang tải bài quiz..." />
          ) : (
            <QuizPicker
              onPick={(q) => {
                setPicked(q)
                setQuizId(q.id)
              }}
            />
          )}
        </Card>

        <Card className="flex flex-col gap-4">
          <h2 className="text-xl font-bold">2. Cài đặt phòng</h2>
          <Field
            label="Lớp"
            hint="Gắn lớp: chỉ học sinh của lớp vào được, bảng xếp hạng hiện họ tên đầy đủ. Không gắn lớp: học sinh hiện tên rút gọn."
          >
            <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">Không gắn lớp (phòng mở)</option>
              {(classes.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.studentCount} em)
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-bold">Thời gian mỗi câu</span>
            <div className="flex flex-wrap gap-2">
              {TIMES.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={questionTimeSec === t}
                  onClick={() => setQuestionTimeSec(t)}
                  className={cn(
                    'min-h-11 rounded-xl border-2 px-4 py-2 font-bold',
                    questionTimeSec === t
                      ? 'border-brand bg-brand-soft text-brand-dark'
                      : 'border-line bg-surface hover:border-brand',
                  )}
                >
                  {t} giây
                </button>
              ))}
            </div>
          </div>

          <Toggle
            checked={allowGuests}
            onChange={setAllowGuests}
            label="Cho khách vãng lai vào (không cần tài khoản, chỉ nhập biệt danh)"
          />
          <Toggle checked={autoAdvance} onChange={setAutoAdvance} label="Tự chuyển câu sau 5 giây" />
        </Card>

        {create.error ? <ErrorBox message={errorMessage(create.error)} /> : null}
        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={!quizId} loading={create.isPending}>
            ⚔️ Mở phòng
          </Button>
        </div>
      </form>
    </div>
  )
}

/** Search the quizzes the teacher can see (own, shared, system). */
function QuizPicker({ onPick }: { onPick: (q: QuizSummary) => void }) {
  const [search, setSearch] = useState('')
  const [grade, setGrade] = useState('')
  const list = useQuery({
    queryKey: ['live', 'setup', 'quizzes', search.trim(), grade],
    queryFn: () =>
      quizzesApi.list({
        search: search.trim() || undefined,
        gradeLevel: grade ? Number(grade) : undefined,
        limit: 20,
      }),
  })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Input
          className="min-w-48 flex-1"
          placeholder="Tìm theo tên bài quiz..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select className="w-36" value={grade} onChange={(e) => setGrade(e.target.value)}>
          <option value="">Mọi khối</option>
          {GRADE_LEVELS.map((g) => (
            <option key={g} value={g}>
              Khối {g}
            </option>
          ))}
        </Select>
      </div>
      {list.isPending ? (
        <Spinner />
      ) : list.error ? (
        <ErrorBox message={errorMessage(list.error)} onRetry={() => void list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <p className="py-4 text-center font-semibold text-ink-soft">Không tìm thấy bài quiz nào.</p>
      ) : (
        <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
          {list.data.items.map((q) => (
            <li key={q.id}>
              <button
                type="button"
                onClick={() => onPick(q)}
                className="flex w-full items-center gap-3 rounded-2xl border-2 border-line bg-surface px-4 py-3 text-left hover:border-brand"
              >
                <span className="text-2xl" aria-hidden>
                  {q.coverEmoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{q.title}</span>
                  <span className="text-sm text-ink-soft">
                    Khối {q.gradeLevel} · {q.questionCount} câu · {q.author ? q.author.fullName : 'Quiz hệ thống'}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
