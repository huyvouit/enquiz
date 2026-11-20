import type { MatchPair } from '@/shared/api/types'
import { cn } from '@/shared/lib/cn'
import type { AttemptDetailItem } from '../types'

function asPairs(value: unknown): MatchPair[] {
  return Array.isArray(value)
    ? value.filter((p): p is MatchPair => typeof p === 'object' && p !== null && 'left' in p && 'right' in p)
    : []
}

/** Readable answer: ordering pieces joined, fill-in accepted answers "cat / kitten". */
function answerText(type: AttemptDetailItem['type'], value: unknown, isKey: boolean): string {
  if (value === null || value === undefined) return '(bỏ qua)'
  if (Array.isArray(value)) {
    const words = value.filter((v): v is string => typeof v === 'string')
    if (type === 'fill_in_blank' && isKey) return words.join(' / ')
    return words.join(' ')
  }
  return String(value)
}

/**
 * One row of the post-quiz review: the student's answer vs. the right one.
 * `answersHidden`: an exam whose answers come after the due date (plan E12),
 * so only right/wrong and the student's own answer are shown.
 */
export function AnswerReview({
  item,
  index,
  answersHidden = false,
}: {
  item: AttemptDetailItem
  index: number
  answersHidden?: boolean
}) {
  return (
    <li
      className={cn(
        'flex flex-col gap-2 rounded-2xl border-2 p-4',
        item.isCorrect ? 'border-grass/50 bg-grass-soft/60' : 'border-coral/40 bg-coral-soft/60',
      )}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-label={item.isCorrect ? 'Đúng' : 'Sai'}>
          {item.isCorrect ? '✅' : '❌'}
        </span>
        <p className="font-bold">
          {index + 1}. {item.questionText ?? '(Câu hỏi đã bị xoá)'}
        </p>
      </div>

      {item.type === 'matching' && answersHidden ? (
        <GivenPairs given={asPairs(item.studentAnswer)} />
      ) : item.type === 'matching' ? (
        <MatchingReview given={asPairs(item.studentAnswer)} correct={asPairs(item.correctAnswer)} />
      ) : item.type ? (
        <div className="flex flex-wrap gap-x-6 gap-y-1 pl-10 text-sm font-semibold">
          <span>
            {item.type === 'multiple_choice' ? 'Em chọn' : 'Em trả lời'}:{' '}
            <span className={item.isCorrect ? 'text-green-700' : 'text-rose-700'}>
              {answerText(item.type, item.studentAnswer, false)}
            </span>
          </span>
          {!item.isCorrect && !answersHidden ? (
            <span>
              {item.type === 'ordering' ? 'Câu đúng' : 'Đáp án đúng'}:{' '}
              <span className="text-green-700">{answerText(item.type, item.correctAnswer, true)}</span>
            </span>
          ) : null}
        </div>
      ) : null}

      {!item.isCorrect && item.explanation ? (
        <p className="pl-10 text-sm text-ink-soft">💡 {item.explanation}</p>
      ) : null}
    </li>
  )
}

function GivenPairs({ given }: { given: MatchPair[] }) {
  if (given.length === 0) return <p className="pl-10 text-sm font-semibold">Em trả lời: (bỏ qua)</p>
  return (
    <ul className="flex flex-wrap gap-2 pl-10 text-sm font-semibold">
      {given.map((p) => (
        <li key={p.left} className="rounded-lg bg-white px-2.5 py-1">
          {p.left} ↔ {p.right}
        </li>
      ))}
    </ul>
  )
}

function MatchingReview({ given, correct }: { given: MatchPair[]; correct: MatchPair[] }) {
  const givenByLeft = new Map(given.map((p) => [p.left, p.right]))
  return (
    <ul className="flex flex-wrap gap-2 pl-10 text-sm font-semibold">
      {correct.map((p) => {
        const chosen = givenByLeft.get(p.left)
        const ok = chosen?.trim().toLowerCase() === p.right.trim().toLowerCase()
        return (
          <li
            key={p.left}
            className={cn('rounded-lg px-2.5 py-1', ok ? 'bg-grass-soft text-green-800' : 'bg-white text-rose-700')}
          >
            {p.left} ↔ {ok ? p.right : `${chosen ?? '?'} (đúng: ${p.right})`}
          </li>
        )
      })}
    </ul>
  )
}
