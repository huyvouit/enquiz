import { Fragment, type ReactNode } from 'react'
import { Badge } from '@/shared/components'
import { cn } from '@/shared/lib/cn'
import { BLANK, QUESTION_TYPE_LABELS, YLE_LABELS, type Question } from '../types'

const TYPE_TONE = {
  multiple_choice: 'sky',
  matching: 'grape',
  fill_in_blank: 'brand',
  ordering: 'coral',
} as const

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : typeof v === 'string' ? [v] : []

/** Compact read-only rendering of a question with its answer key highlighted. */
export function QuestionPreview({ question, actions }: { question: Question; actions?: ReactNode }) {
  const keyWords = strings(question.correctAnswer)
  return (
    <div className="flex flex-col gap-2 rounded-2xl border-2 border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={TYPE_TONE[question.type]}>{QUESTION_TYPE_LABELS[question.type]}</Badge>
          {question.skill === 'listening' ? <Badge tone="sky">🔊 Nghe</Badge> : null}
          <Badge tone="sunny">{question.topic}</Badge>
          <Badge tone="neutral">Lớp {question.gradeLevel}</Badge>
          {question.yleLevel ? <Badge tone="neutral">{YLE_LABELS[question.yleLevel]}</Badge> : null}
          {question.createdBy === null ? <Badge tone="grass">Kho hệ thống</Badge> : null}
        </div>
        {actions ? <div className="flex gap-1">{actions}</div> : null}
      </div>

      <div className="flex items-start gap-3">
        {question.mediaUrl ? (
          <img src={question.mediaUrl} alt="" loading="lazy" decoding="async" className="h-14 w-auto max-w-24 rounded-lg object-contain" />
        ) : null}
        <div>
          <p className="text-lg font-bold">
            {question.type === 'fill_in_blank' ? <TextWithBlank text={question.questionText} answer={keyWords[0]} /> : question.questionText}
          </p>
          {question.audioText ? (
            <p className="text-sm font-semibold text-sky-800">🔊 “{question.audioText}”</p>
          ) : null}
        </div>
      </div>

      {question.type === 'multiple_choice' && question.options ? (
        <ul className="flex flex-wrap gap-2">
          {question.options.map((o) => (
            <li
              key={o}
              className={cn(
                'rounded-lg px-2.5 py-1 text-sm font-semibold',
                o === question.correctAnswer ? 'bg-grass-soft text-green-800 ring-2 ring-grass' : 'bg-slate-100',
              )}
            >
              {o === question.correctAnswer ? '✓ ' : ''}
              {o}
            </li>
          ))}
        </ul>
      ) : null}

      {question.type === 'matching' && question.pairs ? (
        <ul className="flex flex-wrap gap-2">
          {question.pairs.map((p) => (
            <li key={p.left} className="rounded-lg bg-grape-soft px-2.5 py-1 text-sm font-semibold">
              {p.left} ↔ {p.right}
            </li>
          ))}
        </ul>
      ) : null}

      {question.type === 'fill_in_blank' ? (
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          <span>Đáp án: {keyWords.map((w) => <Fragment key={w}><span className="rounded-lg bg-grass-soft px-2 py-0.5 text-green-800">✓ {w}</span> </Fragment>)}</span>
          {question.options?.length ? (
            <span className="text-ink-soft">· Từ gợi ý: {question.options.join(', ')}</span>
          ) : (
            <span className="text-ink-soft">· Học sinh tự gõ</span>
          )}
        </div>
      ) : null}

      {question.type === 'ordering' ? (
        <ol className="flex flex-wrap gap-1.5 text-sm font-semibold">
          {keyWords.map((w, i) => (
            <li key={i} className="rounded-lg bg-coral-soft px-2 py-0.5">
              {w}
            </li>
          ))}
        </ol>
      ) : null}

      {question.tags.length > 0 ? (
        <p className="text-xs text-ink-soft">🏷️ {question.tags.join(' · ')}</p>
      ) : null}
    </div>
  )
}

function TextWithBlank({ text, answer }: { text: string; answer?: string }) {
  const [before, ...rest] = text.split(BLANK)
  if (rest.length === 0) return <>{text}</>
  return (
    <>
      {before}
      <span className="rounded bg-grass-soft px-1.5 text-green-800 underline decoration-dashed">{answer ?? BLANK}</span>
      {rest.join(BLANK)}
    </>
  )
}
