import { useRef, useState, type FormEvent } from 'react'
import { errorMessage } from '@/shared/api/http'
import { GRADE_LEVELS } from '@/shared/api/types'
import { Button, ErrorBox, Field, Input, Select, Textarea } from '@/shared/components'
import { cn } from '@/shared/lib/cn'
import { useAsync } from '@/shared/hooks/useAsync'
import { questionsApi } from '../api/questions.api'
import {
  AUTHORABLE_TYPES,
  BLANK,
  QUESTION_LIMITS,
  QUESTION_TYPE_ICONS,
  QUESTION_TYPE_LABELS,
  SKILL_LABELS,
  YLE_LABELS,
  type AuthorableQuestionType,
  type Question,
  type QuestionPayload,
  type QuestionSkill,
  type YleLevel,
} from '../types'
import { ChipsInput } from './editors/ChipsInput'
import { OptionsEditor, PairsEditor } from './editors/ChoiceEditors'
import { AudioTextField, ImageField } from './editors/MediaEditor'
import { FillBlankEditor, OrderingEditor } from './editors/TypedEditors'

interface FormState {
  topic: string
  gradeLevel: number
  type: AuthorableQuestionType
  skill: QuestionSkill
  /** The teacher picked the skill by hand: do not auto-switch to "Nghe". */
  skillTouched: boolean
  questionText: string
  mediaUrl: string
  audioText: string
  explanation: string
  // multiple_choice
  options: string[]
  correctIndex: number
  // matching
  pairs: { left: string; right: string }[]
  // fill_in_blank
  accepted: string[]
  useBank: boolean
  bank: string[]
  // ordering
  orderItems: string[]
  // classification
  tags: string[]
  yleLevel: YleLevel | ''
  unit: string
}

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : typeof v === 'string' ? [v] : []

function initialState(q?: Question, defaults?: Partial<Pick<FormState, 'topic' | 'gradeLevel'>>): FormState {
  const isMc = q?.type === 'multiple_choice'
  const options = isMc && q?.options?.length ? q.options : ['', '', '']
  const correctIndex = isMc && q?.options ? Math.max(0, q.options.indexOf(String(q.correctAnswer))) : 0
  const bank = q?.type === 'fill_in_blank' ? (q.options ?? []) : []
  return {
    topic: q?.topic ?? defaults?.topic ?? '',
    gradeLevel: q?.gradeLevel ?? defaults?.gradeLevel ?? 1,
    type: q?.type ?? 'multiple_choice',
    skill: q?.skill ?? 'vocabulary',
    skillTouched: !!q,
    questionText: q?.questionText ?? '',
    mediaUrl: q?.mediaUrl ?? '',
    audioText: q?.audioText ?? '',
    explanation: q?.explanation ?? '',
    options,
    correctIndex,
    pairs: q?.pairs?.length ? q.pairs : [{ left: '', right: '' }, { left: '', right: '' }],
    accepted: q?.type === 'fill_in_blank' ? strings(q.correctAnswer) : [],
    useBank: bank.length > 0,
    bank,
    orderItems: q?.type === 'ordering' ? strings(q.correctAnswer) : ['', ''],
    tags: q?.tags ?? [],
    yleLevel: q?.yleLevel ?? '',
    unit: q?.unit ?? '',
  }
}

/** Friendly checks before calling the API (the server re-checks everything). */
function clientError(s: FormState): string | null {
  if (s.type === 'fill_in_blank') {
    const blanks = s.questionText.replace(/_{3,}/g, BLANK).split(BLANK).length - 1
    if (blanks !== 1) return `Câu điền từ cần đúng một chỗ trống ${BLANK} (bấm “Chèn chỗ trống”).`
    if (s.accepted.length === 0) return 'Hãy nhập ít nhất một đáp án đúng.'
    if (s.useBank) {
      if (s.bank.length < QUESTION_LIMITS.minOptions) return 'Cần ít nhất 2 từ gợi ý.'
      const norm = (x: string) => x.trim().toLowerCase()
      if (!s.accepted.some((a) => s.bank.some((b) => norm(a) === norm(b))))
        return 'Từ gợi ý phải có ít nhất một đáp án đúng.'
    }
  }
  if (s.type === 'ordering' && s.orderItems.filter((x) => x.trim()).length < QUESTION_LIMITS.minOrderItems) {
    return 'Cần ít nhất 2 phần để sắp xếp.'
  }
  return null
}

function toPayload(s: FormState): QuestionPayload {
  const base = {
    topic: s.topic.trim(),
    gradeLevel: s.gradeLevel,
    type: s.type,
    skill: s.skill,
    questionText: s.questionText.trim(),
    mediaUrl: s.mediaUrl.trim() || undefined,
    audioText: s.audioText.trim() || undefined,
    explanation: s.explanation.trim() || undefined,
    tags: s.tags,
    yleLevel: s.yleLevel || undefined,
    unit: s.unit.trim() || undefined,
  }
  switch (s.type) {
    case 'multiple_choice': {
      const options = s.options.map((o) => o.trim())
      return { ...base, options, correctAnswer: options[s.correctIndex] }
    }
    case 'fill_in_blank':
      return { ...base, acceptedAnswers: s.accepted, options: s.useBank ? s.bank : undefined }
    case 'ordering':
      return { ...base, orderedItems: s.orderItems.map((x) => x.trim()).filter(Boolean) }
    default:
      return { ...base, pairs: s.pairs.map((p) => ({ left: p.left.trim(), right: p.right.trim() })) }
  }
}

const TEXT_ID = 'question-text'

const TYPE_HINTS: Record<AuthorableQuestionType, string> = {
  multiple_choice: 'Có thể dùng emoji làm hình minh hoạ, VD: 🐶 What animal is this?',
  matching: 'VD: Nối con vật với tên tiếng Anh',
  fill_in_blank: `Viết câu có một chỗ trống ${BLANK}, VD: I have a ${BLANK}.`,
  ordering: 'Lời dặn cho học sinh, VD: Sắp xếp thành câu đúng',
}

/**
 * Create/edit form for all four question types.
 * Used by the question editor page and inline inside the quiz builder.
 */
export function QuestionForm({
  question,
  defaults,
  submitLabel = 'Lưu câu hỏi',
  onSaved,
  onCancel,
}: {
  question?: Question
  defaults?: Partial<Pick<FormState, 'topic' | 'gradeLevel'>>
  submitLabel?: string
  onSaved: (q: Question) => void
  onCancel?: () => void
}) {
  const [state, setState] = useState<FormState>(() => initialState(question, defaults))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const topics = useAsync(() => questionsApi.topics(), [])
  // Caret position in the question text, for "Chèn chỗ trống".
  const caret = useRef<{ start: number; end: number } | null>(null)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState((s) => ({ ...s, [key]: value }))

  function setAudioText(audioText: string) {
    // A read-aloud question is a listening question unless chosen otherwise.
    setState((s) => ({
      ...s,
      audioText,
      skill: !s.skillTouched && audioText.trim() ? 'listening' : s.skill,
    }))
  }

  function insertBlank() {
    const text = state.questionText
    const start = Math.min(caret.current?.start ?? text.length, text.length)
    const end = Math.min(caret.current?.end ?? text.length, text.length)
    set('questionText', text.slice(0, start) + BLANK + text.slice(end))
    const at = start + BLANK.length
    caret.current = { start: at, end: at }
    requestAnimationFrame(() => {
      const el = document.getElementById(TEXT_ID) as HTMLTextAreaElement | null
      el?.focus()
      el?.setSelectionRange(at, at)
    })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const problem = clientError(state)
    setError(problem)
    if (problem) return
    setSaving(true)
    try {
      const payload = toPayload(state)
      const saved = question
        ? await questionsApi.update(question.id, payload)
        : await questionsApi.create(payload)
      onSaved(saved)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const hasBlank = state.questionText.includes(BLANK)

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Chủ đề" hint="VD: Animals, Colors">
          <Input
            list="question-topics"
            value={state.topic}
            onChange={(e) => set('topic', e.target.value)}
            required
            maxLength={40}
          />
          <datalist id="question-topics">
            {topics.data?.map((t) => <option key={t} value={t} />)}
          </datalist>
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
        <Field label="Kỹ năng">
          <Select
            value={state.skill}
            onChange={(e) =>
              setState((s) => ({ ...s, skill: e.target.value as QuestionSkill, skillTouched: true }))
            }
          >
            {Object.entries(SKILL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Dạng câu hỏi">
        {AUTHORABLE_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={state.type === t}
            onClick={() => set('type', t)}
            className={cn(
              'min-h-11 rounded-xl border-2 px-4 py-2 font-bold transition-colors',
              state.type === t ? 'border-brand bg-brand text-white' : 'border-line bg-surface hover:border-brand',
            )}
          >
            {QUESTION_TYPE_ICONS[t]} {QUESTION_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      <Field label="Nội dung câu hỏi" hint={TYPE_HINTS[state.type]}>
        <Textarea
          id={TEXT_ID}
          value={state.questionText}
          onSelect={(e) =>
            (caret.current = { start: e.currentTarget.selectionStart, end: e.currentTarget.selectionEnd })
          }
          onChange={(e) => set('questionText', e.target.value)}
          required
          maxLength={300}
        />
      </Field>
      {state.type === 'fill_in_blank' ? (
        <div className="-mt-3 flex flex-wrap items-center gap-3">
          <Button variant="secondary" size="sm" onClick={insertBlank} disabled={hasBlank}>
            ➕ Chèn chỗ trống {BLANK}
          </Button>
          {hasBlank ? (
            <span className="text-sm font-bold text-green-700">✓ Đã có chỗ trống</span>
          ) : (
            <span className="text-sm text-ink-soft">Đặt con trỏ vào chỗ cần trống rồi bấm nút.</span>
          )}
        </div>
      ) : null}

      {state.type === 'multiple_choice' ? (
        <OptionsEditor
          options={state.options}
          correctIndex={state.correctIndex}
          onChange={(options, correctIndex) => setState((s) => ({ ...s, options, correctIndex }))}
        />
      ) : null}
      {state.type === 'matching' ? <PairsEditor pairs={state.pairs} onChange={(pairs) => set('pairs', pairs)} /> : null}
      {state.type === 'fill_in_blank' ? (
        <FillBlankEditor
          accepted={state.accepted}
          useBank={state.useBank}
          bank={state.bank}
          onChange={(next) => setState((s) => ({ ...s, ...next }))}
        />
      ) : null}
      {state.type === 'ordering' ? (
        <OrderingEditor items={state.orderItems} onChange={(items) => set('orderItems', items)} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <ImageField value={state.mediaUrl} onChange={(url) => set('mediaUrl', url)} />
        <AudioTextField value={state.audioText} onChange={setAudioText} />
      </div>

      <Field label="Giải thích (tuỳ chọn)" hint="Hiện cho học sinh khi trả lời sai">
        <Input value={state.explanation} onChange={(e) => set('explanation', e.target.value)} maxLength={300} />
      </Field>

      <details className="rounded-2xl border-2 border-line p-4" open={state.tags.length > 0 || !!state.yleLevel}>
        <summary className="cursor-pointer font-bold">🏷️ Phân loại (tuỳ chọn): nhãn, Cambridge, bài SGK</summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5 sm:col-span-3">
            <span className="text-sm font-bold">Nhãn (tối đa {QUESTION_LIMITS.maxTags})</span>
            <ChipsInput
              values={state.tags}
              onChange={(tags) => set('tags', tags)}
              max={QUESTION_LIMITS.maxTags}
              maxLength={30}
              placeholder="VD: pets"
              ariaLabel="Nhãn"
            />
          </div>
          <Field label="Cấp độ Cambridge">
            <Select value={state.yleLevel} onChange={(e) => set('yleLevel', e.target.value as YleLevel | '')}>
              <option value="">—</option>
              {Object.entries(YLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Bài trong SGK" hint="VD: Unit 3">
            <Input value={state.unit} onChange={(e) => set('unit', e.target.value)} maxLength={40} />
          </Field>
        </div>
      </details>

      {error ? <ErrorBox message={error} /> : null}
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button variant="secondary" onClick={onCancel}>
            Huỷ
          </Button>
        ) : null}
        <Button type="submit" variant="success" loading={saving}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
