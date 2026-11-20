import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { Card, Mascot } from '@/shared/components'
import { formatDateTime, formatDuration, starsForScore } from '@/shared/lib/format'
import type { AttemptResult } from '../types'
import { AnswerReview } from './AnswerReview'
import { ProgressionPanel } from './ProgressionPanel'
import { ScoreStars } from './ScoreStars'

const CHEERS = [
  'Không sao đâu, mình cùng thử lại nhé! 💪',
  'Cố lên! Em đang tiến bộ đó! 🌱',
  'Giỏi lắm! Thêm chút nữa là hoàn hảo! 👏',
  'Xuất sắc! Em là siêu sao tiếng Anh! 🏆',
] as const

/**
 * Score header + per-question review. Used right after submitting, from
 * history and after an exam. Exams (plan 4.2) earn no XP, so the
 * progression panel is replaced by a short note.
 */
export function ResultView({
  result,
  actions,
  fresh = false,
}: {
  result: AttemptResult
  actions?: ReactNode
  /** True right after finishing: celebrate with sound/confetti. */
  fresh?: boolean
}) {
  const stars = starsForScore(result.score)
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Card className="flex flex-col items-center gap-4 text-center">
        <p className="text-4xl" aria-hidden>
          {result.coverEmoji ?? '📘'}
        </p>
        <h1 className="text-2xl font-extrabold sm:text-3xl">{result.quizTitle ?? 'Bài quiz đã bị xoá'}</h1>
        <ScoreStars score={result.score} size="lg" animate />
        <motion.p
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 1.1, type: 'spring' }}
          className="font-display text-6xl font-extrabold text-brand"
        >
          {result.score}
          <span className="text-3xl">/100</span>
        </motion.p>
        <p className="font-bold text-ink-soft">
          Đúng {result.correctCount}/{result.totalQuestions} câu · {formatDuration(result.durationSec)}
        </p>
        {result.mode === 'exam' ? (
          <p className="rounded-2xl bg-sky-soft px-4 py-2 font-semibold">
            📝 Bài kiểm tra
            {result.isAutoSubmit ? ' · ⏱ Hết giờ, bài được tự nộp' : ''}
          </p>
        ) : (
          <ProgressionPanel progression={result.progression} score={result.score} fresh={fresh} />
        )}
        <Mascot mood={stars >= 2 ? 'cheer' : 'happy'} message={CHEERS[stars]} />
        {actions ? <div className="flex flex-wrap justify-center gap-3">{actions}</div> : null}
      </Card>

      <section>
        <h2 className="mb-3 text-2xl font-bold">Xem lại bài làm</h2>
        {result.answersHiddenUntil ? (
          <p className="mb-3 rounded-2xl bg-sunny-soft px-4 py-3 font-semibold">
            🔒 Đáp án đúng và lời giải thích sẽ hiện sau hạn nộp ({formatDateTime(result.answersHiddenUntil)}).
          </p>
        ) : null}
        <ol className="flex flex-col gap-3">
          {result.details.map((item, i) => (
            <AnswerReview
              key={item.questionId}
              item={item}
              index={i}
              answersHidden={result.answersHiddenUntil !== null}
            />
          ))}
        </ol>
      </section>
    </div>
  )
}
