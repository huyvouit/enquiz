import { Reorder } from 'framer-motion'
import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { QuestionForm, QUESTION_TYPE_LABELS, type Question } from '@/features/questions'
import { errorMessage } from '@/shared/api/http'
import { GRADE_LEVELS } from '@/shared/api/types'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Textarea,
  Toggle,
} from '@/shared/components'
import { cn } from '@/shared/lib/cn'
import { quizzesApi } from '../api/quizzes.api'
import { QuestionPicker } from '../components/QuestionPicker'
import { invalidateQuizzes, useQuizDetail } from '../hooks/queries'
import { COVER_EMOJIS, type QuizDetail, type QuizPayload } from '../types'

interface BuilderState {
  title: string
  description: string
  topic: string
  gradeLevel: number
  coverEmoji: string
  published: boolean
  shuffleQuestions: boolean
  questions: Question[]
}

const EMPTY: BuilderState = {
  title: '',
  description: '',
  topic: '',
  gradeLevel: 1,
  coverEmoji: '📘',
  published: true,
  shuffleQuestions: false,
  questions: [],
}

function fromDetail(q: QuizDetail): BuilderState {
  return {
    title: q.title,
    description: q.description ?? '',
    topic: q.topic,
    gradeLevel: q.gradeLevel,
    coverEmoji: q.coverEmoji,
    published: q.status === 'published',
    shuffleQuestions: q.settings.shuffleQuestions,
    questions: q.questions,
  }
}

/** /teacher/quizzes/new and /teacher/quizzes/:id/edit — loads, then renders the form. */
export function QuizBuilderPage() {
  const { id } = useParams()
  const existing = useQuizDetail(id)

  if (existing.isLoading) return <Spinner />
  if (existing.error) {
    return <ErrorBox message={errorMessage(existing.error)} onRetry={() => void existing.refetch()} />
  }
  // `key` remounts the form (fresh state) when switching between quizzes.
  return <QuizBuilderForm key={id ?? 'new'} id={id} existing={existing.data} />
}

function QuizBuilderForm({ id, existing }: { id?: string; existing?: QuizDetail }) {
  const navigate = useNavigate()
  const [state, setState] = useState<BuilderState>(() => (existing ? fromDetail(existing) : EMPTY))
  const [creatingQuestion, setCreatingQuestion] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof BuilderState>(key: K, value: BuilderState[K]) =>
    setState((s) => ({ ...s, [key]: value }))
  const addQuestion = (q: Question) =>
    setState((s) => (s.questions.some((x) => x.id === q.id) ? s : { ...s, questions: [...s.questions, q] }))
  const removeQuestion = (qid: string) =>
    setState((s) => ({ ...s, questions: s.questions.filter((q) => q.id !== qid) }))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (state.questions.length === 0) {
      setError('Hãy thêm ít nhất 1 câu hỏi vào quiz')
      return
    }
    setError(null)
    setSaving(true)
    const payload: QuizPayload = {
      title: state.title.trim(),
      description: state.description.trim() || undefined,
      topic: state.topic.trim(),
      gradeLevel: state.gradeLevel,
      coverEmoji: state.coverEmoji,
      questionIds: state.questions.map((q) => q.id),
      status: state.published ? 'published' : 'draft',
      settings: { shuffleQuestions: state.shuffleQuestions },
    }
    try {
      if (id) await quizzesApi.update(id, payload)
      else await quizzesApi.create(payload)
      void invalidateQuizzes()
      navigate('/teacher')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const selectedIds = new Set(state.questions.map((q) => q.id))

  return (
    <>
      <form onSubmit={onSubmit}>
        <PageHeader
          title={id ? '✏️ Sửa bài quiz' : '🧩 Tạo bài quiz'}
          subtitle="Chọn câu hỏi từ kho hoặc tạo câu hỏi mới"
          actions={
            <>
              <Button variant="secondary" onClick={() => navigate('/teacher')}>
                Huỷ
              </Button>
              <Button type="submit" variant="success" loading={saving}>
                💾 Lưu quiz
              </Button>
            </>
          }
        />
        {error ? (
          <div className="mb-4">
            <ErrorBox message={error} />
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="flex flex-col gap-6">
            <Card className="flex flex-col gap-4">
              <h2 className="text-xl font-bold">Thông tin</h2>
              <Field label="Tên bài">
                <Input value={state.title} onChange={(e) => set('title', e.target.value)} required maxLength={80} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Chủ đề">
                  <Input value={state.topic} onChange={(e) => set('topic', e.target.value)} required maxLength={40} />
                </Field>
                <Field label="Khối lớp">
                  <Select value={state.gradeLevel} onChange={(e) => set('gradeLevel', Number(e.target.value))}>
                    {GRADE_LEVELS.map((g) => (
                      <option key={g} value={g}>
                        Lớp {g}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Mô tả (tuỳ chọn)">
                <Textarea
                  value={state.description}
                  onChange={(e) => set('description', e.target.value)}
                  maxLength={300}
                />
              </Field>
              <div>
                <span className="text-sm font-bold">Biểu tượng</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {COVER_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      aria-label={`Chọn biểu tượng ${emoji}`}
                      aria-pressed={state.coverEmoji === emoji}
                      onClick={() => set('coverEmoji', emoji)}
                      className={cn(
                        'grid size-11 place-items-center rounded-xl border-2 text-2xl transition-transform hover:scale-110',
                        state.coverEmoji === emoji ? 'border-brand bg-brand-soft' : 'border-line bg-surface',
                      )}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-6">
                <Toggle checked={state.published} onChange={(v) => set('published', v)} label="Xuất bản cho học sinh" />
                <Toggle
                  checked={state.shuffleQuestions}
                  onChange={(v) => set('shuffleQuestions', v)}
                  label="Xáo trộn câu hỏi"
                />
              </div>
            </Card>

            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xl font-bold">Câu hỏi trong quiz ({state.questions.length})</h2>
                <Button size="sm" variant="ghost" onClick={() => setCreatingQuestion(true)}>
                  ✨ Tạo câu hỏi mới
                </Button>
              </div>
              {state.questions.length === 0 ? (
                <EmptyState emoji="🧺" title="Chưa có câu hỏi">
                  Bấm “＋ Thêm” ở kho câu hỏi bên cạnh.
                </EmptyState>
              ) : (
                <Reorder.Group
                  axis="y"
                  values={state.questions}
                  onReorder={(questions) => set('questions', questions)}
                  className="flex flex-col gap-2"
                >
                  {state.questions.map((q, i) => (
                    <Reorder.Item
                      key={q.id}
                      value={q}
                      className="flex cursor-grab items-center gap-3 rounded-xl border-2 border-line bg-surface p-3 active:cursor-grabbing"
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft font-bold text-brand-dark">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold">{q.questionText}</p>
                        <Badge tone={q.type === 'matching' ? 'grape' : 'sky'}>{QUESTION_TYPE_LABELS[q.type]}</Badge>
                      </div>
                      <span aria-hidden className="text-ink-soft">
                        ⠿
                      </span>
                      <Button size="sm" variant="ghost" aria-label="Bỏ khỏi quiz" onClick={() => removeQuestion(q.id)}>
                        ✕
                      </Button>
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
              )}
              {state.questions.length > 1 ? (
                <p className="mt-2 text-xs text-ink-soft">Kéo thả để đổi thứ tự câu hỏi.</p>
              ) : null}
            </Card>
          </div>

          <Card>
            <h2 className="mb-3 text-xl font-bold">📚 Kho câu hỏi</h2>
            <QuestionPicker selectedIds={selectedIds} onAdd={addQuestion} initialTopic={existing?.topic} />
          </Card>
        </div>
      </form>

      {/* Outside the quiz <form>: the question form must not be nested in it
        (React submit events bubble through the component tree, even via portals). */}
      <Modal open={creatingQuestion} title="✨ Câu hỏi mới" onClose={() => setCreatingQuestion(false)}>
        <QuestionForm
          defaults={{ topic: state.topic, gradeLevel: state.gradeLevel }}
          submitLabel="Lưu & thêm vào quiz"
          onCancel={() => setCreatingQuestion(false)}
          onSaved={(q) => {
            addQuestion(q)
            setCreatingQuestion(false)
          }}
        />
      </Modal>
    </>
  )
}
