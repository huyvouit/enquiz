import { motion } from 'framer-motion'
import type { AnswerFeedback } from '@/features/progress'

const PRAISE = ['Chính xác! 🎉', 'Giỏi quá! ⭐', 'Tuyệt vời! 👏', 'Đúng rồi! 💯', 'Xuất sắc! 🌟']
const COMFORT = ['Chưa đúng rồi! 🙈', 'Ôi, tiếc quá! 😅', 'Gần đúng rồi đó! 💪']

/** Appears under the question once it is graded. Never scolds. */
export function FeedbackBanner({ feedback, seed }: { feedback: AnswerFeedback; seed: number }) {
  const ok = feedback.isCorrect
  const title = ok ? PRAISE[seed % PRAISE.length] : COMFORT[seed % COMFORT.length]
  const showAnswer = !ok && typeof feedback.correctAnswer === 'string'

  return (
    <motion.div
      role="status"
      initial={{ opacity: 0, y: 24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={
        ok
          ? 'mt-5 rounded-2xl border-2 border-grass bg-grass-soft p-4 text-center text-green-900'
          : 'mt-5 rounded-2xl border-2 border-coral/50 bg-coral-soft p-4 text-center text-rose-900'
      }
    >
      <p className="font-display text-2xl font-extrabold">{title}</p>
      {showAnswer ? (
        <p className="mt-1 font-bold">
          Đáp án đúng: <span className="text-green-700">{String(feedback.correctAnswer)}</span>
        </p>
      ) : null}
      {!ok && feedback.explanation ? <p className="mt-1 font-semibold">💡 {feedback.explanation}</p> : null}
    </motion.div>
  )
}
